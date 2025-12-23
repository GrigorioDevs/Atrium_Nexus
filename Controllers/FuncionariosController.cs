using System.Text.RegularExpressions;
using Atrium.RH.Data;
using Atrium.RH.Domain.Entities;
using Atrium.RH.Dtos.Funcionarios;
using Atrium.RH.Services.Storage;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Atrium.RH.Controllers;

[ApiController]
[Route("api/funcionarios")]
public class FuncionariosController : ControllerBase
{
    private readonly AtriumRhDbContext _db;
    private readonly IFileStorage _storage;

    public FuncionariosController(AtriumRhDbContext db, IFileStorage storage)
    {
        _db = db;
        _storage = storage;
    }

    // ======================================================
    // POST /api/funcionarios (cria o cadastro)
    // ======================================================
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] FuncionarioCreateDto dto, CancellationToken ct)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var cpfDigits = Regex.Replace(dto.Cpf ?? "", @"\D", "");
        if (cpfDigits.Length != 11)
            return BadRequest("CPF inválido. Envie 11 dígitos.");

        var cpfExiste = await _db.Funcionarios.AnyAsync(x => x.Cpf == cpfDigits, ct);
        if (cpfExiste) return Conflict("Já existe funcionário com este CPF.");

        const int usuarioCriacaoId = 1;

        var f = new Funcionario
        {
            Nome = dto.Nome.Trim(),
            Cpf = cpfDigits,
            Rg = dto.Rg?.Trim(),
            Email = dto.Email?.Trim(),
            Celular = dto.Celular?.Trim(),
            Funcao = dto.Funcao.Trim(),
            Idade = dto.Idade,
            DataAdmissao = dto.DataAdmissao,

            Salario = dto.Salario,
            TarifaVt = dto.TarifaVt,
            ValorDiarioVr = dto.ValorDiarioVr,
            RecebeVt = dto.RecebeVt,
            RecebeVr = dto.RecebeVr,

            TipoContrato = dto.TipoContrato,

            // ✅ mantenha como storageKey (normalmente null ao criar)
            FotoUrl = dto.FotoUrl,

            Ativo = true,
            Criacao = DateTime.Now,
            Alteracao = null,

            UsuarioCriacaoId = usuarioCriacaoId,
            UsuarioId = null,

            DataSincronizacao = null,
            DataInterface = null
        };

        _db.Funcionarios.Add(f);
        await _db.SaveChangesAsync(ct);

        return Ok(new { id = f.Id });
    }

    // ======================================================
    // GET /api/funcionarios?q=bruno (lista)
    // ======================================================
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? q, CancellationToken ct)
    {
        var query = _db.Funcionarios.AsNoTracking().Where(x => x.Ativo);

        if (!string.IsNullOrWhiteSpace(q))
            query = query.Where(x => x.Nome.Contains(q) || x.Cpf.Contains(q));

        var data = await query
            .OrderBy(x => x.Nome)
            .Select(x => new
            {
                x.Id,
                x.Nome,
                x.Cpf,
                x.Email,
                x.Celular,
                x.Funcao,
                x.TipoContrato,
                x.Ativo,

                // ✅ AQUI ESTÁ A CORREÇÃO:
                // Em vez de devolver storageKey (x.FotoUrl),
                // devolve uma URL pública que o navegador consegue abrir.
                fotoUrl = string.IsNullOrWhiteSpace(x.FotoUrl)
                    ? null
                    : $"/api/funcionarios/{x.Id}/foto"
            })
            .ToListAsync(ct);

        return Ok(data);
    }

    // ======================================================
    // POST /api/funcionarios/{id}/foto (upload da foto)
    // multipart/form-data com campo: file
    // ======================================================
    [HttpPost("{id:int}/foto")]
    [RequestSizeLimit(10_000_000)] // 10MB
    public async Task<IActionResult> UploadFoto(int id, [FromForm] IFormFile file, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            return BadRequest("Arquivo inválido.");

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        var permitidas = new HashSet<string> { ".jpg", ".jpeg", ".png", ".webp" };
        if (!permitidas.Contains(ext))
            return BadRequest("Foto deve ser JPG/PNG/WEBP.");

        var func = await _db.Funcionarios.FirstOrDefaultAsync(x => x.Id == id && x.Ativo, ct);
        if (func is null) return NotFound("Funcionário não encontrado.");

        await using var stream = file.OpenReadStream();
        var storageKey = await _storage.SaveAsync(stream, file.FileName, file.ContentType, id, ct);

        // ✅ Continua guardando a storageKey no banco (correto)
        func.FotoUrl = storageKey;
        func.Alteracao = DateTime.Now;
        func.UsuarioId = 1; // temporário até auth

        await _db.SaveChangesAsync(ct);

        // ✅ AQUI ESTÁ A CORREÇÃO:
        // Retorna a URL pública, não a storageKey
        return Ok(new
        {
            storageKey = storageKey, // opcional (debug)
            fotoUrl = $"/api/funcionarios/{func.Id}/foto"
        });
    }

    // ======================================================
    // GET /api/funcionarios/{id}/foto (download/serve)
    // ======================================================
    [HttpGet("{id:int}/foto")]
    public async Task<IActionResult> GetFoto(int id, CancellationToken ct)
    {
        var func = await _db.Funcionarios.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id && x.Ativo, ct);

        if (func is null || string.IsNullOrWhiteSpace(func.FotoUrl))
            return NotFound("Foto não encontrada.");

        // Usa o OpenAsync do seu storage
        var (stream, contentType, fileName) =
            await _storage.OpenAsync(func.FotoUrl, "image/*", "foto", ct);

        return File(stream, contentType, fileName);
    }
}
