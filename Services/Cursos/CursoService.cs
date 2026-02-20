using Atrium.RH.Data;
using Atrium.RH.Domain.Entities;
using Atrium.RH.Domain.Enums;
using Atrium.RH.Dtos.Cursos;
using Microsoft.EntityFrameworkCore;

namespace Atrium.RH.Services.Cursos
{
    public class CursoService : ICursoService
    {
        private readonly AtriumRhDbContext _db;

        public CursoService(AtriumRhDbContext db)
        {
            _db = db;
        }

        public async Task<List<CursoDto>> ListarAsync(CancellationToken ct)
        {
            var itens = await _db.Cursos
                .AsNoTracking()
                .OrderByDescending(x => x.Id)
                .ToListAsync(ct);

            return itens.Select(MapToDto).ToList();
        }

        public async Task<CursoDto?> ObterAsync(int id, CancellationToken ct)
        {
            var e = await _db.Cursos.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
            return e == null ? null : MapToDto(e);
        }

        public async Task<CursoDto> CriarAsync(CursoCreateUpdateDto dto, int usuarioId, CancellationToken ct)
        {
            var cat = ParseCategoria(dto.Categoria);

            var e = new Curso
            {
                Nome = dto.Nome.Trim(),
                CargaHoraria = dto.CargaHoraria,
                Categoria = cat,
                Observacao = dto.Observacao,
                Descricao = dto.Descricao,
                UsuarioCriacaoId = usuarioId,
                UsuarioId = null,
                Criacao = DateTime.Now,
                Alteracao = DateTime.Now
            };

            _db.Cursos.Add(e);
            await _db.SaveChangesAsync(ct);

            return MapToDto(e);
        }

        public async Task<CursoDto?> AtualizarAsync(int id, CursoCreateUpdateDto dto, int usuarioId, CancellationToken ct)
        {
            var e = await _db.Cursos.FirstOrDefaultAsync(x => x.Id == id, ct);
            if (e == null) return null;

            e.Nome = dto.Nome.Trim();
            e.CargaHoraria = dto.CargaHoraria;
            e.Categoria = ParseCategoria(dto.Categoria);
            e.Observacao = dto.Observacao;
            e.Descricao = dto.Descricao;
            e.UsuarioId = usuarioId;
            e.Alteracao = DateTime.Now;

            await _db.SaveChangesAsync(ct);
            return MapToDto(e);
        }

        private static CursoCategoria ParseCategoria(string value)
        {
            if (string.IsNullOrWhiteSpace(value))
                throw new ArgumentException("Categoria é obrigatória.");

            if (!Enum.TryParse<CursoCategoria>(value.Trim(), ignoreCase: true, out var cat))
                throw new ArgumentException($"Categoria inválida: '{value}'. Use: TECNICO, SEGURANCA, ADMINISTRATIVO, OUTROS.");

            return cat;
        }

        private static CursoDto MapToDto(Curso e) => new()
        {
            Id = e.Id,
            Ativo = e.Ativo,
            Criacao = e.Criacao,
            Nome = e.Nome,
            CargaHoraria = e.CargaHoraria,
            Categoria = e.Categoria.ToString(),
            Observacao = e.Observacao,
            Descricao = e.Descricao
        };
    
        public async Task<bool> InativarAsync(int id, int usuarioId, CancellationToken ct)
        {
            var e = await _db.Cursos.FirstOrDefaultAsync(x => x.Id == id, ct);
            if (e == null) return false;

            if (!e.Ativo) return true; // idempotente

            e.Ativo = false;
            e.UsuarioId = usuarioId;         // se você controla auditoria
            e.Alteracao = DateTime.Now;      // se existe esse campo

            await _db.SaveChangesAsync(ct);
            return true;
        }

    }
}
