namespace Atrium.RH.Domain.Entities
{
    public class FuncionarioCurso
    {
        public int Id { get; set; }

        public int FuncionarioId { get; set; }
        public int CursoId { get; set; }

        public DateOnly DataConclusao { get; set; }  // OU DateTime
        public DateOnly? DataValidade { get; set; }  // OU DateTime?

        public bool Ativo { get; set; } = true;

        public DateTime Criacao { get; set; } = DateTime.Now;
        public DateTime? Alteracao { get; set; }

        public DateTime? DataSincronizacao { get; set; }
        public DateTime? DataInterface { get; set; }

        public int UsuarioCriacaoId { get; set; }
        public int? UsuarioId { get; set; }

        // Navegações (FKs do seu SQL)
        public Curso? Curso { get; set; }
        public Funcionario? Funcionario { get; set; }
    }
}
