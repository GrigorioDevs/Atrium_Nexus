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
            return BadRequest(new { message = "CPF inválido. Envie 11 dígitos." });

        var cpfExiste = await _db.Funcionarios.AnyAsync(x => x.Cpf == cpfDigits, ct);
        if (cpfExiste)
            return Conflict(new { message = "Já existe funcionário com este CPF." });

        const int usuarioCriacaoId = 1; // TODO: trocar por usuário logado quando tiver auth

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

            // Armazena storageKey (normalmente null ao criar)
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
        // ⚠️ Se você quiser listar inativos também, remova o .Where(x => x.Ativo)
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

                // devolve URL pública de foto (não a storageKey)
                fotoUrl = string.IsNullOrWhiteSpace(x.FotoUrl)
                    ? null
                    : $"/api/funcionarios/{x.Id}/foto"
            })
            .ToListAsync(ct);

        return Ok(data);
    }

    // ======================================================
    // GET /api/funcionarios/{id} (detalhe)
    // ======================================================
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id, CancellationToken ct)
    {
        var f = await _db.Funcionarios.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id, ct);

        if (f is null)
            return NotFound(new { message = "Funcionário não encontrado." });

        return Ok(new
        {
            f.Id,
            f.Nome,
            f.Cpf,
            f.Rg,
            f.Email,
            f.Celular,
            f.Funcao,
            f.Idade,
            f.TipoContrato,
            f.Ativo,
            f.DataAdmissao,

            f.Salario,
            f.TarifaVt,
            f.ValorDiarioVr,
            f.RecebeVt,
            f.RecebeVr,

            // URL pública da foto
            fotoUrl = string.IsNullOrWhiteSpace(f.FotoUrl)
                ? null
                : $"/api/funcionarios/{f.Id}/foto"
        });
    }

    // ======================================================
    // POST /api/funcionarios/{id}/foto (upload da foto)
    // multipart/form-data com campo: file
    // ======================================================
[HttpPost("{id:int}/foto")]
[RequestSizeLimit(50_000_000)] // 50MB (ou o que você quiser)
public async Task<IActionResult> UploadFoto(int id, [FromForm] IFormFile file, CancellationToken ct)

    {
        if (file is null || file.Length == 0)
            return BadRequest(new { message = "Arquivo inválido." });

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        var permitidas = new HashSet<string> { ".jpg", ".jpeg", ".png", ".webp", ".gif"};
        if (!permitidas.Contains(ext))
            return BadRequest(new { message = "Foto deve ser JPG/PNG/WEBP." });

        var func = await _db.Funcionarios.FirstOrDefaultAsync(x => x.Id == id && x.Ativo, ct);
        if (func is null)
            return NotFound(new { message = "Funcionário não encontrado." });

        await using var stream = file.OpenReadStream();
        var storageKey = await _storage.SaveAsync(stream, file.FileName, file.ContentType, id, ct);

        // guarda storageKey
        func.FotoUrl = storageKey;
        func.Alteracao = DateTime.Now;
        func.UsuarioId = 1; // TODO: trocar por usuário logado quando tiver auth

        await _db.SaveChangesAsync(ct);

        // retorna URL pública (pro front conseguir abrir)
        return Ok(new
        {
            storageKey, // opcional (debug)
            fotoUrl = $"/api/funcionarios/{func.Id}/foto"
        });
    }

    // ======================================================
    // GET /api/funcionarios/{id}/foto (serve a imagem)
    // ======================================================
    [HttpGet("{id:int}/foto")]
    public async Task<IActionResult> GetFoto(int id, CancellationToken ct)
    {
        var func = await _db.Funcionarios.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id && x.Ativo, ct);

        if (func is null || string.IsNullOrWhiteSpace(func.FotoUrl))
            return NotFound(new { message = "Foto não encontrada." });

        var (stream, contentType, fileName) =
            await _storage.OpenAsync(func.FotoUrl, "image/*", "foto", ct);

        return File(stream, contentType, fileName);
    }


    // ======================================================
    // GET /api/funcionarios/assinatura
    // ======================================================
    [HttpGet("{id:int}/assinatura")]
    public async Task<IActionResult> GetAssinatura(int id, CancellationToken ct)
    {
        var f = await _db.Funcionarios.AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new
            {
                x.Id,
                x.Nome,
                x.Funcao,
                x.Email,
                x.Celular,
                FotoUrl = string.IsNullOrWhiteSpace(x.FotoUrl)
                    ? null
                    : $"/api/funcionarios/{x.Id}/foto"
            })
            .FirstOrDefaultAsync(ct);

        if (f is null)
            return NotFound();

        return Ok(f);
}


}
