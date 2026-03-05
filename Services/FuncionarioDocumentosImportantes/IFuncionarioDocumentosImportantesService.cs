using Atrium.RH.Dtos.FuncionarioDocumentosImportantes;

namespace Atrium.RH.Services.FuncionarioDocumentosImportantes;

public interface IFuncionarioDocumentosImportantesService
{
    Task<IReadOnlyList<FuncionarioDocumentoImportanteDto>> List(int funcionarioId, CancellationToken ct);
    Task<FuncionarioDocumentoImportanteDto> Upload(int funcionarioId, FuncionarioDocumentoImportanteUploadForm form, CancellationToken ct);
    Task<(Stream stream, string contentType, string fileName)> OpenDownload(int funcionarioId, int docId, CancellationToken ct);
    Task Delete(int funcionarioId, int docId, CancellationToken ct);
}
