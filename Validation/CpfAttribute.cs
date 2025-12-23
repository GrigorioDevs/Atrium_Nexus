using System.ComponentModel.DataAnnotations;
using System.Text.RegularExpressions;

namespace Atrium.RH.Validation;

[AttributeUsage(AttributeTargets.Property | AttributeTargets.Field | AttributeTargets.Parameter)]
public sealed class CpfAttribute : ValidationAttribute
{
    public CpfAttribute() : base("CPF inválido.") { }

    protected override ValidationResult? IsValid(object? value, ValidationContext validationContext)
    {
        if (value is null) return ValidationResult.Success; // deixe [Required] cuidar disso
        var cpf = Regex.Replace(value.ToString() ?? "", @"\D", "");

        if (cpf.Length != 11) return new ValidationResult(ErrorMessage);
        if (new string(cpf[0], 11) == cpf) return new ValidationResult(ErrorMessage);

        // cálculo dígito 1
        int sum = 0;
        for (int i = 0; i < 9; i++) sum += (cpf[i] - '0') * (10 - i);
        int d1 = (sum * 10) % 11;
        if (d1 == 10) d1 = 0;
        if ((cpf[9] - '0') != d1) return new ValidationResult(ErrorMessage);

        // cálculo dígito 2
        sum = 0;
        for (int i = 0; i < 10; i++) sum += (cpf[i] - '0') * (11 - i);
        int d2 = (sum * 10) % 11;
        if (d2 == 10) d2 = 0;
        if ((cpf[10] - '0') != d2) return new ValidationResult(ErrorMessage);

        return ValidationResult.Success;
    }
}
