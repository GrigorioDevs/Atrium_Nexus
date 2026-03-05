namespace Atrium_Nexus.Enums;

public static class TipoContratoExtensions
{
    public static string ToTexto(this TipoContrato tipo) => tipo switch
    {
        TipoContrato.CLT => "CLT",
        TipoContrato.PJ => "PJ",
        _ => "—"
    };
}
