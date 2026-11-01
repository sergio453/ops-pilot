# Research: Trace Persistido + Logs JSON

**Feature**: `014-trace-persistido-logs-json`  
**Date**: 2026-11-01

## Context

O fluxo atual de `/chat` retorna resposta, trace e métricas em tempo real, mas não possui correlação persistente por requisição nem endpoint de recuperação histórica por identificador. A feature precisa padronizar correlação (`requestId`), persistência operacional (`requests` e `trace_events`) e logging estruturado seguro (somente metadados).

---

## Decision 1: `requestId` único por chamada `/chat`, retornado em body e header

- **Decision**: Gerar `requestId` com `randomUUID()` de `node:crypto` no início do processamento da requisição e devolver o mesmo valor no corpo da resposta e no cabeçalho `X-Request_Id`. A chave primária de `requests` impede sobrescrita em eventual colisão; nesse caso, gerar outro UUID antes de iniciar a execução.
- **Rationale**: Garante correlação transversal (cliente HTTP, logs, banco e troubleshooting) com único identificador canônico.
- **Alternatives considered**:
  - Reusar `conversationId`: rejeitado porque uma conversa contém múltiplas requisições.
  - Gerar ID apenas no log: rejeitado porque reduz visibilidade para clientes e testes de contrato.

---

## Decision 2: Persistência separada em `requests` (métricas) e `trace_events` (eventos)

- **Decision**: Introduzir tabela `requests` para metadados/métricas da execução e tabela `trace_events` para granularidade por evento, com `request_id` como chave de correlação.
- **Rationale**: Normalização reduz duplicação, facilita filtros operacionais e mantém leitura histórica eficiente.
- **Alternatives considered**:
  - Persistir trace inteiro em JSON único por requisição: rejeitado por dificultar ordenação, filtragem e auditoria evento a evento.
  - Persistir só em memória: rejeitado por não atender rastreabilidade pós-execução.

---

## Decision 3: Ordenação determinística de trace por sequência persistida

- **Decision**: Persistir um campo sequencial por evento (`event_index`) por `request_id` e ordenar por esse campo na leitura de `GET /requests/:id`.
- **Rationale**: Ordem determinística independe de empates de timestamp e reproduz fielmente a execução observada.
- **Alternatives considered**:
  - Ordenar apenas por `created_at`: rejeitado por risco de empate em alta frequência.
  - Ordenar por `id` autoincrement global: rejeitado por não representar ordem local da requisição em ambientes concorrentes.

---

## Decision 4: Logger em JSONL com allowlist de metadados

- **Decision**: Criar `src/obs/logger.ts` para emitir exatamente uma linha JSON por evento contendo apenas metadados permitidos (ex.: `requestId`, `node`, `type`, `eventIndex`, `timestamp`, tamanho de payload), sem conteúdo sensível de payload.
- **Rationale**: Atende observabilidade e segurança operacional simultaneamente.
- **Alternatives considered**:
  - Logar payload bruto completo: rejeitado por risco de vazamento e ruído operacional.
  - Log textual não estruturado: rejeitado por dificultar parsing e automação.

---

## Decision 5: `GET /requests/:id` retorna registro + trace ordenado, com not-found explícito

- **Decision**: Expor endpoint de leitura por `requestId`, retornando objeto de requisição e lista de eventos ordenada; para inexistente, retornar erro explícito de não encontrado sem dados parciais.
- **Rationale**: Proporciona recuperação determinística para auditoria e troubleshooting.
- **Alternatives considered**:
  - Retornar `200` com lista vazia para ID inexistente: rejeitado por ambiguidade operacional.
  - Endpoint de listagem global sem filtro: rejeitado por não atender lookup direcionado da spec.

---

## Decision 6: Persistência resiliente para sucesso e falha

- **Decision**: Criar registro base da requisição no início, atualizar resultado/métricas ao fim e persistir eventos incrementalmente; em falha, registrar status de erro preservando dados já coletados.
- **Rationale**: Evita perda total de rastreabilidade em casos de timeout/erro interno.
- **Alternatives considered**:
  - Persistir tudo só ao final: rejeitado por perder histórico quando ocorre falha antes da conclusão.

---

## Result

As decisões acima resolvem todos os pontos da especificação sem pendências de clarificação e estabelecem base para implementação em camadas (HTTP, store, logging) com testes de contrato e integração.
