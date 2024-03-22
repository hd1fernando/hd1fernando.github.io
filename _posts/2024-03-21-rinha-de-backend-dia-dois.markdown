---
layout: post
title:  "Rinha de Backend: Dia 2"
date:   2024-03-21 23:08:42 -0300
categories: rinha-de-backend
---

# Configurando o docker compose:

O único trabalho que me dei no seguindo dia foi configurar o docker-compose.
Tive alguns problemas pois estava mapeando as duas portas da api pra mesma saída, mas foi bem simples de resolver.

Meu arquivo docker-compose.yml fico da seguinte forma:


``` 
version: '3.4'
# limites: 1.5 CPU e 3GB de memória

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
    deploy:
      resources:
        limits:
          cpus: '0.75'
          memory: '1.5GB'

  api1:
    environment:
      - ASPNETCORE_ENVIRONMENT=Development
      - ASPNETCORE_URLS=http://*:5000
    image: rinha.api
    build: RinhaBackend
    ports:
      - "5000:5000"
    depends_on:
      - rinha.db  
    deploy:
      resources:
        limits:
          cpus: '0.25'
          memory: '0.5GB'

  api2:
    environment:
      - ASPNETCORE_ENVIRONMENT=Development
      - ASPNETCORE_URLS=http://*:5005
    image: rinha.api
    build: RinhaBackend
    ports:
      - "5005:5005"
    depends_on:
      - rinha.db  
    deploy:
      resources:
        limits:
          cpus: '0.25'
          memory: '0.5GB'

  nginx:
    image: nginx:latest
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - api1
      - api2
    ports:
      - "9999:9999"
    deploy:
      resources:
        limits:
          cpus: '0.25'
          memory: '0.5GB'

volumes:
  db:
    driver: local

networks:
  load-balancer:

```