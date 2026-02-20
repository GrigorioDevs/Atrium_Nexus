namespace AtriumNexus.Api.Options;

public class StorageOptions
{
    public string RootPath { get; set; } = "";
    public string PublicBasePath { get; set; } = "/storage";
    public long MaxBytes { get; set; } = 5 * 1024 * 1024;
}