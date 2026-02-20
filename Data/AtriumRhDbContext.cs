using Atrium.RH.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Atrium.RH.Data
{
    public class AtriumRhDbContext : DbContext
    {
        public AtriumRhDbContext(DbContextOptions<AtriumRhDbContext> options) : base(options) { }

        // ===== Existentes =====
        public DbSet<Usuario> Usuarios => Set<Usuario>();
        public DbSet<PontoRegistro> PontoRegistros => Set<PontoRegistro>();

        // View (somente leitura)
        public DbSet<CartaoPontoView> CartaoPonto => Set<CartaoPontoView>();

        // Documentos imp tipos
        public DbSet<FuncDocImpTipo> FuncDocImpTipos => Set<FuncDocImpTipo>();

        // ===== RH =====
        public DbSet<Funcionario> Funcionarios => Set<Funcionario>();
        public DbSet<FuncionarioPasta> FuncionarioPastas => Set<FuncionarioPasta>();
        public DbSet<FuncionarioDocumento> FuncionarioDocumentos => Set<FuncionarioDocumento>();

        // ===== CURSOS =====
        public DbSet<Curso> Cursos => Set<Curso>();
        public DbSet<FuncionarioCurso> FuncionarioCursos => Set<FuncionarioCurso>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // ======================================================
            // USUÁRIO
            // ======================================================
            modelBuilder.Entity<Usuario>(u =>
            {
                u.ToTable("usuario");
                u.HasKey(x => x.Id);

                u.Property(x => x.Id).HasColumnName("Id").ValueGeneratedOnAdd();
                u.Property(x => x.LociId).HasColumnName("lociid").HasDefaultValue(1);
                u.Property(x => x.Ativo).HasColumnName("ativo").HasDefaultValue(true);

                // DATETIME2(0)
                u.Property(x => x.Criacao).HasColumnName("criacao").HasPrecision(0);
                u.Property(x => x.DataSincronizacao).HasColumnName("datasincronizacao").HasPrecision(0);
                u.Property(x => x.DataInterface).HasColumnName("datainterface").HasPrecision(0);

                u.Property(x => x.Cpf).HasColumnName("cpf").HasMaxLength(11).IsRequired();
                u.Property(x => x.Nome).HasColumnName("nome").HasMaxLength(120).IsRequired();
                u.Property(x => x.Email).HasColumnName("email").HasMaxLength(180).IsRequired();
                u.Property(x => x.Login).HasColumnName("login").HasMaxLength(80).IsRequired();
                u.Property(x => x.Senha).HasColumnName("senha").HasMaxLength(64).IsRequired(); // sha256 hex
                u.Property(x => x.Telefone).HasColumnName("telefone").HasMaxLength(20).IsRequired();
                u.Property(x => x.TypeUser).HasColumnName("type_user").IsRequired();
                u.Property(x => x.UserImg).HasColumnName("user_img").HasMaxLength(300);

                u.HasIndex(x => x.Cpf).IsUnique();
                u.HasIndex(x => x.Email).IsUnique();
                u.HasIndex(x => x.Login).IsUnique();
            });

            // ======================================================
            // PONTO_REGISTRO  (tabela dbo.ponto_registro)
            // ======================================================
            modelBuilder.Entity<PontoRegistro>(p =>
            {
                p.ToTable("ponto_registro");
                p.HasKey(x => x.Id);

                p.Property(x => x.Id).HasColumnName("id").ValueGeneratedOnAdd();
                p.Property(x => x.UsuarioId).HasColumnName("usuario_id").IsRequired();

                // DATETIME2(0)
                p.Property(x => x.Criacao).HasColumnName("criacao").HasPrecision(0);
                p.Property(x => x.DataSincronizacao).HasColumnName("datasincronizacao").HasPrecision(0);
                p.Property(x => x.DataInterface).HasColumnName("datainterface").HasPrecision(0);

                // DATE
                p.Property(x => x.DataLocal)
                    .HasColumnName("data_local")
                    .HasColumnType("date");

                p.Property(x => x.Tipo).HasColumnName("tipo").IsRequired();
                p.Property(x => x.Origem).HasColumnName("origem").IsRequired();

                p.Property(x => x.Latitude)
                    .HasColumnName("latitude")
                    .HasColumnType("decimal(9,6)");

                p.Property(x => x.Longitude)
                    .HasColumnName("longitude")
                    .HasColumnType("decimal(9,6)");

                p.Property(x => x.Ip).HasColumnName("ip").HasMaxLength(45);
                p.Property(x => x.DeviceInfo).HasColumnName("device_info").HasMaxLength(256);
                p.Property(x => x.Observacao).HasColumnName("observacao").HasMaxLength(500);

                p.Property(x => x.CriadoPorId).HasColumnName("criado_por_id");

                p.HasOne(x => x.Usuario)
                    .WithMany()
                    .HasForeignKey(x => x.UsuarioId)
                    .HasConstraintName("FK_ponto_registro_usuario")
                    .OnDelete(DeleteBehavior.NoAction);

                p.HasIndex(x => new { x.UsuarioId, x.DataLocal });
            });

            // ======================================================
            // VIEW vw_cartao_ponto (somente leitura)
            // ======================================================
            modelBuilder.Entity<CartaoPontoView>(v =>
            {
                v.HasNoKey();
                v.ToView("vw_cartao_ponto");
                v.Metadata.SetIsTableExcludedFromMigrations(true);

                v.Property(x => x.UsuarioId).HasColumnName("UsuarioId");
                v.Property(x => x.Nome).HasColumnName("Nome");
                v.Property(x => x.Login).HasColumnName("Login");
                v.Property(x => x.Email).HasColumnName("Email");
                v.Property(x => x.Telefone).HasColumnName("Telefone");
                v.Property(x => x.Cpf).HasColumnName("Cpf");
                v.Property(x => x.TypeUser).HasColumnName("TypeUser");
                v.Property(x => x.UserImg).HasColumnName("UserImg");

                v.Property(x => x.DataLocal).HasColumnName("DataLocal");
                v.Property(x => x.Entrada1).HasColumnName("Entrada1");
                v.Property(x => x.Saida1).HasColumnName("Saida1");
                v.Property(x => x.Entrada2).HasColumnName("Entrada2");
                v.Property(x => x.Saida2).HasColumnName("Saida2");
                v.Property(x => x.Entrada3).HasColumnName("Entrada3");
                v.Property(x => x.Saida3).HasColumnName("Saida3");
            });

            // ======================================================
            // FUNCIONARIO  (dbo.funcionario)
            // ======================================================
            modelBuilder.Entity<Funcionario>(f =>
            {
                f.ToTable("funcionario");
                f.HasKey(x => x.Id);

                f.Property(x => x.Id).HasColumnName("id").ValueGeneratedOnAdd();

                // ✅ FALTAVA (no seu CREATE TABLE existe lociid NOT NULL com default 1)
                f.Property(x => x.LociId)
                    .HasColumnName("lociid")
                    .HasDefaultValue(1)
                    .IsRequired();

                f.Property(x => x.Ativo)
                    .HasColumnName("ativo")
                    .HasDefaultValue(true);

                // DATETIME2(0)
                f.Property(x => x.Criacao)
                    .HasColumnName("criacao")
                    .HasPrecision(0)
                    .HasDefaultValueSql("sysdatetime()"); // ✅ bate com DF_funcionario_criacao

                f.Property(x => x.Alteracao)
                    .HasColumnName("alteracao")
                    .HasPrecision(0);

                f.Property(x => x.DataSincronizacao)
                    .HasColumnName("datassincronizacao")
                    .HasPrecision(0);

                f.Property(x => x.DataInterface)
                    .HasColumnName("datainterface")
                    .HasPrecision(0);

                f.Property(x => x.UsuarioCriacaoId)
                    .HasColumnName("usuariocriacaoid")
                    .IsRequired();

                f.Property(x => x.UsuarioId)
                    .HasColumnName("usuarioid");

                f.Property(x => x.Nome)
                    .HasColumnName("nome")
                    .HasMaxLength(120)
                    .IsRequired();

                f.Property(x => x.Cpf)
                    .HasColumnName("cpf")
                    .HasMaxLength(11)
                    .IsRequired();

                f.Property(x => x.Rg)
                    .HasColumnName("rg")
                    .HasMaxLength(20);

                f.Property(x => x.Email)
                    .HasColumnName("email")
                    .HasMaxLength(180);

                f.Property(x => x.Celular)
                    .HasColumnName("celular")
                    .HasMaxLength(20);

                f.Property(x => x.Funcao)
                    .HasColumnName("funcao")
                    .HasMaxLength(120);

                f.Property(x => x.Idade)
                    .HasColumnName("idade");

                f.Property(x => x.DataAdmissao)
                    .HasColumnName("dataadmissao")
                    .HasColumnType("date");

                f.Property(x => x.Salario)
                    .HasColumnName("salario")
                    .HasColumnType("decimal(18,2)");

                f.Property(x => x.TarifaVt)
                    .HasColumnName("tarifa_vt")
                    .HasColumnType("decimal(18,2)");

                f.Property(x => x.ValorDiarioVr)
                    .HasColumnName("valor_diario_vr")
                    .HasColumnType("decimal(18,2)");

                f.Property(x => x.RecebeVt)
                    .HasColumnName("recebe_vt")
                    .HasDefaultValue(false);

                f.Property(x => x.RecebeVr)
                    .HasColumnName("recebe_vr")
                    .HasDefaultValue(false);

                f.Property(x => x.TipoContrato)
                    .HasColumnName("tipo_contrato")
                    .HasColumnType("tinyint")
                    .IsRequired();

                f.Property(x => x.FotoUrl)
                    .HasColumnName("foto_url")
                    .HasMaxLength(300);

                f.HasIndex(x => x.Cpf).IsUnique();
            });

            // ======================================================
            // FUNCIONARIO_PASTA
            // ======================================================
            modelBuilder.Entity<FuncionarioPasta>(fp =>
            {
                fp.ToTable("funcionario_pasta");
                fp.HasKey(x => x.Id);

                if (typeof(FuncionarioPasta).GetProperty("LociId") != null)
                    fp.Ignore("LociId");

                fp.Property(x => x.Id).HasColumnName("id").ValueGeneratedOnAdd();
                fp.Property(x => x.FuncionarioId).HasColumnName("funcionario_id").IsRequired();
                fp.Property(x => x.PastaPaiId).HasColumnName("pasta_pai_id");

                fp.Property(x => x.Ativo).HasColumnName("ativo").HasDefaultValue(true);

                fp.Property(x => x.Criacao).HasColumnName("criacao").HasPrecision(0);
                fp.Property(x => x.Alteracao).HasColumnName("alteracao").HasPrecision(0);
                fp.Property(x => x.DataSincronizacao).HasColumnName("datassincronizacao").HasPrecision(0);
                fp.Property(x => x.DataInterface).HasColumnName("datainterface").HasPrecision(0);

                fp.Property(x => x.UsuarioCriacaoId).HasColumnName("usuariocriacaoid").IsRequired();
                fp.Property(x => x.UsuarioId).HasColumnName("usuarioid");

                fp.Property(x => x.Nome).HasColumnName("nome").HasMaxLength(120).IsRequired();

                fp.HasOne(x => x.Funcionario)
                    .WithMany()
                    .HasForeignKey(x => x.FuncionarioId)
                    .OnDelete(DeleteBehavior.NoAction);

                fp.HasOne(x => x.PastaPai)
                    .WithMany()
                    .HasForeignKey(x => x.PastaPaiId)
                    .OnDelete(DeleteBehavior.NoAction);
            });

            // ======================================================
            // FUNCIONARIO_DOCUMENTO
            // ======================================================
            modelBuilder.Entity<FuncionarioDocumento>(e =>
            {
                e.ToTable("funcionario_documento");
                e.HasKey(x => x.Id);

                e.Property(x => x.Id).HasColumnName("id").ValueGeneratedOnAdd();

                e.Property(x => x.FuncionarioId).HasColumnName("funcionario_id").IsRequired();
                e.Property(x => x.PastaId).HasColumnName("pasta_id");

                e.Property(x => x.Ativo).HasColumnName("ativo").HasDefaultValue(true);

                e.Property(x => x.Criacao).HasColumnName("criacao").HasPrecision(0);
                e.Property(x => x.Alteracao).HasColumnName("alteracao").HasPrecision(0);

                e.Property(x => x.DataSincronizacao).HasColumnName("datassincronizacao").HasPrecision(0);
                e.Property(x => x.DataInterface).HasColumnName("datainterface").HasPrecision(0);

                e.Property(x => x.UsuarioCriacaoId).HasColumnName("usuariocriacaoid").IsRequired();
                e.Property(x => x.UsuarioId).HasColumnName("usuarioid");

                e.Property(x => x.DocumentoImportante).HasColumnName("documento_importante").HasDefaultValue(false);

                e.Property(x => x.Nome).HasColumnName("nome").HasMaxLength(180).IsRequired();
                e.Property(x => x.Tipo).HasColumnName("tipo").HasMaxLength(80);

                e.Property(x => x.DataEmissao).HasColumnName("data_emissao").HasColumnType("date");
                e.Property(x => x.DataValidade).HasColumnName("data_validade").HasColumnType("date");

                e.Property(x => x.StorageKey).HasColumnName("storage_key").HasMaxLength(300).IsRequired();
                e.Property(x => x.ArquivoNomeOriginal).HasColumnName("arquivo_nome_original").HasMaxLength(255);
                e.Property(x => x.MimeType).HasColumnName("mime_type").HasMaxLength(120);

                e.Property(x => x.TamanhoBytes).HasColumnName("tamanho_bytes").HasDefaultValue(0);

                // (opcional) se você tem navegação, pode mapear FK aqui também
            });

            // ======================================================
            // FUNC_DOCIMP_TIPO
            // ======================================================
            modelBuilder.Entity<FuncDocImpTipo>(e =>
            {
                e.ToTable("func_docimp_tipo");
                e.HasKey(x => x.Id);

                e.Property(x => x.Id).HasColumnName("id");

                e.Property(x => x.Nome)
                    .HasColumnName("nome")
                    .HasMaxLength(100)
                    .IsRequired();

                e.Property(x => x.Ativo)
                    .HasColumnName("ativo")
                    .HasDefaultValue(true);

                e.Property(x => x.Criacao)
                    .HasColumnName("criacao")
                    .HasColumnType("datetime2")
                    .HasDefaultValueSql("sysdatetime()");

                e.Property(x => x.Alteracao)
                    .HasColumnName("alteracao")
                    .HasColumnType("datetime2");

                e.Property(x => x.DataSincronizacao)
                    .HasColumnName("datassincronizacao")
                    .HasColumnType("datetime2");

                e.Property(x => x.DataInterface)
                    .HasColumnName("datainterface")
                    .HasColumnType("datetime2");

                e.Property(x => x.UsuarioCriacaoId)
                    .HasColumnName("usuariocriacaoid")
                    .IsRequired();

                e.Property(x => x.UsuarioId)
                    .HasColumnName("usuarioid");

                e.HasIndex(x => x.Nome)
                    .IsUnique()
                    .HasFilter("[ativo] = 1")
                    .HasDatabaseName("UX_func_docimp_tipo_nome_ativo");
            });

            // ======================================================
            // CURSOS (dbo.cursos) — baseado no seu CREATE TABLE
            // ======================================================
            modelBuilder.Entity<Curso>(c =>
            {
                c.ToTable("cursos");
                c.HasKey(x => x.Id);

                c.Property(x => x.Id).HasColumnName("id").ValueGeneratedOnAdd();

                c.Property(x => x.Ativo)
                    .HasColumnName("ativo")
                    .HasDefaultValue(true);

                c.Property(x => x.Criacao)
                    .HasColumnName("criacao")
                    .HasPrecision(0)
                    .HasDefaultValueSql("sysdatetime()");

                c.Property(x => x.Alteracao)
                    .HasColumnName("alteracao")
                    .HasPrecision(0);

                c.Property(x => x.DataSincronizacao)
                    .HasColumnName("datassincronizacao")
                    .HasPrecision(0);

                c.Property(x => x.DataInterface)
                    .HasColumnName("datainterface")
                    .HasPrecision(0);

                c.Property(x => x.Nome)
                    .HasColumnName("nome")
                    .HasMaxLength(200)
                    .IsRequired();

                c.Property(x => x.CargaHoraria)
                    .HasColumnName("carga_horaria");

                // tinyint (1..4)
                // Se Curso.Categoria for enum, mantém conversão
                c.Property(x => x.Categoria)
                    .HasColumnName("categoria")
                    .HasConversion<byte>()
                    .HasColumnType("tinyint")
                    .IsRequired();

                c.Property(x => x.Observacao)
                    .HasColumnName("observacao")
                    .HasMaxLength(200);

                c.Property(x => x.Descricao)
                    .HasColumnName("descricao")
                    .HasMaxLength(800);

                c.Property(x => x.UsuarioCriacaoId)
                    .HasColumnName("usuariocriacaoid")
                    .IsRequired();

                c.Property(x => x.UsuarioId)
                    .HasColumnName("usuarioid");
            });

            // ======================================================
            // FUNCIONARIO_CURSO (dbo.funcionario_curso)
            // ======================================================
            modelBuilder.Entity<FuncionarioCurso>(fc =>
            {
                fc.ToTable("funcionario_curso");
                fc.HasKey(x => x.Id);

                fc.Property(x => x.Id).HasColumnName("id").ValueGeneratedOnAdd();

                // no banco: funcionarioid / cursoid (sem underscore)
                fc.Property(x => x.FuncionarioId)
                    .HasColumnName("funcionarioid")
                    .IsRequired();

                fc.Property(x => x.CursoId)
                    .HasColumnName("cursoid")
                    .IsRequired();

                fc.Property(x => x.DataConclusao)
                    .HasColumnName("data_conclusao")
                    .HasColumnType("date")
                    .IsRequired();

                fc.Property(x => x.DataValidade)
                    .HasColumnName("data_validade")
                    .HasColumnType("date");

                fc.Property(x => x.Ativo)
                    .HasColumnName("ativo")
                    .HasDefaultValue(true);

                fc.Property(x => x.Criacao)
                    .HasColumnName("criacao")
                    .HasPrecision(0)
                    .HasDefaultValueSql("sysdatetime()");

                fc.Property(x => x.Alteracao)
                    .HasColumnName("alteracao")
                    .HasPrecision(0);

                fc.Property(x => x.DataSincronizacao)
                    .HasColumnName("datassincronizacao")
                    .HasPrecision(0);

                fc.Property(x => x.DataInterface)
                    .HasColumnName("datainterface")
                    .HasPrecision(0);

                fc.Property(x => x.UsuarioCriacaoId)
                    .HasColumnName("usuariocriacaoid")
                    .IsRequired();

                fc.Property(x => x.UsuarioId)
                    .HasColumnName("usuarioid");

                // ✅ IMPORTANTE: Relacionamentos SEM depender do nome exato das navigations
                // (evita erro se sua Entity usar "FuncionarioCursos" vs "FuncionariosCursos")
                fc.HasOne(x => x.Curso)
                    .WithMany(c => c.FuncionariosCursos) // ✅ amarra a coleção real do Curso
                    .HasForeignKey(x => x.CursoId)
                    .HasConstraintName("FK_funcionario_curso_cursos")
                    .OnDelete(DeleteBehavior.NoAction);


                fc.HasOne(x => x.Funcionario)
                    .WithMany()
                    .HasForeignKey(x => x.FuncionarioId)
                    .HasConstraintName("FK_funcionario_curso_funcionario")
                    .OnDelete(DeleteBehavior.NoAction);

                // índice útil
                fc.HasIndex(x => new { x.FuncionarioId, x.CursoId })
                    .HasDatabaseName("IX_funcionario_curso_funcionario_curso");
            });
        }
    }
}
