---
title: "Tábua de vida a partir de um CSV"
date: 2026-11-08
draft: false
description: "Gere tábuas de vida atuarial e curvas de sobrevida a partir de um arquivo CSV, comparando grupos de tratamento."
tags: ["estatística", "sobrevida", "ferramentas"]
layout: "tabuadevida"
---

Esta ferramenta gera, a partir de um arquivo CSV, uma tábua de vida atuarial com a curva de sobrevida por grupo e um parágrafo descritivo com os principais resultados. O intervalo entre os períodos é informado por você e pode ser recalculado quando quiser.

O arquivo deve conter, no mínimo, uma coluna de **tempo** e uma coluna de **evento** (`sim`/`não`) e, opcionalmente, uma coluna de **grupo** (por exemplo, `sim`/`não`). Após o upload, indique qual coluna corresponde a cada papel, a **unidade de tempo** (meses, dias, anos etc.), o **nome do evento** e o **intervalo** desejado; depois clique em **Recalcular**.

Nenhum dado é enviado a servidores: todo o processamento acontece no seu navegador.
