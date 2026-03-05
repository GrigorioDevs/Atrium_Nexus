namespace Atrium.RH.Dtos.FuncionarioDocumentosImportantes;

public class FuncionarioDocumentoImportanteDto
{
    public int Id { get; set; }
    public string Nome { get; set; } = "";
    public string? Tipo { get; set; }
    public DateOnly? DataEmissao { get; set; }
    public DateOnly? DataValidade { get; set; }
    public long TamanhoBytes { get; set; }
    public DateTime Criacao { get; set; }

    public string DownloadUrl { get; set; } = "";
}
