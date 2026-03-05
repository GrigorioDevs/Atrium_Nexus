using Atrium.RH.Data;
using Atrium.RH.Domain.Entities;
using Atrium.RH.Dtos.FuncionarioCursos;
using Microsoft.EntityFrameworkCore;

namespace Atrium.RH.Services.FuncionarioCursos
{
    public class FuncionarioCursoService : IFuncionarioCursoService
    {
        private readonly AtriumRhDbContext _db;

        public FuncionarioCursoService(AtriumRhDbContext db)
        {
            _db = db;
        }

        public async Task<List<FuncionarioCursoDto>> ListarPorFuncionarioAsync(int funcionarioId, CancellationToken ct)
        {
            var itens = await _db.FuncionarioCursos
                .AsNoTracking()
                .Include(x => x.Curso)
                .Where(x => x.FuncionarioId == funcionarioId && x.Ativo)
                .OrderByDescending(x => x.Id)
                .ToListAsync(ct);

            return itens.Select(x => new FuncionarioCursoDto
            {
                Id = x.Id,
                FuncionarioId = x.FuncionarioId,
                CursoId = x.CursoId,
                DataConclusao = x.DataConclusao,
                DataValidade = x.DataValidade,
                CursoNome = x.Curso?.Nome ?? "",
                CursoCategoria = x.Curso?.Categoria.ToString() ?? ""
            }).ToList();
        }

        public async Task<FuncionarioCursoDto> VincularAsync(FuncionarioCursoCreateDto dto, int usuarioId, CancellationToken ct)
        {
            var existeCurso = await _db.Cursos.AnyAsync(c => c.Id == dto.CursoId, ct);
            if (!existeCurso) throw new ArgumentException("CursoId não existe.");

            var existeFunc = await _db.Funcionarios.AnyAsync(f => f.Id == dto.FuncionarioId, ct);
            if (!existeFunc) throw new ArgumentException("FuncionarioId não existe.");

            var e = new FuncionarioCurso
            {
                FuncionarioId = dto.FuncionarioId,
                CursoId = dto.CursoId,

                DataConclusao = dto.DataConclusao,
                DataValidade  = dto.DataValidade,

                UsuarioCriacaoId = usuarioId,
                UsuarioId = null,
                Criacao = DateTime.Now,
                Ativo = true
            };

            _db.FuncionarioCursos.Add(e);
            await _db.SaveChangesAsync(ct);

            // retorna com dados do curso
            var curso = await _db.Cursos
                .AsNoTracking()
                .FirstAsync(x => x.Id == dto.CursoId, ct);

            return new FuncionarioCursoDto
            {
                Id = e.Id,
                FuncionarioId = e.FuncionarioId,
                CursoId = e.CursoId,
                DataConclusao = e.DataConclusao,
                DataValidade = e.DataValidade,
                CursoNome = curso.Nome,
                CursoCategoria = curso.Categoria.ToString()
            };
        }

        public async Task<FuncionarioCursoDto?> AtualizarAsync(int vinculoId, FuncionarioCursoUpdateDto dto, int usuarioId, CancellationToken ct)
        {
            var e = await _db.FuncionarioCursos
                .Include(x => x.Curso)
                .FirstOrDefaultAsync(x => x.Id == vinculoId, ct);

            if (e == null) return null;
            if (!e.Ativo) return null; // opcional: não editar inativo

            // ✅ CORREÇÃO: Entity usa DateOnly/DateOnly?, DTO vem DateTime/DateTime?
            e.DataConclusao = DateOnly.FromDateTime(dto.DataConclusao);
            e.DataValidade = dto.DataValidade.HasValue
                ? DateOnly.FromDateTime(dto.DataValidade.Value)
                : null;

            // auditoria
            e.UsuarioId = usuarioId;
            // e.Alteracao = DateTime.Now; // se existir no seu model

            await _db.SaveChangesAsync(ct);

            return new FuncionarioCursoDto
            {
                Id = e.Id,
                FuncionarioId = e.FuncionarioId,
                CursoId = e.CursoId,
                DataConclusao = e.DataConclusao,
                DataValidade = e.DataValidade,
                CursoNome = e.Curso?.Nome ?? "",
                CursoCategoria = e.Curso?.Categoria.ToString() ?? ""
            };
        }

        public async Task<bool> InativarAsync(int vinculoId, int usuarioId, CancellationToken ct)
        {
            var e = await _db.FuncionarioCursos
                .FirstOrDefaultAsync(x => x.Id == vinculoId, ct);

            if (e == null) return false;

            // idempotente: se já estiver inativo, considera ok
            if (!e.Ativo) return true;

            e.Ativo = false;

            // auditoria
            e.UsuarioId = usuarioId;
            // e.Alteracao = DateTime.Now; // se existir

            await _db.SaveChangesAsync(ct);
            return true;
        }
    }
}
