using Atrium.RH.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Atrium.RH.Data
{
    public class AtriumRhDbContext : DbContext
    {
        public AtriumRhDbContext(DbContextOptions<AtriumRhDbContext> options) : base(options) { }

        public DbSet<Usuario> Usuarios => Set<Usuario>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            var u = modelBuilder.Entity<Usuario>();

            u.ToTable("usuario"); // nome da tabela no SQL Server

            u.HasKey(x => x.Id);

            u.Property(x => x.Id).ValueGeneratedNever(); // pq o ID é "max+1" (sem identity)
            u.Property(x => x.LociId).HasColumnName("lociid").HasDefaultValue(1);
            u.Property(x => x.Ativo).HasColumnName("ativo").HasDefaultValue(true);

            u.Property(x => x.Criacao).HasColumnName("criacao");

            u.Property(x => x.DataSincronizacao).HasColumnName("datasincronizacao");
            u.Property(x => x.DataInterface).HasColumnName("datainterface");

            u.Property(x => x.Cpf).HasColumnName("cpf").HasMaxLength(11).IsRequired();
            u.Property(x => x.Nome).HasColumnName("nome").HasMaxLength(120).IsRequired();
            u.Property(x => x.Email).HasColumnName("email").HasMaxLength(180).IsRequired();
            u.Property(x => x.Login).HasColumnName("login").HasMaxLength(80).IsRequired();
            u.Property(x => x.Senha).HasColumnName("senha").HasMaxLength(64).IsRequired(); // sha256 hex = 64 chars
            u.Property(x => x.Telefone).HasColumnName("telefone").HasMaxLength(20).IsRequired();

            u.Property(x => x.TypeUser).HasColumnName("type_user").IsRequired();
            u.Property(x => x.UserImg).HasColumnName("user_img").HasMaxLength(300);

            // índices recomendados
            u.HasIndex(x => x.Cpf).IsUnique();
            u.HasIndex(x => x.Email).IsUnique();
            u.HasIndex(x => x.Login).IsUnique();
        }
    }
}
