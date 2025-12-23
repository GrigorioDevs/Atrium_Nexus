namespace Atrium.RH.Domain.Entities;

public class FuncionarioDocumento
{
    public int Id { get; set; }
    public int LociId { get; set; } = 1;

    public int FuncionarioId { get; set; }
    public int? PastaId { get; set; }

    public bool Ativo { get; set; } = true;
    public DateTime Criacao { get; set; }
    public DateTime? Alteracao { get; set; }

    public DateTime? DataSincronizacao { get; set; }
    public DateTime? DataInterface { get; set; }

    public int UsuarioCriacaoId { get; set; }
    public int? UsuarioId { get; set; }

    public string NomeOriginal { get; set; } = null!;
    public string Extensao { get; set; } = null!;
    public string ContentType { get; set; } = null!;
    public long TamanhoBytes { get; set; }

    public string StorageKey { get; set; } = null!;
    public string? HashSha256 { get; set; }

    // ✅ Navigation Properties (para o EF)
    public Funcionario? Funcionario { get; set; }
    public FuncionarioPasta? Pasta { get; set; }
}
