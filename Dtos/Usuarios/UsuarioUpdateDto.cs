namespace Atrium.RH.Dtos.Usuarios
{
    public class UsuarioUpdateDto
    {
        public string Login { get; set; } = "";
        public string Email { get; set; } = "";
        public string Cpf { get; set; } = "";
        public string Telefone { get; set; } = "";
        public int TypeUser { get; set; }
        public bool Ativo { get; set; }

        public string? Senha { get; set; }
        public string? ConfirmarSenha { get; set; }
    }
}