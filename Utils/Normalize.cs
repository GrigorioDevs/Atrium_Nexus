using System.Text.RegularExpressions;

namespace Atrium.RH.Utils;

public static class Normalize
{
    public static string OnlyDigits(string? value)
        => Regex.Replace(value ?? "", @"\D", "");
}
