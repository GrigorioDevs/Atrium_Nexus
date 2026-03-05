using System.ComponentModel.DataAnnotations;

namespace Atrium.RH.Dtos.DocumentoTemplates;

public class DocumentoTemplateCreateRequestDto
{
    [Required, MaxLength(150)]
    public string Nome { get; set; } = "";

    [Required]
    public string Html { get; set; } = "";

    public string? LayoutJson { get; set; }
}