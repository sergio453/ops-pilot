# Implementation Plan: Trace Persistido + Logs JSON

**Branch**: `014-trace-persistido-logs-json` | **Date**: 2026-11-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/014-trace-persistido-logs-json/spec.md`

## Summary

Esta feature adiciona rastreabilidade operacional fim a fim no fluxo `/chat` com um `requestId` único retornado no corpo e no cabeçalho `X-Request_Id`, persistência de métricas em `requests`, persistência de eventos em `trace_events`, emissão de logs estruturados em uma linha JSON por evento (somente metadados) e consulta histórica em `GET /requests/:id` com trace ordenado deterministicamente.

## Technical Context

**Language/Version**: TypeScript 5.9 / Node.js 22 LTS (ESM, `strict: true`)  
**Primary Dependencies**: `express`, `zod`, `node:sqlite` (`DatabaseSync`)  
**Storage**: SQLite local configurado por `OPSPILOT_DB` (default `./data/opspilot.db`, testes com `:memory:`)  
**Testing**: `node:test` via `npm test` + verificação estática via `npm run typecheck`  
**Target Platform**: Serviço backend Node.js em Linux/Windows  
**Project Type**: Web service backend (API HTTP + camadas de store/serviço)  
**Performance Goals**: Persistência de trace com overhead operacional mínimo; leitura por `requestId` com latência compatível com uso de troubleshooting interativo (< 500ms em banco local para traces típicos)  
**Constraints**: Sem vazamento de segredo nos logs; uma linha JSON por evento; ordenação determinística de trace; compatibilidade com contratos atuais de `/chat`  
**Scale/Scope**: Mudanças pontuais em `src/http/`, `src/store/`, novos artefatos em `src/obs/` e ampliação de testes HTTP/store

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio Constitucional | Status | Justificativa / Conformidade |
|---|---|---|
| **I. Type-safe architecture and boundary validation** | PASS | Contratos de `/chat` e `/requests/:id` serão validados em fronteira HTTP e mapeados para tipos explícitos de domínio de observabilidade. |
| **II. MVC structure and responsibility separation** | PASS | Controller HTTP apenas orquestra entrada/saída; persistência ficará encapsulada em store dedicada de request/trace e logging em `src/obs/`. |
| **III. Pure logic and explicit error handling** | PASS | Serialização de metadados de log e mapeamento de linhas SQLite serão funções puras; erros de request inexistente serão explícitos e previsíveis. |
| **IV. Test-first quality gates** | PASS | Plano contempla cobertura de testes para headers/body, persistência de `requests`/`trace_events`, ordenação e not-found em `GET /requests/:id`. |
| **V. Secure and operationally safe development** | PASS | Estratégia de log limita saída a metadados permitidos, sem payload sensível bruto; persistência com chaves e índices para consistência operacional. |

## Project Structure

### Documentation (this feature)

```text
specs/014-trace-persistido-logs-json/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── request-trace-contract.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── http/
│   ├── server.ts                      # POST /chat com requestId + GET /requests/:id
│   └── server.test.ts                 # Testes de integração dos novos contratos
├── obs/
│   └── logger.ts                      # Serialização de log JSON por evento (metadados)
├── store/
│   ├── sqlite-ops-store.ts            # Evolução de schema (requests + trace_events) ou delegação
│   └── sqlite-request-trace-store.ts  # (opção preferida) persistência de request/trace isolada
└── agents/
    └── types.ts                       # Reuso/ajuste de tipos de trace para persistência
```

**Structure Decision**: Projeto único TypeScript ESM, mantendo separação de responsabilidades: camada HTTP em `src/http/`, persistência em `src/store/` e logging estruturado em `src/obs/`.

## Phases & Deliverables

### Phase 0: Research & Foundation (Concluído)
- Consolidado em [research.md](./research.md), com decisões para geração de `requestId`, modelagem de tabelas, ordenação de trace, política de metadados de log e códigos de erro.

### Phase 1: Design & Contracts (Concluído)
- Modelo de dados detalhado em [data-model.md](./data-model.md).
- Contratos HTTP e de log em [contracts/request-trace-contract.md](./contracts/request-trace-contract.md).
- Cenários de validação em [quickstart.md](./quickstart.md).

### Phase 2: Implementation (Detalhada em [tasks.md](./tasks.md))
- Integrar `requestId` no ciclo de `/chat` (header + body).
- Persistir métricas da requisição em `requests`.
- Persistir eventos em `trace_events` com ordenação estável.
- Implementar `src/obs/logger.ts` para JSON por evento com metadados.
- Expor `GET /requests/:id` com registro + trace ordenado.
- Atualizar testes e garantir `npm test` + `npm run typecheck` verdes.

**Adaptação ao código existente**: o repositório ainda usa estratégias e controller HTTP, sem `GraphState` unificado. A finalização equivalente ao `answerNode` solicitado é coordenada por `src/obs/request-trace-service.ts` e `src/http/server.ts`, preservando histórico e sumarização existentes. Persistem-se também `userId`, `route` e `modelUsed` quando disponível; emite-se log `done` no nó `resposta`, sem conteúdo bruto da requisição. Eventos das estratégias são persistidos incrementalmente para preservar trace parcial em falhas.

## Post-Design Constitution Re-Check

| Princípio Constitucional | Status | Evidência pós-design |
|---|---|---|
| **I. Type-safe architecture and boundary validation** | PASS | Data model e contratos definem tipos e validações de entrada/saída para requestId, métricas e trace. |
| **II. MVC structure and responsibility separation** | PASS | Artefatos separam claramente HTTP contract, modelo de dados e responsabilidades de persistência/logging. |
| **III. Pure logic and explicit error handling** | PASS | Regras de ordenação e serialização de metadata foram definidas de forma determinística e testável. |
| **IV. Test-first quality gates** | PASS | Quickstart e contratos já preveem cenários de teste mínimos e critérios de aceite por fluxo. |
| **V. Secure and operationally safe development** | PASS | Política explícita de log de metadados e resposta de not-found sem dados parciais. |

## Complexity Tracking

> Nenhuma violação constitucional detectada. Sem justificativas de complexidade adicional.
