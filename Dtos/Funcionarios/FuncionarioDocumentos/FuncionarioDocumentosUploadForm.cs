using Microsoft.AspNetCore.Http;

namespace Atrium.RH.Dtos.FuncionarioDocumentos;

public class FuncionarioDocumentosUploadForm
{
    public List<IFormFile> Files { get; set; } = new();
    public string? ParentId { get; set; }
    public int? OwnerRole { get; set; }
}
