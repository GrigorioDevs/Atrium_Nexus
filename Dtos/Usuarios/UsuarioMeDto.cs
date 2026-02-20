namespace Atrium.RH.Dtos.Usuarios;

public record UsuarioMeDto(
    int Id,
    string Nome,
    string Email,
    int TypeUser,
    string? UserImg
);