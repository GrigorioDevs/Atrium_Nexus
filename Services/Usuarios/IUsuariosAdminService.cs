using Atrium.RH.Dtos.Usuarios;

namespace Atrium.RH.Services.Usuarios
{
    public interface IUsuariosAdminService
    {
        Task<List<UsuarioListItemDto>> ListAsync(string? search, int take, CancellationToken ct);
        Task<UsuarioDetalheDto?> GetByIdAsync(int id, CancellationToken ct);
        Task<int> CreateAsync(UsuarioCadastroDto dto, CancellationToken ct);
        Task UpdateAsync(int id, UsuarioUpdateDto dto, CancellationToken ct);
    }
}