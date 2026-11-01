# Copilot Instructions

## Projeto
OpsPilot: copiloto de plantao para gerenciamento de alertas e incidentes de producao.  
A API e um agente LangChain/LangGraph sobre OpenRouter.

## Stack
- Node.js 22 LTS
- TypeScript ESM com `strict: true`
- `zod` na fronteira (HTTP/CLI) para validar entrada e saida
- Testes com `node --test` via `tsx`
- Express com MySQL como banco

## Comandos (package.json)
- `npm run dev`
- `npm run dev:env`
- `npm run arena`
- `npm run bench`
- `npm test`
- `npm run typecheck`

## Convencoes
- Camadas padrao: MVC (Model, Service, Controller)
- Toda entrada externa e validada com zod
- Erros de dominio sao classes traduzidas na borda
- Logica nova nasce com teste
- `npm run typecheck` e `npm test` sempre verdes
- Nunca commitar secrets e nunca ler `.env`
- Sempre utilizar funcoes puras

## Fluxo de trabalho
Seguir o fluxo do Spec Kit (GitHub Copilot):
/speckit.specify -> plan -> task -> implement

Specs devem ser versionadas.
