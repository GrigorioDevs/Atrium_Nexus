namespace Atrium.RH.Dtos.Usuarios
{
    public class UsuarioListItemDto
    {
        public int Id { get; set; }
        public string Nome { get; set; } = "";
        public string Login { get; set; } = "";
        public string Email { get; set; } = "";
        public int TypeUser { get; set; }
        public bool Ativo { get; set; }
    }
}