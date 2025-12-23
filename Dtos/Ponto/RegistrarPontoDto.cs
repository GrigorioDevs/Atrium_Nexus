using System.ComponentModel.DataAnnotations;

namespace Atrium.RH.Dtos.Ponto
{
    public class RegistrarPontoDto
    {
        [Required]
        public int UsuarioId { get; set; }     // ID do usuário (tabela usuario)

        [Required]
        public string DataLocal { get; set; } = ""; // "2025-01-19" (YYYY-MM-DD)

        [Required]
        public string Hora { get; set; } = "";      // "08:00" (HH:mm)

        /// <summary>
        /// 1 = entrada, 2 = saída
        /// </summary>
        [Range(1, 2)]
        public byte Tipo { get; set; }

        /// <summary>
        /// 1=normal, 2=ajuste gestor, 3=ajuste próprio, 4=importado
        /// </summary>
        [Range(1, 4)]
        public byte Origem { get; set; } = 3;

        public decimal? Latitude { get; set; }
        public decimal? Longitude { get; set; }

        public string? Observacao { get; set; }
    }
}
