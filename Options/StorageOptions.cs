namespace Atrium.RH.Options;

public sealed class StorageOptions
{
    public string RootPath { get; set; } = "storage";
    public string RequestPath { get; set; } = "/storage";
}