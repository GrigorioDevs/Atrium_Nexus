using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Atrium.RH.Data.Entities;

[Table("documentos_templates")]
public class DocumentoTemplate
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; }

    [Column("nome")]
    [MaxLength(150)]
    public string Nome { get; set; } = null!;

    [Column("html")]
    public string Html { get; set; } = null!;

    [Column("layout_json")]
    public string? LayoutJson { get; set; }

    [Column("datacriacao")]
    public DateTime DataCriacao { get; set; }

    [Column("usuariocriacaoid")]
    public int UsuarioCriacaoId { get; set; }

    [Column("usuarioid")]
    public int UsuarioId { get; set; } // último editor

    [Column("alteracao")]
    public DateTime Alteracao { get; set; }

    [Column("datainterface")]
    public DateTime? DataInterface { get; set; }

    [Column("datasincronizacao")]
    public DateTime? DataSincronizacao { get; set; }

    [Column("ativo")]
    public bool Ativo { get; set; } = true;

    [Timestamp]
    [Column("rowver")]
    public byte[] Rowver { get; set; } = Array.Empty<byte>();
}