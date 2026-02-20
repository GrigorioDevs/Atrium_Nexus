FROM mcr.microsoft.com/dotnet/aspnet:9.0
COPY ./app
WORKDIR /app
RUN dotnet restore
RUN dotnet build -configuration Release
ENTRYPOINT ["dotnet","Atrium.RH.dll"]