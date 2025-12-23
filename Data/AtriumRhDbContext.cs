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

        // ===== NOVOS (RH) =====
        public DbSet<Funcionario> Funcionarios => Set<Funcionario>();
        public DbSet<FuncionarioPasta> FuncionarioPastas => Set<FuncionarioPasta>();
        public DbSet<FuncionarioDocumento> FuncionarioDocumentos => Set<FuncionarioDocumento>();

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

                // ✅ No seu SQL: device_info varchar(256)
                p.Property(x => x.DeviceInfo).HasColumnName("device_info").HasMaxLength(256);

                p.Property(x => x.Observacao).HasColumnName("observacao").HasMaxLength(500);

                p.Property(x => x.CriadoPorId).HasColumnName("criado_por_id");

                p.HasOne(x => x.Usuario)
                    .WithMany()
                    .HasForeignKey(x => x.UsuarioId)
                    .HasConstraintName("FK_ponto_registro_usuario")
                    .OnDelete(DeleteBehavior.NoAction);

                // índice útil (opcional mas recomendado)
                p.HasIndex(x => new { x.UsuarioId, x.DataLocal });
            });

            // ======================================================
            // VIEW vw_cartao_ponto (somente leitura)
            // ======================================================
            modelBuilder.Entity<CartaoPontoView>(v =>
            {
                v.HasNoKey();
                v.ToView("vw_cartao_ponto");

                // dica: evita EF tentar "inferir" tabela
                v.Metadata.SetIsTableExcludedFromMigrations(true);

                // se a view estiver com colunas PascalCase exatamente como você setou
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
            // FUNCIONARIO
            // ======================================================
            modelBuilder.Entity<Funcionario>(f =>
            {
                f.ToTable("funcionario");
                f.HasKey(x => x.Id);

                f.Property(x => x.Id).HasColumnName("id").ValueGeneratedOnAdd();
                f.Property(x => x.LociId).HasColumnName("lociid").HasDefaultValue(1);
                f.Property(x => x.Ativo).HasColumnName("ativo").HasDefaultValue(true);

                // DATETIME2(0)
                f.Property(x => x.Criacao).HasColumnName("criacao").HasPrecision(0);
                f.Property(x => x.Alteracao).HasColumnName("alteracao").HasPrecision(0);

                // ✅ no seu código estava "datassincronizacao" (2 s). Mantive como você escreveu.
                // Se no banco for "datasincronizacao", troque aqui.
                f.Property(x => x.DataSincronizacao).HasColumnName("datassincronizacao").HasPrecision(0);

                f.Property(x => x.DataInterface).HasColumnName("datainterface").HasPrecision(0);

                f.Property(x => x.UsuarioCriacaoId).HasColumnName("usuariocriacaoid").IsRequired();
                f.Property(x => x.UsuarioId).HasColumnName("usuarioid");

                f.Property(x => x.Nome).HasColumnName("nome").HasMaxLength(120).IsRequired();
                f.Property(x => x.Cpf).HasColumnName("cpf").HasMaxLength(11).IsRequired();
                f.Property(x => x.Rg).HasColumnName("rg").HasMaxLength(20);

                f.Property(x => x.Email).HasColumnName("email").HasMaxLength(180);
                f.Property(x => x.Celular).HasColumnName("celular").HasMaxLength(20);

                f.Property(x => x.Funcao).HasColumnName("funcao").HasMaxLength(120);
                f.Property(x => x.Idade).HasColumnName("idade");

                // DATE
                f.Property(x => x.DataAdmissao).HasColumnName("dataadmissao").HasColumnType("date");

                f.Property(x => x.Salario).HasColumnName("salario").HasColumnType("decimal(18,2)");
                f.Property(x => x.TarifaVt).HasColumnName("tarifa_vt").HasColumnType("decimal(18,2)");
                f.Property(x => x.ValorDiarioVr).HasColumnName("valor_diario_vr").HasColumnType("decimal(18,2)");

                f.Property(x => x.RecebeVt).HasColumnName("recebe_vt").HasDefaultValue(false);
                f.Property(x => x.RecebeVr).HasColumnName("recebe_vr").HasDefaultValue(false);

                f.Property(x => x.TipoContrato).HasColumnName("tipo_contrato").IsRequired();
                f.Property(x => x.FotoUrl).HasColumnName("foto_url").HasMaxLength(300);

                f.HasIndex(x => x.Cpf).IsUnique();
            });

            // ======================================================
            // FUNCIONARIO_PASTA
            // ======================================================
            modelBuilder.Entity<FuncionarioPasta>(fp =>
            {
                fp.ToTable("funcionario_pasta");
                fp.HasKey(x => x.Id);

                fp.Property(x => x.Id).HasColumnName("id").ValueGeneratedOnAdd();
                fp.Property(x => x.FuncionarioId).HasColumnName("funcionario_id").IsRequired();
                fp.Property(x => x.PastaPaiId).HasColumnName("pasta_pai_id");

                fp.Property(x => x.Ativo).HasColumnName("ativo").HasDefaultValue(true);

                // DATETIME2(0)
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
            modelBuilder.Entity<FuncionarioDocumento>(fd =>
            {
                fd.ToTable("funcionario_documento");
                fd.HasKey(x => x.Id);

                fd.Property(x => x.Id).HasColumnName("id").ValueGeneratedOnAdd();
                fd.Property(x => x.FuncionarioId).HasColumnName("funcionario_id").IsRequired();
                fd.Property(x => x.PastaId).HasColumnName("pasta_id");

                fd.Property(x => x.Ativo).HasColumnName("ativo").HasDefaultValue(true);

                // DATETIME2(0)
                fd.Property(x => x.Criacao).HasColumnName("criacao").HasPrecision(0);
                fd.Property(x => x.Alteracao).HasColumnName("alteracao").HasPrecision(0);
                fd.Property(x => x.DataSincronizacao).HasColumnName("datassincronizacao").HasPrecision(0);
                fd.Property(x => x.DataInterface).HasColumnName("datainterface").HasPrecision(0);

                fd.Property(x => x.UsuarioCriacaoId).HasColumnName("usuariocriacaoid").IsRequired();
                fd.Property(x => x.UsuarioId).HasColumnName("usuarioid");

                fd.Property(x => x.NomeOriginal).HasColumnName("nome_original").HasMaxLength(260).IsRequired();
                fd.Property(x => x.Extensao).HasColumnName("extensao").HasMaxLength(10).IsRequired();
                fd.Property(x => x.ContentType).HasColumnName("content_type").HasMaxLength(100).IsRequired();
                fd.Property(x => x.TamanhoBytes).HasColumnName("tamanho_bytes").IsRequired();

                fd.Property(x => x.StorageKey).HasColumnName("storage_key").HasMaxLength(400).IsRequired();
                fd.Property(x => x.HashSha256).HasColumnName("hash_sha256").HasMaxLength(64);

                fd.HasOne(x => x.Funcionario)
                    .WithMany()
                    .HasForeignKey(x => x.FuncionarioId)
                    .OnDelete(DeleteBehavior.NoAction);

                fd.HasOne(x => x.Pasta)
                    .WithMany()
                    .HasForeignKey(x => x.PastaId)
                    .OnDelete(DeleteBehavior.NoAction);
            });
        }
    }
}
