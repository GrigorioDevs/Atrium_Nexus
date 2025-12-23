using Atrium.RH.Data;
using Atrium.RH.Services;
using Atrium.RH.Services.Storage;
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
        Description = "API do sistema — RH"
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
// Como seu front está vindo de origin 'null' (file://), aqui eu libero geral
// para ambiente de desenvolvimento. Depois, em produção, você pode restringir.
const string CorsPolicy = "DefaultCors";

builder.Services.AddCors(options =>
{
    options.AddPolicy(CorsPolicy, policy =>
        policy
            .AllowAnyOrigin()   // aceita qualquer origem (inclui 'null')
            .AllowAnyHeader()
            .AllowAnyMethod()
    );
});

// ======================================================
// 4) DbContext (SQL Server)
// ======================================================
// ✅ ATUALIZAÇÃO: pegar a connection string do appsettings.json (padrão e mais seguro)
// No appsettings.json use:
// "ConnectionStrings": { "Default": "Server=...;Database=...;User Id=...;Password=...;TrustServerCertificate=True;" }
var connectionString = builder.Configuration.GetConnectionString("Default")
    ?? throw new InvalidOperationException("ConnectionStrings:Default não configurada no appsettings.json");

builder.Services.AddDbContext<AtriumRhDbContext>(opt =>
{
    opt.UseSqlServer(connectionString);
    // opt.EnableSensitiveDataLogging(); // DEV apenas (debug)
});

// ======================================================
// 5) Services (DI)
// ======================================================
builder.Services.AddScoped<UsuariosService>();
builder.Services.AddScoped<AuthService>();

// ======================================================
// 6) Storage (Upload local de documentos)
// ======================================================
// ✅ ATUALIZAÇÃO: habilita o módulo de upload/download usando pasta local (storage/)
// No appsettings.json use:
// "Storage": { "RootPath": "storage" }
builder.Services.Configure<StorageOptions>(builder.Configuration.GetSection("Storage"));
builder.Services.AddScoped<IFileStorage, LocalFileStorage>();

// ======================================================
// 7) HealthChecks
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

// ✅ ATUALIZAÇÃO: normalmente é OK usar sempre (inclusive DEV)
// Se você estiver rodando só http e isso te atrapalhar, pode voltar a condicionar.
app.UseHttpsRedirection();

app.UseRouting();

// CORS ANTES dos controllers
app.UseCors(CorsPolicy);

// Se tiver auth mais pra frente, entra aqui:
// app.UseAuthentication();
// app.UseAuthorization();

app.MapControllers();
app.MapHealthChecks("/health");

// Atalho: abrir raiz vai pro Swagger
app.MapGet("/", () => Results.Redirect("/swagger"));

app.Run();
