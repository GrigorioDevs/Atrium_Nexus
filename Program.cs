using Atrium.RH.Data;
using Atrium.RH.Services;
using Atrium.RH.Services.Storage;
using Atrium.RH.Services.FuncionarioDocumentos;
using Atrium.RH.Services.FuncionarioDocumentosImportantes;
using Atrium.RH.Services.DocImpTipos;
using Atrium.RH.Services.Cursos;
using Atrium.RH.Services.FuncionarioCursos;
using Atrium.RH.Services.Usuario;
using Atrium.RH.Services.Usuarios;

// ✅ Assinatura (singular)
using Atrium.RH.Services.FuncionarioAssinatura;
using Atrium.RH.Services.FuncionarioAssinatura.Options;

// ✅ Templates
using Atrium.RH.Services.DocumentoTemplates;

using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.OpenApi.Models;

using System.Text.Json;
using System.Text.Json.Serialization;

// ✅ Alias para evitar ambiguidade de StorageOptions
using CoreStorageOptions = Atrium.RH.Services.Storage.StorageOptions;

var builder = WebApplication.CreateBuilder(args);

// ======================================================
// 0) Upload limits
// ======================================================
const long UploadLimitBytes = 50L * 1024 * 1024; // 50MB

builder.Services.Configure<FormOptions>(o =>
{
    o.MultipartBodyLengthLimit = UploadLimitBytes;
});

builder.WebHost.ConfigureKestrel(o =>
{
    o.Limits.MaxRequestBodySize = UploadLimitBytes;
});

// ======================================================
// 1) Controllers + JSON
// ======================================================
builder.Services
    .AddControllers()
    .AddJsonOptions(o =>
    {
        o.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        o.JsonSerializerOptions.DictionaryKeyPolicy = JsonNamingPolicy.CamelCase;
        o.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
        o.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
        o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });

builder.Services.ConfigureHttpJsonOptions(o =>
{
    o.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    o.SerializerOptions.DictionaryKeyPolicy = JsonNamingPolicy.CamelCase;
    o.SerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
    o.SerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
    o.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
});

// ======================================================
// 2) Swagger
// ======================================================
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Atrium.Nexus | API",
        Version = "v1",
        Description = "API do sistema — Atrium.Nexus",
    });

    c.AddSecurityDefinition("cookieAuth", new OpenApiSecurityScheme
    {
        Name = "atrium.auth",
        Type = SecuritySchemeType.ApiKey,
        In = ParameterLocation.Cookie,
        Description = "Auth via Cookie (atrium.auth). Faça login no navegador para o cookie ser enviado."
    });

    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "cookieAuth" }
            },
            Array.Empty<string>()
        }
    });
});

// ======================================================
// 3) CORS (com cookies) — use lista do appsettings
// ======================================================
const string CorsPolicy = "DefaultCors";

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>();

if (allowedOrigins is null || allowedOrigins.Length == 0)
{
    allowedOrigins = new[]
    {
        "http://localhost:5500",
        "http://127.0.0.1:5501",
        "http://localhost:5173",
        "http://localhost:3000",
    };
}

builder.Services.AddCors(options =>
{
    options.AddPolicy(CorsPolicy, policy =>
        policy
            .WithOrigins(allowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials()
    );
});

// ======================================================
// 4) DbContext (SQL Server)
// ======================================================
var connectionString = builder.Configuration.GetConnectionString("Default")
    ?? throw new InvalidOperationException("ConnectionStrings:Default não configurada no appsettings.json");

builder.Services.AddDbContext<AtriumRhDbContext>(opt =>
{
    opt.UseSqlServer(connectionString, sql => sql.EnableRetryOnFailure(3));
});

// ======================================================
// 5) Cookie Authentication
// ======================================================
// ✅ Se estiver rodando HTTP puro (sem HTTPS), use:
//   export ALLOW_INSECURE_HTTP=true
var allowInsecureHttp = Environment.GetEnvironmentVariable("ALLOW_INSECURE_HTTP") == "true";

builder.Services
    .AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(opt =>
    {
        opt.Cookie.Name = "atrium.auth";
        opt.Cookie.HttpOnly = true;

        if (allowInsecureHttp)
        {
            opt.Cookie.SameSite = SameSiteMode.Lax;
            opt.Cookie.SecurePolicy = CookieSecurePolicy.None;
        }
        else
        {
            opt.Cookie.SameSite = SameSiteMode.None;
            opt.Cookie.SecurePolicy = CookieSecurePolicy.Always;
        }

        opt.Events = new CookieAuthenticationEvents
        {
            OnRedirectToLogin = ctx =>
            {
                ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
                return Task.CompletedTask;
            },
            OnRedirectToAccessDenied = ctx =>
            {
                ctx.Response.StatusCode = StatusCodes.Status403Forbidden;
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();

// ✅ necessário pra services lerem Host/Scheme/Claims
builder.Services.AddHttpContextAccessor();

// ======================================================
// 6) Options - Assinatura GIF
// ======================================================
builder.Services.Configure<FuncionarioAssinaturaStorageOptions>(
    builder.Configuration.GetSection("FuncionarioAssinaturaStorage"));

// ======================================================
// 7) Services (DI)
// ======================================================
builder.Services.AddScoped<UsuariosService>();
builder.Services.AddScoped<AuthService>();

builder.Services.AddScoped<IFuncionarioExplorerService, FuncionarioExplorerService>();
builder.Services.AddScoped<IFuncionarioDocumentosImportantesService, FuncionarioDocumentosImportantesService>();
builder.Services.AddScoped<IFuncDocImpTipoService, FuncDocImpTipoService>();

builder.Services.AddScoped<ICursoService, CursoService>();
builder.Services.AddScoped<IFuncionarioCursoService, FuncionarioCursoService>();

builder.Services.AddScoped<Atrium_Nexus.Services.Cracha.ICrachaService, Atrium_Nexus.Services.Cracha.CrachaService>();

builder.Services.AddScoped<ICurrentUserService, CurrentUserService>();
builder.Services.AddScoped<IUsuarioPerfilService, UsuarioPerfilService>();
builder.Services.AddScoped<IUsuariosAdminService, UsuariosAdminService>();

// ✅ Assinatura (GIF)
builder.Services.AddScoped<IFuncionarioAssinaturaGifService, FuncionarioAssinaturaGifService>();

// ✅ Templates
builder.Services.AddScoped<IDocumentoTemplatesService, DocumentoTemplatesService>();

// ======================================================
// 8) Storage (Upload local)
// ======================================================
builder.Services.Configure<CoreStorageOptions>(builder.Configuration.GetSection("Storage"));
builder.Services.AddScoped<IFileStorage, LocalFileStorage>();

// ======================================================
// 9) Forwarded Headers (proxy / nginx)
// ======================================================
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders =
        ForwardedHeaders.XForwardedFor |
        ForwardedHeaders.XForwardedProto |
        ForwardedHeaders.XForwardedHost;

    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});

// ======================================================
// 10) DataProtection (evita perder cookie ao recriar container)
// Monte um volume no container para persistir:
// -v /srv/atrium/dpkeys:/root/.aspnet/DataProtection-Keys
// ======================================================
builder.Services
    .AddDataProtection()
    .SetApplicationName("AtriumNexus")
    .PersistKeysToFileSystem(new DirectoryInfo("/root/.aspnet/DataProtection-Keys"));

var app = builder.Build();

// ======================================================
// Swagger flag
// ======================================================
var enableSwagger =
    app.Environment.IsDevelopment() ||
    Environment.GetEnvironmentVariable("ENABLE_SWAGGER") == "true";

// ======================================================
// Pipeline
// ======================================================
app.UseForwardedHeaders();

if (enableSwagger)
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.DocumentTitle = "Atrium.Nexus Swagger";
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "Atrium.Nexus v1");
        c.RoutePrefix = "swagger";
    });
}

// HTTPS redirect opcional (pra não dar warning quando roda HTTP puro no VPS)
var enableHttpsRedirect = Environment.GetEnvironmentVariable("ENABLE_HTTPS_REDIRECT") == "true";
if (enableHttpsRedirect)
{
    app.UseHttpsRedirection();
}

app.UseRouting();
app.UseCors(CorsPolicy);

// ======================================================
// EXPOR A PASTA STORAGE COMO /storage
// ======================================================
var storageRootCfg =
      app.Configuration["Storage:RootPath"]
   ?? app.Configuration["Storage:Path"]
   ?? "storage";

var storagePublicBasePath =
      app.Configuration["Storage:PublicBasePath"]
   ?? app.Configuration["Storage:RequestPath"]
   ?? "/storage";

storagePublicBasePath = storagePublicBasePath.Trim();
if (!storagePublicBasePath.StartsWith("/"))
    storagePublicBasePath = "/" + storagePublicBasePath;
storagePublicBasePath = storagePublicBasePath.TrimEnd('/');

var storageRoot = storageRootCfg.Trim();
if (!Path.IsPathRooted(storageRoot))
    storageRoot = Path.GetFullPath(Path.Combine(app.Environment.ContentRootPath, storageRoot));

Directory.CreateDirectory(storageRoot);

// content-types (garante png/gif corretamente)
var contentTypeProvider = new FileExtensionContentTypeProvider();
contentTypeProvider.Mappings[".png"] = "image/png";
contentTypeProvider.Mappings[".gif"] = "image/gif";

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(storageRoot),
    RequestPath = storagePublicBasePath,
    ContentTypeProvider = contentTypeProvider,
    ServeUnknownFileTypes = false,
    OnPrepareResponse = ctx =>
    {
        ctx.Context.Response.Headers["Cache-Control"] = "public,max-age=86400";
    }
});

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers().RequireCors(CorsPolicy);

if (enableSwagger)
    app.MapGet("/", () => Results.Redirect("/swagger"));
else
    app.MapGet("/", () => Results.Ok("Atrium.Nexus API"));

app.Run();