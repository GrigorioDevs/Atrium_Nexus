namespace Atrium.RH.Helpers;

public static class StringOnlyDigits
{
    public static string DigitsOnly(string? v)
        => new string((v ?? "").Where(char.IsDigit).ToArray());
}
