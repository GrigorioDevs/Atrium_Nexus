using Atrium.RH.Dtos.FuncionarioCursos;

namespace Atrium.RH.Services.FuncionarioCursos
{
    public interface IFuncionarioCursoService
    {
        Task<List<FuncionarioCursoDto>> ListarPorFuncionarioAsync(int funcionarioId, CancellationToken ct);
        Task<FuncionarioCursoDto> VincularAsync(FuncionarioCursoCreateDto dto, int usuarioId, CancellationToken ct);

        Task<FuncionarioCursoDto?> AtualizarAsync(int vinculoId, FuncionarioCursoUpdateDto dto, int usuarioId, CancellationToken ct);
        Task<bool> InativarAsync(int vinculoId, int usuarioId, CancellationToken ct);
    }
}
