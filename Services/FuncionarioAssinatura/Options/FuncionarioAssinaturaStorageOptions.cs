namespace Atrium.RH.Services.FuncionarioAssinatura.Options;

public sealed class FuncionarioAssinaturaStorageOptions
{
    public string RootPath { get; set; } = "storage";
    public string PublicBasePath { get; set; } = "/storage";
    public string PastaAssinaturasFuncionarios { get; set; } = "assinaturas/funcionarios";
}