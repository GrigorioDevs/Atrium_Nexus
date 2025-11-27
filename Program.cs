var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.AllowAnyOrigin()
              .AllowAnyHeader()
              .AllowAnyMethod());
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();
app.UseCors();

var summaries = new[]
{
    "Freezing", "Bracing", "Chilly", "Cool", "Mild", "Warm", "Balmy", "Hot", "Sweltering", "Scorching"
};

app.MapGet("/weatherforecast", () =>
{
    var forecast =  Enumerable.Range(1, 5).Select(index =>
        new WeatherForecast
        (
            DateOnly.FromDateTime(DateTime.Now.AddDays(index)),
            Random.Shared.Next(-20, 55),
            summaries[Random.Shared.Next(summaries.Length)]
        ))
        .ToArray();
    return forecast;
})
.WithName("GetWeatherForecast");

app.MapPost("/api/usuario/login", (LoginRequest req) =>
{
    var byUsuario = !string.IsNullOrWhiteSpace(req.Login);
    var byCpf = !string.IsNullOrWhiteSpace(req.Cpf);

    if (byUsuario && req.Login!.Equals("gustavo", StringComparison.OrdinalIgnoreCase) && req.Senha == "123")
    {
        var usuario = new
        {
            id = 1,
            nome = "Gustavo",
            login = "gustavo",
            role = "Colaborador"
        };
        return Results.Ok(usuario);
    }

    if (byCpf && req.Senha == "123")
    {
        var usuario = new
        {
            id = 2,
            nome = "Usuário CPF",
            cpf = req.Cpf,
            role = "Colaborador"
        };
        return Results.Ok(usuario);
    }

    return Results.Unauthorized();
});

app.Run();

record WeatherForecast(DateOnly Date, int TemperatureC, string? Summary)
{
    public int TemperatureF => 32 + (int)(TemperatureC / 0.5556);
}

record LoginRequest(string? Cpf, string? Login, string Senha);
