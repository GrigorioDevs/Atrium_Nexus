namespace Atrium.RH.Services.FuncionarioAssinatura.Options;

public sealed class StorageOptions
{
    // Pode ser absoluto (ex: "C:\\SistemaWeb\\...\\storage") ou relativo ("storage")
    public string RootPath { get; set; } = "storage";

    // RequestPath onde o ASP.NET vai expor os arquivos
    public string RequestPath { get; set; } = "/storage";
}