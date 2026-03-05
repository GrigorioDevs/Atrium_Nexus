using Atrium.RH.Dtos.FuncionarioDocumentos;

namespace Atrium.RH.Services.FuncionarioDocumentos;

public interface IFuncionarioExplorerService
{
    Task<IReadOnlyList<ExplorerItemDto>> ListAll(int funcionarioId, CancellationToken ct);
    Task<ExplorerItemDto> CreateFolder(int funcionarioId, FuncionarioDocumentosCreate dto, CancellationToken ct);
    Task Rename(int funcionarioId, string itemId, string newName, CancellationToken ct);
    Task DeleteItem(int funcionarioId, string itemId, CancellationToken ct);
    Task<IReadOnlyList<ExplorerItemDto>> UploadFiles(int funcionarioId, string? parentId, int? ownerRole, List<IFormFile> files, CancellationToken ct);
    Task<(Stream stream, string contentType, string fileName)> OpenDownload(int funcionarioId, string itemId, CancellationToken ct);
    Task Move(int funcionarioId, FuncionarioDocumentosCopy dto, CancellationToken ct);
}
