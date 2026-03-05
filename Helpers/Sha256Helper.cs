using System.Security.Cryptography;
using System.Text;

namespace Atrium.RH.Helpers;

public static class Sha256Helper
{
    // método "oficial" (64 chars hex)
    public static string Hash(string input)
    {
        using var sha = SHA256.Create();
        var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(input ?? ""));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    // alias para não quebrar chamadas antigas
    public static string HashHex(string input) => Hash(input);

    public static string DigitsOnly(string? s)
        => string.IsNullOrWhiteSpace(s) ? "" : new string(s.Where(char.IsDigit).ToArray());
}
