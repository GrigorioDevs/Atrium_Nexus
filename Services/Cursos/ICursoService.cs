using Atrium.RH.Dtos.Cursos;

namespace Atrium.RH.Services.Cursos
{
    public interface ICursoService
    {
        Task<List<CursoDto>> ListarAsync(CancellationToken ct);
        Task<CursoDto?> ObterAsync(int id, CancellationToken ct);
        Task<CursoDto> CriarAsync(CursoCreateUpdateDto dto, int usuarioId, CancellationToken ct);
        Task<CursoDto?> AtualizarAsync(int id, CursoCreateUpdateDto dto, int usuarioId, CancellationToken ct);
        Task<bool> InativarAsync(int id, int usuarioId, CancellationToken ct);
    }
}
