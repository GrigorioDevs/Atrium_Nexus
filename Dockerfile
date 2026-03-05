FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Copia tudo do repositório para dentro do container
COPY . .

# Ajuste aqui se o .csproj não estiver na raiz
RUN dotnet restore "./Atrium.RH.csproj"

# Publica para /app/publish
RUN dotnet publish "./Atrium.RH.csproj" -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app

ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

COPY --from=build /app/publish .

ENTRYPOINT ["dotnet", "Atrium.RH.dll"]