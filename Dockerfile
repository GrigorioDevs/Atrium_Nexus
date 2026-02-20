# ===== BUILD =====
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Copia tudo do repositório para dentro do container
COPY . .

# (1) Ajuste aqui: caminho do .csproj
# Exemplo se estiver na raiz: "./Atrium_Nexus.csproj"
# Exemplo se estiver numa pasta: "./Atrium_Nexus/Atrium_Nexus.csproj"
RUN dotnet restore "./Atrium.RH.csproj"

# Publica para /app/publish
RUN dotnet publish "./Atrium.RH.csproj" -c Release -o /app/publish --no-restore

# ===== RUNTIME =====
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app

# Porta padrão nas imagens atuais costuma ser 8080
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

COPY --from=build /app/publish .

# (2) Ajuste aqui: nome do .dll gerado
ENTRYPOINT ["dotnet", "Atrium.RH.dll"]
