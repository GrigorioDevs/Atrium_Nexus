using Atrium.RH.Dtos.DocumentoTemplates;

namespace Atrium.RH.Services.DocumentoTemplates;

public interface IDocumentoTemplatesService
{
    Task<List<DocumentoTemplateListItemDto>> ListAsync(int usuarioLogadoId, CancellationToken ct);
    Task<DocumentoTemplateDetailDto?> GetAsync(Guid id, int usuarioLogadoId, CancellationToken ct);
    Task<DocumentoTemplateDetailDto> CreateAsync(int usuarioLogadoId, DocumentoTemplateCreateRequestDto dto, CancellationToken ct);
    Task<DocumentoTemplateDetailDto?> UpdateAsync(Guid id, int usuarioLogadoId, DocumentoTemplateUpdateRequestDto dto, CancellationToken ct);
    Task<bool> DeleteAsync(Guid id, int usuarioLogadoId, CancellationToken ct);
}