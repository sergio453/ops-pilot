# Implementation Plan: Persistência real de operações

**Branch**: `004-sqlite-ops-store` | **Date**: 2026-10-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-sqlite-ops-store/spec.md`

## Summary

Migrar o estado operacional do cenário de incidentes para persistência local durável, mantendo
paridade funcional com o fluxo atual de alertas/incidentes e adicionando consultas de incidentes e
runbook por serviço. O desenho usa armazenamento SQLite com schema e seed idempotentes, validações
de domínio para campos fechados e composição híbrida: persistência real no runtime principal e modo
em memória para cenários determinísticos de teste e benchmark.

## Technical Context

**Language/Version**: TypeScript (ESM, `strict: true`) em Node.js 22 LTS

**Primary Dependencies**: `zod`, `@langchain/core`, `@langchain/langgraph`, `@langchain/openai`,
`express`, `node:sqlite`

**Storage**: SQLite local via `node:sqlite` (`DatabaseSync`), com `OPSPILOT_DB` e fallback para
`./data/opspilot.db`; `:memory:` para validação/bench determinístico

**Testing**: `node --test` via `tsx` (`npm test`) + tipagem com `tsc --noEmit`

**Target Platform**: Servidor Node.js em ambiente local/dev e execução CLI

**Project Type**: Aplicação backend/agent com CLI operacional

**Performance Goals**: Operações de listagem/abertura/resolução concluídas em tempo interativo para
fluxo de plantão, sem regressão perceptível em relação ao store em memória

**Constraints**:
- Sem concatenação SQL em queries parametrizadas
- Seed e DDL idempotentes
- Erros de domínio explícitos para serviço/runbook/incidente inexistentes
- Compatibilidade com validações existentes e testes verdes

**Scale/Scope**: Cenário de domínio com 5 serviços, 6 alertas iniciais, incidentes abertos e
resolvidos, e 3 runbooks de referência

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Type-safe architecture and boundary validation**: PASS  
  Contratos de entrada/saída de tools permanecem validados por `zod` e modelos de dados explícitos.
- **MVC and separation of responsibilities**: PASS  
  Persistência isolada em store dedicado; regras de domínio mantidas fora da borda de protocolo.
- **Pure logic and explicit error handling**: PASS  
  Fluxos de validação e erro de domínio seguem padrão explícito (sem fallback silencioso).
- **Test-first quality gates**: PASS  
  Escopo inclui cobertura de seed, ciclo de incidente, filtros e constraints; `npm test` e
  `npm run typecheck` como gates obrigatórios.
- **Secure and operationally safe development**: PASS  
  Nenhum segredo em código; caminho de banco via variável de ambiente; dados locais ignorados no VCS.

**Post-Design Re-check**: PASS. Os artefatos de design abaixo mantêm conformidade com os mesmos
gates sem exceções.

## Project Structure

### Documentation (this feature)

```text
specs/004-sqlite-ops-store/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── ops-tools.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── agents/
│   ├── tools.ts
│   ├── errors.ts
│   ├── react.ts
│   └── plan-and-execute.ts
├── store/
│   └── sqlite-ops-store.ts
├── scripts/
│   └── seed-story.ts
├── arena.ts
├── bench.ts
└── index.ts
```

**Structure Decision**: Projeto único Node/TypeScript com organização por domínio de agente e
persistência. A evolução da feature acontece em `src/agents` (contratos/tools/composição) e
`src/store` (implementação SQLite), com validação por testes existentes em `src/**/*.test.ts`.

## Complexity Tracking

Nenhuma violação de constituição identificada; tabela de exceções não se aplica.
