namespace Atrium.RH.Domain.Entities;

public class Funcionario
{
    public int Id { get; set; }
    public int LociId { get; set; } = 1;

    public bool Ativo { get; set; } = true;
    public DateTime Criacao { get; set; }
    public DateTime? Alteracao { get; set; }

    public DateTime? DataSincronizacao { get; set; }
    public DateTime? DataInterface { get; set; }

    public int UsuarioCriacaoId { get; set; }
    public int? UsuarioId { get; set; }

    public string Nome { get; set; } = null!;
    public string Cpf { get; set; } = null!;
    public string? Rg { get; set; }

    public string? Email { get; set; }
    public string? Celular { get; set; }

    public string? Funcao { get; set; }
    public int? Idade { get; set; }
    public DateTime? DataAdmissao { get; set; }

    public decimal? Salario { get; set; }
    public decimal? TarifaVt { get; set; }
    public decimal? ValorDiarioVr { get; set; }

    public bool RecebeVt { get; set; }
    public bool RecebeVr { get; set; }

    public byte TipoContrato { get; set; }
    public string? FotoUrl { get; set; }
}
