using System.ComponentModel.DataAnnotations;

namespace Atrium.RH.Dtos.Usuarios
{
    public class UsuarioCadastroDto
    {
        [Required(ErrorMessage = "Login é obrigatório.")]
        [StringLength(80, MinimumLength = 3, ErrorMessage = "Login deve ter entre 3 e 80 caracteres.")]
        public string Login { get; set; } = string.Empty;

        [Required(ErrorMessage = "Email é obrigatório.")]
        [EmailAddress(ErrorMessage = "Email inválido.")]
        [StringLength(180)]
        public string Email { get; set; } = string.Empty;

        [Required(ErrorMessage = "CPF é obrigatório.")]
        [StringLength(14, MinimumLength = 11, ErrorMessage = "CPF inválido.")]
        public string Cpf { get; set; } = string.Empty;

        [Required(ErrorMessage = "Telefone é obrigatório.")]
        [StringLength(20, MinimumLength = 8, ErrorMessage = "Telefone inválido.")]
        public string Telefone { get; set; } = string.Empty;

        [Required(ErrorMessage = "Senha é obrigatória.")]
        [StringLength(64, MinimumLength = 6, ErrorMessage = "Senha deve ter no mínimo 6 caracteres.")]
        public string Senha { get; set; } = string.Empty;

        [Required(ErrorMessage = "Confirmar senha é obrigatório.")]
        [Compare(nameof(Senha), ErrorMessage = "As senhas não conferem.")]
        public string ConfirmarSenha { get; set; } = string.Empty;

        // 1 Admin, 2 User Gestão, 3 User ST, 4 User Funcionário
        [Range(1, 4, ErrorMessage = "Perfil inválido.")]
        public int TypeUser { get; set; }
    }
}
