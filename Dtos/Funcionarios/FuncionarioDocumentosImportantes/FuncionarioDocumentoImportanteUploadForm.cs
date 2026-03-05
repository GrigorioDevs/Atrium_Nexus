using Microsoft.AspNetCore.Http;

namespace Atrium.RH.Dtos.FuncionarioDocumentosImportantes;

public class FuncionarioDocumentoImportanteUploadForm
{
    public IFormFile File { get; set; } = default!;

    public string Nome { get; set; } = "";
    public string? Tipo { get; set; }

    public DateOnly? DataEmissao { get; set; }
    public DateOnly? DataValidade { get; set; }

}
