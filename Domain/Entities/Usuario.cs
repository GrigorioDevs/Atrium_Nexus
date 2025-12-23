using System;

namespace Atrium.RH.Domain.Entities
{
    public class Usuario
    {
        public int Id { get; set; }
        public int LociId { get; set; } = 1;
        public bool Ativo { get; set; } = true;

        // recomendação: usar DateTimeOffset para armazenar GMT corretamente
        public DateTimeOffset Criacao { get; set; }

        public DateTimeOffset? DataSincronizacao { get; set; }
        public DateTimeOffset? DataInterface { get; set; }

        public string Cpf { get; set; } = "";          // só dígitos (11)
        public string Nome { get; set; } = "";
        public string Email { get; set; } = "";
        public string Login { get; set; } = "";
        public string Senha { get; set; } = "";        // hash sha256 (hex)
        public string Telefone { get; set; } = "";     // só dígitos
        public int TypeUser { get; set; }              // 1..4

        public string? UserImg { get; set; } = null;
    }
}
