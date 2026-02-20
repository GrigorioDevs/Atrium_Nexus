namespace Atrium.RH.Dtos.FuncionarioDocumentos;

public class ExplorerItemDto
{
    public string Id { get; set; } = "";
    public string Type { get; set; } = ""; // "folder" | "file"
    public string Name { get; set; } = "";
    public string? ParentId { get; set; }
    public int OwnerRole { get; set; } = 2;

    public long? Size { get; set; }
    public string? MimeType { get; set; }
    public DateTime UploadedAt { get; set; }
    public string? DownloadUrl { get; set; }
}
