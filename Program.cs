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

using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.OpenApi.Models;

using System.Text.Json;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

// ======================================================
// 1) Controllers + JSON (camelCase) + IgnoreCycles + Enums como string
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

// ✅ Para Minimal APIs (Results.Json etc.)
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

    // (opcional) Documenta cookie auth
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
// 3) CORS — Cookie precisa de credentials
// ======================================================
const string CorsPolicy = "DefaultCors";

var allowedOrigins =
    builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>();

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
    opt.UseSqlServer(connectionString, sql =>
    {
        sql.EnableRetryOnFailure(3);
    });
});

// ======================================================
// 5) Cookie Authentication (HttpOnly)
// ======================================================
builder.Services
    .AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(opt =>
    {
        opt.Cookie.Name = "atrium.auth";
        opt.Cookie.HttpOnly = true;

        opt.Cookie.SameSite = builder.Environment.IsDevelopment()
            ? SameSiteMode.Lax
            : SameSiteMode.None;

        opt.Cookie.SecurePolicy = builder.Environment.IsDevelopment()
            ? CookieSecurePolicy.None
            : CookieSecurePolicy.Always;

        // Evita redirect HTML (devolve 401/403 pro fetch)
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

// ✅ services lendo HttpContext (User.Claims)
builder.Services.AddHttpContextAccessor();

// ======================================================
// 6) Services (DI)
// ======================================================
builder.Services.AddScoped<UsuariosService>();
builder.Services.AddScoped<AuthService>();

builder.Services.AddScoped<IFuncionarioExplorerService, FuncionarioExplorerService>();
builder.Services.AddScoped<IFuncionarioDocumentosImportantesService, FuncionarioDocumentosImportantesService>();
builder.Services.AddScoped<IFuncDocImpTipoService, FuncDocImpTipoService>();

// ✅ Cursos
builder.Services.AddScoped<ICursoService, CursoService>();
builder.Services.AddScoped<IFuncionarioCursoService, FuncionarioCursoService>();

// ✅ Crachá de acesso
builder.Services.AddScoped<Atrium_Nexus.Services.Cracha.ICrachaService, Atrium_Nexus.Services.Cracha.CrachaService>();

// ✅ ✅ AQUI ESTÁ A CORREÇÃO QUE FALTAVA (resolve o crash do DI)
builder.Services.AddScoped<ICurrentUserService, CurrentUserService>();

// ✅ Usuário Perfil (me, upload avatar)
builder.Services.AddScoped<IUsuarioPerfilService, UsuarioPerfilService>();

// ======================================================
// 7) Storage (Upload local)
// ======================================================
builder.Services.Configure<StorageOptions>(builder.Configuration.GetSection("Storage"));
builder.Services.AddScoped<IFileStorage, LocalFileStorage>();

// ======================================================
// 8) Upload limits (multipart/form-data)
// ======================================================
const long UploadLimitBytes = 50_000_000; // 50MB

builder.Services.Configure<FormOptions>(o =>
{
    o.MultipartBodyLengthLimit = UploadLimitBytes;
});

builder.WebHost.ConfigureKestrel(o =>
{
    o.Limits.MaxRequestBodySize = UploadLimitBytes;
});

// ======================================================
// 9) Forwarded Headers (VPS / Nginx / Proxy)
// ======================================================
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;

    // importante em VPS/proxy pra não bloquear
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});

var app = builder.Build();

// ======================================================
// ✅ Flag p/ Swagger em produção
// - Em DEV: sempre on
// - Em PROD: só se ENABLE_SWAGGER=true
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

// ✅ Em produção, normalmente você quer HTTPS redirection (se tiver TLS no proxy/IIS)
// OBS: Se você está acessando direto por http://IP:8080 sem TLS, isso pode não ser necessário.
if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

app.UseRouting();

app.UseCors(CorsPolicy);

// ======================================================
// ✅ 10) EXPOR A PASTA STORAGE COMO /storage
// ======================================================
var storageRootCfg = builder.Configuration["Storage:RootPath"];
var storagePublicBasePath = builder.Configuration["Storage:PublicBasePath"] ?? "/storage";

// se não tiver configurado, usa "storage" na raiz do projeto
if (string.IsNullOrWhiteSpace(storageRootCfg))
{
    storageRootCfg = "storage";
}

// ✅ converte em absoluto (PhysicalFileProvider exige!)
var storageRoot = storageRootCfg.Trim();

if (!Path.IsPathRooted(storageRoot))
{
    // ContentRootPath = pasta do seu projeto/executável
    storageRoot = Path.GetFullPath(Path.Combine(app.Environment.ContentRootPath, storageRoot));
}

// garante a pasta
Directory.CreateDirectory(storageRoot);

// ✅ /storage -> storageRoot
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(storageRoot),
    RequestPath = storagePublicBasePath
});

// ======================================================

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Raiz: se Swagger estiver habilitado, manda pro Swagger. Senão, responde OK.
if (enableSwagger)
{
    app.MapGet("/", () => Results.Redirect("/swagger"));
}
else
{
    app.MapGet("/", () => Results.Ok("Atrium.Nexus API"));
}

app.Run();