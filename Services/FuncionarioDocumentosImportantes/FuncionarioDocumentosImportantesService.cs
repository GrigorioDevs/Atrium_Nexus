using Atrium.RH.Data;
using Atrium.RH.Domain.Entities;
using Atrium.RH.Dtos.FuncionarioDocumentosImportantes;
using Atrium.RH.Services.Storage;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace Atrium.RH.Services.FuncionarioDocumentosImportantes;

public class FuncionarioDocumentosImportantesService : IFuncionarioDocumentosImportantesService
{
    private readonly AtriumRhDbContext _db;
    private readonly IFileStorage _storage;
    private readonly IHttpContextAccessor _http;

    public FuncionarioDocumentosImportantesService(AtriumRhDbContext db, IFileStorage storage, IHttpContextAccessor http)
    {
        _db = db;
        _storage = storage;
        _http = http;
    }

    private async Task EnsureFuncionario(int funcionarioId, CancellationToken ct)
    {
        var ok = await _db.Funcionarios.AnyAsync(x => x.Id == funcionarioId && x.Ativo, ct);
        if (!ok) throw new InvalidOperationException("Funcionário não encontrado.");
    }

    private int GetUsuarioLogadoId()
    {
        var ctx = _http.HttpContext;

        // 1) Claim padrão (quando tiver auth de verdade)
        var s = ctx?.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (int.TryParse(s, out var id)) return id;

        // 2) Fallback provisório: header (igual você fez com X-User-Type no Swagger)
        if (ctx?.Request?.Headers.TryGetValue("X-User-Id", out var h) == true &&
            int.TryParse(h.ToString(), out id))
            return id;

        // 3) Último fallback
        return 1;
    }

    public async Task<IReadOnlyList<FuncionarioDocumentoImportanteDto>> List(int funcionarioId, CancellationToken ct)
    {
        await EnsureFuncionario(funcionarioId, ct);

        var rows = await _db.FuncionarioDocumentos.AsNoTracking()
            .Where(x => x.FuncionarioId == funcionarioId && x.Ativo && x.DocumentoImportante)
            .OrderByDescending(x => x.Criacao)
            .Select(x => new FuncionarioDocumentoImportanteDto
            {
                Id = x.Id,
                Nome = x.Nome,
                Tipo = x.Tipo,
                DataEmissao = x.DataEmissao,
                DataValidade = x.DataValidade,
                TamanhoBytes = x.TamanhoBytes,
                Criacao = x.Criacao,
                DownloadUrl = $"/api/funcionarios/{funcionarioId}/documentos-importantes/{x.Id}/download"
            })
            .ToListAsync(ct);

        return rows;
    }

    public async Task<FuncionarioDocumentoImportanteDto> Upload(int funcionarioId, FuncionarioDocumentoImportanteUploadForm form, CancellationToken ct)
    {
        await EnsureFuncionario(funcionarioId, ct);

        if (form.File == null || form.File.Length == 0)
            throw new InvalidOperationException("Envie um arquivo em 'file'.");

        var nome = (form.Nome ?? "").Trim();
        if (string.IsNullOrWhiteSpace(nome))
            nome = form.File.FileName ?? "documento";

        var now = DateTime.Now;
        var usuarioCriacaoId = GetUsuarioLogadoId();

        await using var stream = form.File.OpenReadStream();
        var storageKey = await _storage.SaveAsync(stream, form.File.FileName, form.File.ContentType, funcionarioId, ct);

        var doc = new FuncionarioDocumento
        {
            FuncionarioId = funcionarioId,
            PastaId = null,                 // ✅ RN: null mesmo
            DocumentoImportante = true,      // ✅ RN: importante

            Nome = nome,
            Tipo = string.IsNullOrWhiteSpace(form.Tipo) ? null : form.Tipo.Trim(),
            DataEmissao = form.DataEmissao,
            DataValidade = form.DataValidade,

            StorageKey = storageKey,
            ArquivoNomeOriginal = form.File.FileName,
            MimeType = form.File.ContentType,
            TamanhoBytes = form.File.Length,

            Ativo = true,
            Criacao = now,
            Alteracao = null,
            UsuarioCriacaoId = usuarioCriacaoId,
            UsuarioId = null
        };

        _db.FuncionarioDocumentos.Add(doc);
        await _db.SaveChangesAsync(ct);

        return new FuncionarioDocumentoImportanteDto
        {
            Id = doc.Id,
            Nome = doc.Nome,
            Tipo = doc.Tipo,
            DataEmissao = doc.DataEmissao,
            DataValidade = doc.DataValidade,
            TamanhoBytes = doc.TamanhoBytes,
            Criacao = doc.Criacao,
            DownloadUrl = $"/api/funcionarios/{funcionarioId}/documentos-importantes/{doc.Id}/download"
        };
    }

    public async Task<(Stream stream, string contentType, string fileName)> OpenDownload(int funcionarioId, int docId, CancellationToken ct)
    {
        await EnsureFuncionario(funcionarioId, ct);

        var doc = await _db.FuncionarioDocumentos.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == docId && x.FuncionarioId == funcionarioId && x.Ativo && x.DocumentoImportante, ct);

        if (doc == null)
            throw new InvalidOperationException("Documento importante não encontrado.");

        return await _storage.OpenAsync(
            doc.StorageKey,
            doc.MimeType ?? "application/octet-stream",
            doc.ArquivoNomeOriginal ?? "documento",
            ct
        );
    }

    public async Task Delete(int funcionarioId, int docId, CancellationToken ct)
    {
        await EnsureFuncionario(funcionarioId, ct);

        var doc = await _db.FuncionarioDocumentos
            .FirstOrDefaultAsync(x => x.Id == docId && x.FuncionarioId == funcionarioId && x.Ativo && x.DocumentoImportante, ct);

        if (doc == null) throw new InvalidOperationException("Documento importante não encontrado.");

        doc.Ativo = false;
        doc.Alteracao = DateTime.Now;
        doc.UsuarioId = GetUsuarioLogadoId();

        await _db.SaveChangesAsync(ct);
    }
}
