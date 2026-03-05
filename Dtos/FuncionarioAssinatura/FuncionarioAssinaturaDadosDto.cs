namespace Atrium.RH.Dtos;

public sealed class FuncionarioAssinaturaDadosDto
{
    public int Id { get; set; }
    public string Nome { get; set; } = "";
    public string Funcao { get; set; } = "";
    public string Email { get; set; } = "";
    public string Celular { get; set; } = "";
    public string FotoUrl { get; set; } = "";
}