namespace Atrium.RH.Dtos.DocumentoTemplates;

public class DocumentoTemplateDetailDto
{
    public Guid Id { get; set; }
    public string Nome { get; set; } = "";
    public string Html { get; set; } = "";
    public string? LayoutJson { get; set; }

    // auditoria
    public DateTime DataCriacao { get; set; }
    public int UsuarioCriacaoId { get; set; }

    public DateTime Alteracao { get; set; }
    public int UsuarioId { get; set; } // último editor

    // devem ficar null (mas devolvemos se existirem)
    public DateTime? DataInterface { get; set; }
    public DateTime? DataSincronizacao { get; set; }

    public bool Ativo { get; set; }
}