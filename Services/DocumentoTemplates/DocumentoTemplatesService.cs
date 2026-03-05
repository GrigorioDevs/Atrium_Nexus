using Atrium.RH.Dtos.DocumentoTemplates;
using Microsoft.EntityFrameworkCore;

using Atrium.RH.Data;         // AtriumRhDbContext
using Atrium.RH.Data.Entities; // DocumentoTemplate

namespace Atrium.RH.Services.DocumentoTemplates;

public class DocumentoTemplatesService : IDocumentoTemplatesService
{
    private readonly AtriumRhDbContext _db;

    public DocumentoTemplatesService(AtriumRhDbContext db)
    {
        _db = db;
    }

    public async Task<List<DocumentoTemplateListItemDto>> ListAsync(int usuarioLogadoId, CancellationToken ct)
    {
        return await _db.DocumentosTemplates
            .AsNoTracking()
            .Where(x => x.Ativo && x.UsuarioCriacaoId == usuarioLogadoId)
            .OrderByDescending(x => x.Alteracao)
            .Select(x => new DocumentoTemplateListItemDto
            {
                Id = x.Id,
                Nome = x.Nome,
                DataCriacao = x.DataCriacao,
                UsuarioCriacaoId = x.UsuarioCriacaoId,
                Alteracao = x.Alteracao,
                UsuarioId = x.UsuarioId
            })
            .ToListAsync(ct);
    }

    public async Task<DocumentoTemplateDetailDto?> GetAsync(Guid id, int usuarioLogadoId, CancellationToken ct)
    {
        var e = await _db.DocumentosTemplates
            .AsNoTracking()
            .FirstOrDefaultAsync(x =>
                x.Id == id &&
                x.Ativo &&
                x.UsuarioCriacaoId == usuarioLogadoId, ct);

        return e is null ? null : ToDetailDto(e);
    }

    public async Task<DocumentoTemplateDetailDto> CreateAsync(int usuarioLogadoId, DocumentoTemplateCreateRequestDto dto, CancellationToken ct)
    {
        var now = DateTime.UtcNow;

        var e = new DocumentoTemplate
        {
            Id = Guid.NewGuid(),
            Nome = (dto.Nome ?? "").Trim(),
            Html = dto.Html ?? "",
            LayoutJson = dto.LayoutJson,

            DataCriacao = now,
            UsuarioCriacaoId = usuarioLogadoId,

            Alteracao = now,
            UsuarioId = usuarioLogadoId,

            DataInterface = null,
            DataSincronizacao = null,

            Ativo = true
        };

        _db.DocumentosTemplates.Add(e);
        await _db.SaveChangesAsync(ct);

        return ToDetailDto(e);
    }

    public async Task<DocumentoTemplateDetailDto?> UpdateAsync(Guid id, int usuarioLogadoId, DocumentoTemplateUpdateRequestDto dto, CancellationToken ct)
    {
        var e = await _db.DocumentosTemplates
            .FirstOrDefaultAsync(x =>
                x.Id == id &&
                x.Ativo &&
                x.UsuarioCriacaoId == usuarioLogadoId, ct);

        if (e is null) return null;

        e.Nome = (dto.Nome ?? "").Trim();
        e.Html = dto.Html ?? "";
        e.LayoutJson = dto.LayoutJson;

        e.Alteracao = DateTime.UtcNow;
        e.UsuarioId = usuarioLogadoId;

        e.DataInterface = null;
        e.DataSincronizacao = null;

        await _db.SaveChangesAsync(ct);

        return ToDetailDto(e);
    }

    public async Task<bool> DeleteAsync(Guid id, int usuarioLogadoId, CancellationToken ct)
    {
        var e = await _db.DocumentosTemplates
            .FirstOrDefaultAsync(x =>
                x.Id == id &&
                x.Ativo &&
                x.UsuarioCriacaoId == usuarioLogadoId, ct);

        if (e is null) return false;

        e.Ativo = false;

        e.Alteracao = DateTime.UtcNow;
        e.UsuarioId = usuarioLogadoId;

        e.DataInterface = null;
        e.DataSincronizacao = null;

        await _db.SaveChangesAsync(ct);
        return true;
    }

    private static DocumentoTemplateDetailDto ToDetailDto(DocumentoTemplate x) => new DocumentoTemplateDetailDto
    {
        Id = x.Id,
        Nome = x.Nome,
        Html = x.Html,
        LayoutJson = x.LayoutJson,

        DataCriacao = x.DataCriacao,
        UsuarioCriacaoId = x.UsuarioCriacaoId,

        Alteracao = x.Alteracao,
        UsuarioId = x.UsuarioId,

        DataInterface = x.DataInterface,
        DataSincronizacao = x.DataSincronizacao,

        Ativo = x.Ativo
    };
}