using Atrium.RH.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Atrium.RH.Data.Configurations;

public sealed class FuncionarioAssinaturaGifConfiguration : IEntityTypeConfiguration<FuncionarioAssinaturaGif>
{
    public void Configure(EntityTypeBuilder<FuncionarioAssinaturaGif> b)
    {
        b.ToTable("funcionarios_assinatura_gif");
        b.HasKey(x => x.Id);

        b.Property(x => x.Id).HasColumnName("id");
        b.Property(x => x.FuncionarioId).HasColumnName("funcionario_id").IsRequired();
        b.Property(x => x.StorageKey).HasColumnName("storage_key").HasMaxLength(500).IsRequired();
        b.Property(x => x.PublicUrl).HasColumnName("public_url").HasMaxLength(800).IsRequired();
        b.Property(x => x.Ativa).HasColumnName("ativa").HasDefaultValue(true).IsRequired();
        b.Property(x => x.CriadoEm).HasColumnName("criado_em").HasDefaultValueSql("sysdatetime()").IsRequired();
    }
}