using Atrium.RH.Dtos.Usuarios;
using Microsoft.AspNetCore.Http;

namespace Atrium.RH.Services.Usuarios;

public interface IUsuarioPerfilService
{
    Task<UsuarioMeDto> GetMeAsync(CancellationToken ct);
    Task<UploadAvatarResponseDto> UploadAvatarAsync(IFormFile file, CancellationToken ct);
}