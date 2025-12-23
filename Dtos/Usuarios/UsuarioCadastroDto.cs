using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace Atrium.RH.DTOs.Usuarios
{
    public class UsuarioCadastroDto
    {
        [Required]
        public string Nome { get; set; } = string.Empty;

        // "Nome Login" do seu formulário
        [Required]
        public string Login { get; set; } = string.Empty;

        [Required, EmailAddress]
        public string Email { get; set; } = string.Empty;

        // No front pode vir com máscara, no back você normaliza (somente dígitos)
        [Required]
        public string Cpf { get; set; } = string.Empty;

        [Required]
        public string Telefone { get; set; } = string.Empty;

        [Required, MinLength(6)]
        public string Senha { get; set; } = string.Empty;

        [Required]
        [Compare(nameof(Senha), ErrorMessage = "A confirmação de senha não confere.")]
        public string ConfirmarSenha { get; set; } = string.Empty;

        // 1 Admin, 2 Gestão, 3 ST, 4 Funcionário
        [Range(1, 4, ErrorMessage = "Perfil inválido (1 a 4).")]
        public int TypeUser { get; set; }
    }
}
