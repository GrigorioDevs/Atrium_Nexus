using System;

namespace Atrium.RH.Domain.Entities
{
    public class PontoRegistro
    {
        public int Id { get; set; }
        public int UsuarioId { get; set; }

        public DateTime Criacao { get; set; }              // DATETIME2(0)
        public DateTime? DataSincronizacao { get; set; }   // DATETIME2(0) NULL
        public DateTime? DataInterface { get; set; }       // DATETIME2(0) NULL

        public DateTime DataLocal { get; set; }            // DATE
        public byte Tipo { get; set; }                     // tinyint (1 = entrada, 2 = saída)
        public byte Origem { get; set; }                   // tinyint

        public decimal? Latitude { get; set; }             // decimal(9,6)
        public decimal? Longitude { get; set; }            // decimal(9,6)

        public string? Ip { get; set; }
        public string? DeviceInfo { get; set; }
        public string? Observacao { get; set; }

        public int? CriadoPorId { get; set; }

        // Navegação opcional
        public Usuario? Usuario { get; set; }
    }
}
