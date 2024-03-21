---
layout: post
title:  "Rinha de Backend: Dia 1"
date:   2024-03-20 20:40:42 -0300
categories: rinha-de-backend
---

# Começando 

Chegando com praticamente um ano de atraso, decidi começar o desafio da rinha de backend.
As instruções do desafio foram postadas aqui. 
Escolhi fazer esse desafio **com .NET 8**.

# Desenvolvendo a API

Utilizei uma aplicação web com minimal API e instalei apenas os pacotes necessários para rodar o banco Postgre com o EF Core. Também instalei o pacote do Swagger a fim de facilitar alguns testes manuais.

![pacotes](image.png)

Como o foco do desafio não é design de código, coloquei todos os arquivos necessários em um único pacote.

![organização do projeto](image-1.png)

Segue agora como ficou a API:

``` cs
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddDbContext<AppDbContext>();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();
app.UseSwagger();
app.UseSwaggerUI();

if (app.Environment.IsDevelopment())
{
    app.ApplyMigrations();
}

app.MapPost("/pessoas", (AppDbContext context, HttpContext http, PessoaRequest pessoaViewModel) =>
{
    if (!pessoaViewModel.IsValid(context))
    {
        return Results.UnprocessableEntity();
    }

    var pessoas = pessoaViewModel.ToModel();

    context.Pessoas.Add(pessoas);
    context.SaveChanges();

    http.Response?.Headers?.Add("Location", $"/pessoas/{pessoas.Id}");

    return Results.Created();
});

app.MapGet("/pessoas/{id}", (AppDbContext dbContext, Guid id) =>
{
    var pessoa = dbContext.Pessoas
        .Include(p => p.Stack)
        .FirstOrDefault(p => p.Id == id);


    if (pessoa is null)
    {
        return Results.NotFound();
    }

    return Results.Ok(pessoa.ToResponse());
});

app.MapGet("/pessoas", (AppDbContext dbContext, string? t) =>
{
    var pessoas = dbContext.Pessoas
         .Include(p => p.Stack)
         .Where(p =>
            p.Apelido.Contains(t)
            || p.Nome.Contains(t)
            || p.Stack!.Any(s => s.Name.Contains(t))
            )
         .ToList();


    return Results.Ok(pessoas.Select(p => p.ToResponse()));
});

app.MapGet("/contagem-pessoas", (AppDbContext dbContext) =>
{
    var count = dbContext.Pessoas.Count();
    return Results.Ok(count);
});

app.Run();

Criei também um arquivo docker-compose para executar o banco de dados:

version: '3.4'

services:
  rinha.db:
    image: postgres:latest
    container_name: rinha.database
    restart: always
    environment:
      - POSTGRES_DB=postgres
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
    ports:
      - "5432:5432"
    volumes:
    - db:/var/lib/postgresql/data

volumes:
  db:
    driver: local

Até então, a API está funcionando normalmente, atendendo a todas as restrições sugeridas. Nos próximos dias, vou tentar criar a infraestrutura para execução dos testes de carga.