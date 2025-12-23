namespace Atrium.RH.Dtos.Auth;

public class LoginRequestDto
{
    public string? Cpf { get; set; }
    public string? Login { get; set; }
    public string Senha { get; set; } = "";
}
