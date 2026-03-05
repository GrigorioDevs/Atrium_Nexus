using Atrium.RH.Domain.Enums;

namespace Atrium.RH.Domain.Entities
{
    public class Curso
    {
        public int Id { get; set; }
        public bool Ativo { get; set; } = true;

        public DateTime Criacao { get; set; } = DateTime.Now;
        public DateTime? Alteracao { get; set; }

        public DateTime? DataSincronizacao { get; set; }
        public DateTime? DataInterface { get; set; }

        public string Nome { get; set; } = "";
        public int? CargaHoraria { get; set; }

        public CursoCategoria Categoria { get; set; }

        public string? Observacao { get; set; }
        public string? Descricao { get; set; }

        public int UsuarioCriacaoId { get; set; }
        public int? UsuarioId { get; set; }

        // ✅ NECESSÁRIO para o DbContext: WithMany(x => x.FuncionariosCursos)
        public ICollection<FuncionarioCurso> FuncionariosCursos { get; set; } = new List<FuncionarioCurso>();
    }
}
