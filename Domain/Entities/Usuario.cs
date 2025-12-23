using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Atrium.RH.Domain.Entities
{
    public class Usuario
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        public int LociId { get; set; } = 1;
        public bool Ativo { get; set; } = true;
        public DateTimeOffset Criacao { get; set; }
        public DateTimeOffset? DataSincronizacao { get; set; }
        public DateTimeOffset? DataInterface { get; set; }

        public string Cpf { get; set; } = "";
        public string Nome { get; set; } = "";
        public string Email { get; set; } = "";
        public string Login { get; set; } = "";
        public string Senha { get; set; } = "";
        public string Telefone { get; set; } = "";
        public int TypeUser { get; set; }
        public string? UserImg { get; set; } = null;
    }
}
