namespace Atrium.RH.Domain.Entities
{
    public class Usuario
    {
        public int Id { get; set; }
        public string Nome { get; set; } = "";
        public string Login { get; set; } = "";
        public string Email { get; set; } = "";
        public string Cpf { get; set; } = "";
        public string Telefone { get; set; } = "";

        // ⚠️ guarde hash, nunca senha pura
        public string Senha { get; set; } = "";

        public int? LociId { get; set; }
        public DateTime? DataSincronizacao { get; set; }
        public DateTime? DataInterface { get; set; }

        public int TypeUser { get; set; } // 1 Admin, 2 Gestão, 3 ST/RH, 4 Funcionário
        public bool Ativo { get; set; } = true;

        public DateTimeOffset Criacao { get; set; } = DateTimeOffset.UtcNow;

        public string? UserImg { get; set; } // "/storage/usuarios/..../foto.jpg" por ex.
    }
}