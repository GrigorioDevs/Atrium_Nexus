using Atrium.RH.Data;
using Atrium.RH.Services;
using Microsoft.AspNetCore.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi.Models;
using System.Text.Json;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

// ======================================================
// 1) Controllers + JSON (camelCase) - combina com seu JS
// ======================================================
builder.Services
    .AddControllers()
    .AddJsonOptions(o =>
    {
        o.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        o.JsonSerializerOptions.DictionaryKeyPolicy = JsonNamingPolicy.CamelCase;
        o.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
    });

// (Opcional) mesma config para Minimal APIs (se você usar)
builder.Services.Configure<JsonOptions>(o =>
{
    o.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    o.SerializerOptions.DictionaryKeyPolicy = JsonNamingPolicy.CamelCase;
    o.SerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
});

// ======================================================
// 2) Swagger (Swashbuckle)
// ======================================================
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Atrium.RH | API",
        Version = "v1",
        Description = "API do sistema RCR Engenharia — RH"
    });

    // Header que você usou para simular permissão de Admin
    c.AddSecurityDefinition("X-User-Type", new OpenApiSecurityScheme
    {
        Type = SecuritySchemeType.ApiKey,
        Name = "X-User-Type",
        In = ParameterLocation.Header,
        Description = "Simulação de permissão: 1 = Admin"
    });
});

// ======================================================
// 3) CORS (para seu front chamar a API)
// ======================================================
// Se você abre o front com Live Server, normalmente é :5500.
// Se você abrir o HTML como file://, vai dar problema de CORS.
const string CorsPolicy = "DefaultCors";

var allowedOrigins = new[]
{
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "http://localhost:5173",  // se usar Vite
    "http://127.0.0.1:5173"
};

builder.Services.AddCors(options =>
{
    options.AddPolicy(CorsPolicy, policy =>
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()
        // Se você NÃO usa cookie/autenticação por sessão, deixe SEM AllowCredentials.
        // .AllowCredentials()
    );
});

// ======================================================
// 4) DbContext (SQL Server)
// ======================================================
var connectionString =
    "Server=STORMZERAGG;Database=atrium_rh;User Id=system;Password=123;TrustServerCertificate=True;";

builder.Services.AddDbContext<AtriumRhDbContext>(opt =>
{
    opt.UseSqlServer(connectionString);
    // opt.EnableSensitiveDataLogging(); // DEV apenas (debug)
});

// ======================================================
// 5) Services (DI)
// ======================================================
builder.Services.AddScoped<UsuariosService>();
builder.Services.AddScoped<AuthService>(); // se você criou

// ======================================================
// 6) HealthChecks
// ======================================================
builder.Services.AddHealthChecks();

var app = builder.Build();

// ======================================================
// Pipeline
// ======================================================
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.DocumentTitle = "Atrium.RH Swagger";
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "Atrium.RH v1");
        c.RoutePrefix = "swagger";
    });
}

// ⚠️ No DEV isso costuma atrapalhar quando você chama http://localhost:5253 pelo front.
// Se quiser manter HTTPS, beleza — mas pra evitar dor de cabeça, deixo assim:
if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

app.UseRouting();
app.UseCors(CorsPolicy);

app.MapControllers();
app.MapHealthChecks("/health");

// Atalho: abrir raiz vai pro Swagger
app.MapGet("/", () => Results.Redirect("/swagger"));

app.Run();
