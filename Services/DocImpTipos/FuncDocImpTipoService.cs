using Atrium.RH.Data;
using Atrium.RH.Domain.Entities;
using Atrium.RH.Dtos.DocImpTipos;
using Microsoft.EntityFrameworkCore;

namespace Atrium.RH.Services.DocImpTipos;

public class FuncDocImpTipoService : IFuncDocImpTipoService
{
    private readonly AtriumRhDbContext _db;

    public FuncDocImpTipoService(AtriumRhDbContext db)
    {
        _db = db;
    }

    public async Task<List<FuncDocImpTipoListItemDto>> ListAtivos(CancellationToken ct)
    {
        return await _db.FuncDocImpTipos
            .AsNoTracking()
            .Where(x => x.Ativo)
            .OrderBy(x => x.Nome)
            .Select(x => new FuncDocImpTipoListItemDto
            {
                Id = x.Id,
                Nome = x.Nome
            })
            .ToListAsync(ct);
    }

    public async Task<FuncDocImpTipoListItemDto> Create(string nome, int usuarioCriacaoId, CancellationToken ct)
    {
        nome = (nome ?? "").Trim();
        if (string.IsNullOrWhiteSpace(nome))
            throw new InvalidOperationException("Nome do tipo é obrigatório.");

        // evita bater no índice unique com erro feio
        var exists = await _db.FuncDocImpTipos
            .AnyAsync(x => x.Ativo && x.Nome == nome, ct);

        if (exists)
            throw new InvalidOperationException("Já existe um tipo ativo com esse nome.");

        var entity = new FuncDocImpTipo
        {
            Nome = nome,
            Ativo = true,
            UsuarioCriacaoId = usuarioCriacaoId,
            // Criacao tem default no banco, mas pode setar também se quiser:
            Criacao = DateTime.Now
        };

        _db.FuncDocImpTipos.Add(entity);
        await _db.SaveChangesAsync(ct);

        return new FuncDocImpTipoListItemDto { Id = entity.Id, Nome = entity.Nome };
    }

    public async Task<FuncDocImpTipoListItemDto> Rename(int id, string nome, int usuarioId, CancellationToken ct)
    {
        nome = (nome ?? "").Trim();
        if (string.IsNullOrWhiteSpace(nome))
            throw new InvalidOperationException("Nome do tipo é obrigatório.");

        var entity = await _db.FuncDocImpTipos.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity == null)
            throw new InvalidOperationException("Tipo não encontrado.");

        if (!entity.Ativo)
            throw new InvalidOperationException("Tipo está inativo. Reative ou crie outro.");

        var exists = await _db.FuncDocImpTipos
            .AnyAsync(x => x.Ativo && x.Id != id && x.Nome == nome, ct);

        if (exists)
            throw new InvalidOperationException("Já existe outro tipo ativo com esse nome.");

        entity.Nome = nome;
        entity.UsuarioId = usuarioId;
        entity.Alteracao = DateTime.Now;

        await _db.SaveChangesAsync(ct);

        return new FuncDocImpTipoListItemDto { Id = entity.Id, Nome = entity.Nome };
    }

    public async Task Inativar(int id, int usuarioId, CancellationToken ct)
    {
        var entity = await _db.FuncDocImpTipos.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity == null)
            throw new InvalidOperationException("Tipo não encontrado.");

        if (!entity.Ativo) return; // já inativo

        entity.Ativo = false;
        entity.UsuarioId = usuarioId;
        entity.Alteracao = DateTime.Now;

        await _db.SaveChangesAsync(ct);
    }
}
