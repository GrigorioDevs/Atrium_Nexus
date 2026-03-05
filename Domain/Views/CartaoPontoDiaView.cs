namespace Atrium.RH.Domain.Views
{
    // Representa UMA linha da vw_cartao_ponto (um dia do cartão)
    public class CartaoPontoDiaView
    {
        public int UsuarioId { get; set; }
        public string Nome { get; set; } = "";
        public string Login { get; set; } = "";
        public string Email { get; set; } = "";
        public string Telefone { get; set; } = "";
        public string Cpf { get; set; } = "";
        public int TypeUser { get; set; }
        public string? UserImg { get; set; }

        public DateTime DataLocal { get; set; }

        public DateTime? Entrada1 { get; set; }
        public DateTime? Saida1   { get; set; }
        public DateTime? Entrada2 { get; set; }
        public DateTime? Saida2   { get; set; }
        public DateTime? Entrada3 { get; set; }
        public DateTime? Saida3   { get; set; }
    }
}
