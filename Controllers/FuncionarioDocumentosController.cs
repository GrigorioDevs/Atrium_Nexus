using Atrium.RH.Data;
using Atrium.RH.Domain.Entities;   // ✅ aqui
using Atrium.RH.Services.Storage;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace Atrium.RH.Controllers;

[ApiController]
[Route("api/funcionarios/{funcionarioId:int}/documentos")]
public class FuncionarioDocumentosController : ControllerBase
{
    private readonly AtriumRhDbContext _db;
    private readonly IFileStorage _storage;

    public FuncionarioDocumentosController(AtriumRhDbContext db, IFileStorage storage)
    {
        _db = db;
        _storage = storage;
    }

    private int UsuarioLogadoId()
    {
        var raw = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return int.Parse(raw!);
    }

    private static readonly HashSet<string> ExtPermitidas = new(StringComparer.OrdinalIgnoreCase)
    { ".jpg", ".jpeg", ".png", ".pdf", ".doc", ".docx" };

    [HttpPost]
    [RequestSizeLimit(20_000_000)]
    public async Task<IActionResult> Upload(
        int funcionarioId,
        [FromQuery] int? pastaId,
        [FromForm] IFormFile file,          // ✅ importante
        CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            return BadRequest("Arquivo inválido.");

        var ext = Path.GetExtension(file.FileName);
        if (string.IsNullOrWhiteSpace(ext) || !ExtPermitidas.Contains(ext))
            return BadRequest("Extensão não permitida. Use JPG/PNG/PDF/DOC/DOCX.");

        var funcionarioExiste = await _db.Funcionarios.AnyAsync(x => x.Id == funcionarioId && x.Ativo, ct);
        if (!funcionarioExiste) return NotFound("Funcionário não encontrado.");

        if (pastaId.HasValue)
        {
            var pastaOk = await _db.FuncionarioPastas.AnyAsync(p =>
                p.Id == pastaId.Value && p.FuncionarioId == funcionarioId && p.Ativo, ct);

            if (!pastaOk) return BadRequest("Pasta inválida para este funcionário.");
        }

        var userId = UsuarioLogadoId();

        await using var stream = file.OpenReadStream();
        var storageKey = await _storage.SaveAsync(stream, file.FileName, file.ContentType, funcionarioId, ct);

        var doc = new FuncionarioDocumento
        {
            FuncionarioId = funcionarioId,
            PastaId = pastaId,

            NomeOriginal = file.FileName,
            Extensao = ext.ToLowerInvariant(),
            ContentType = file.ContentType,
            TamanhoBytes = file.Length,
            StorageKey = storageKey,

            Ativo = true,
            Criacao = DateTime.Now,
            UsuarioCriacaoId = userId,   // ✅
            UsuarioId = null,            // ✅
            DataSincronizacao = null,    // ✅
            DataInterface = null         // ✅
        };

        _db.FuncionarioDocumentos.Add(doc);
        await _db.SaveChangesAsync(ct);

        return Ok(new
        {
            doc.Id,
            doc.NomeOriginal,
            doc.Extensao,
            doc.TamanhoBytes,
            doc.Criacao,
            doc.PastaId
        });
    }

    [HttpGet]
    public async Task<IActionResult> List(int funcionarioId, [FromQuery] int? pastaId, CancellationToken ct)
    {
        var query = _db.FuncionarioDocumentos.AsNoTracking()
            .Where(d => d.FuncionarioId == funcionarioId && d.Ativo);

        if (pastaId.HasValue)
            query = query.Where(d => d.PastaId == pastaId.Value);

        var data = await query
            .OrderByDescending(d => d.Criacao)
            .Select(d => new
            {
                d.Id,
                d.NomeOriginal,
                d.Extensao,
                d.ContentType,
                d.TamanhoBytes,
                d.Criacao,
                d.PastaId
            })
            .ToListAsync(ct);

        return Ok(data);
    }

    [HttpGet("{docId:int}/download")]
    public async Task<IActionResult> Download(int funcionarioId, int docId, CancellationToken ct)
    {
        var doc = await _db.FuncionarioDocumentos.AsNoTracking()
            .FirstOrDefaultAsync(d => d.Id == docId && d.FuncionarioId == funcionarioId && d.Ativo, ct);

        if (doc is null) return NotFound();

        var (stream, contentType, fileName) = await _storage.OpenAsync(doc.StorageKey, doc.ContentType, doc.NomeOriginal, ct);
        return File(stream, contentType, fileName);
    }

    [HttpDelete("{docId:int}")]
    public async Task<IActionResult> SoftDelete(int funcionarioId, int docId, CancellationToken ct)
    {
        var doc = await _db.FuncionarioDocumentos
            .FirstOrDefaultAsync(d => d.Id == docId && d.FuncionarioId == funcionarioId, ct);

        if (doc is null) return NotFound();

        doc.Ativo = false;
        doc.Alteracao = DateTime.Now;
        doc.UsuarioId  = UsuarioLogadoId();

        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}
