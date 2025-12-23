using System.ComponentModel.DataAnnotations;
using Atrium.RH.Validation;

namespace Atrium.RH.Dtos.Funcionarios;

public class FuncionarioCreateDto
{
    [Required]
    [MaxLength(120)]
    public string Nome { get; set; } = null!;

    [Required]
    [Cpf] // ✅ valida mesmo se vier com máscara
    public string Cpf { get; set; } = null!;

    [MaxLength(20)]
    public string? Rg { get; set; }

    [MaxLength(180)]
    public string? Email { get; set; }

    [MaxLength(20)]
    public string? Celular { get; set; }

    [Required]
    [MaxLength(120)]
    public string Funcao { get; set; } = null!;

    public int? Idade { get; set; }
    public DateTime? DataAdmissao { get; set; }

    public decimal? Salario { get; set; }
    public decimal? TarifaVt { get; set; }
    public decimal? ValorDiarioVr { get; set; }

    public bool RecebeVt { get; set; }
    public bool RecebeVr { get; set; }

    [Required]
    public byte TipoContrato { get; set; } // 1=CLT, 2=PJ

    [MaxLength(300)]
    public string? FotoUrl { get; set; }
}
