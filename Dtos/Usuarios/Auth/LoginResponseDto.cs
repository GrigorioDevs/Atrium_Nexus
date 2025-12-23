namespace Atrium.RH.Dtos.Auth;

public class LoginResponseDto
{
    public int Id { get; set; }
    public string Nome { get; set; } = "";
    public string Login { get; set; } = "";
    public string Email { get; set; } = "";
    public int TypeUser { get; set; }
    public string? Telefone { get; set; }
}
