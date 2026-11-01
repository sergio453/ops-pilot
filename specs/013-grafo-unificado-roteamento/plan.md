# Implementation Plan: Grafo Unificado de Produção com Roteamento Dinâmico e Trace Granular

**Branch**: `013-grafo-unificado-roteamento` | **Date**: 2026-10-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/013-grafo-unificado-roteamento/spec.md`

## Summary

Esta feature unifica as estratégias de raciocínio do OpsPilot (`react`, `plan-and-execute`, `reflection`) em um grafo LangGraph formal de produção (`production-graph.ts`). O fluxo consiste em 4 fases orquestradas por nós: preparação de contexto (`contexto`), decisão inteligente com saída estruturada e tabela de critérios (`roteador`), execução da estratégia escolhida (`react` | `plan-and-execute` | `reflection`) e consolidação de resposta (`resposta`). Todo evento de trace passa a carregar o identificador do nó emissor (`node`) e um evento dedicado do tipo `route`. O endpoint `/chat` torna o parâmetro `strategy` opcional, interpretando sua presença como override explícito que ignora o classificador e documenta a sobreposição no trace.

## Technical Context

**Language/Version**: TypeScript 5.8 / Node.js 22 LTS (ESM, `strict: true`)  
**Primary Dependencies**: `@langchain/langgraph`, `@langchain/core`, `@langchain/openai`, `express`, `zod`  
**Storage**: SQLite via `node:sqlite` (`DatabaseSync`), com persistência de conversas e memórias vetoriais  
**Testing**: `node:test` (`tsx --test`) e checagem de tipos estrita (`npm run typecheck`)  
**Target Platform**: Linux / Windows Node.js LTS server  
**Project Type**: Web service / Agentic workflow backend  
**Performance Goals**: Roteamento estruturado em $< 1.5$s; sobrecarga do grafo em relação à execução direta da estratégia inferior a 15%  
**Constraints**: Validação estrita via Zod em todas as fronteiras externas; 100% dos eventos de trace com atributo `node`; suporte a fallback seguro se a classificação do roteador falhar  
**Scale/Scope**: 1 novo arquivo principal (`src/agents/production-graph.ts`), testes dedicados (`src/agents/production-graph.test.ts`), adaptações pontuais em `src/agents/types.ts` e `src/http/server.ts`  

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio Constitucional | Status | Justificativa / Conformidade |
|---|---|---|
| **I. Type-safe architecture and boundary validation** | PASS | Toda entrada no `/chat` e saídas estruturadas do roteador são estritamente validadas com schemas `zod`. O estado do grafo é tipado estaticamente com interfaces Typescript. |
| **II. MVC structure and responsibility separation** | PASS | O roteamento e grafo residem na camada de serviço (`src/agents/`), os repositórios em `src/store/` e `src/memory/`, e o controller REST em `src/http/server.ts`. |
| **III. Pure logic and explicit error handling** | PASS | Os nós do grafo operam como funções de transformação que retornam deltas parciais de estado. Fallbacks e exceções são traduzidos em respostas sem crash de processo. |
| **IV. Test-first quality gates** | PASS | A implementação será acompanhada por testes unitários e de integração (`src/agents/production-graph.test.ts` e `src/http/server.test.ts`), mantendo `npm test` e `npm run typecheck` 100% verdes. |
| **V. Secure and operationally safe development** | PASS | Nenhuma credencial em código; fallback defensivo para `react` em caso de falha do modelo; banco configurável e `:memory:` em testes. |

## Project Structure

### Documentation (this feature)

```text
specs/013-grafo-unificado-roteamento/
├── plan.md              # Este plano de implementação
├── research.md          # Decisões técnicas e justificativas de arquitetura
├── data-model.md        # Modelos de estado, entidades e diagramas de transição
├── quickstart.md        # Guia de validação ponta a ponta
├── contracts/           # Contratos de interface
│   └── production-graph-contract.md # Contrato HTTP /chat e contrato do Roteador
├── checklists/
│   └── requirements.md  # Checklist de qualidade da especificação
└── tasks.md             # Fase 2: tarefas atômicas geradas pelo /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── agents/
│   ├── types.ts                   # Adiciona TraceEventType "route" e campo obrigatório node em TraceEvent
│   ├── production-graph.ts        # Criação do grafo unificado, nós e StateGraph compilado
│   ├── production-graph.test.ts   # Testes unitários do grafo, nós, roteador e overrides
│   ├── react.ts                   # Adaptação para enriquecer trace com node="react"
│   ├── plan-and-execute.ts        # Adaptação para enriquecer trace com node="plan-and-execute"
│   └── reflection.ts              # Adaptação para enriquecer trace com node="reflection"
├── http/
│   ├── server.ts                  # Atualiza /chat para usar strategy opcional e delegar ao grafo de produção
│   └── server.test.ts             # Testes de integração cobrindo roteamento automático e override
└── store/
```

**Structure Decision**: Padrão do repositório em projeto único TypeScript ESM. Componentes agenticos concentrados em `src/agents/`, desacoplados da camada HTTP em `src/http/`.

## Phases & Deliverables

### Phase 0: Research & Foundation (Concluído)
- Elaboração do [research.md](./research.md) resolvendo todas as decisões de design (topologia do grafo, saída estruturada no roteador, enriquecimento de trace com `node` e comportamento de override).

### Phase 1: Design & Contracts (Concluído)
- Definição do [data-model.md](./data-model.md) detalhando `ProductionGraphState`, schemas de validação Zod e ciclo de vida de transições de nós.
- Criação do contrato em [contracts/production-graph-contract.md](./contracts/production-graph-contract.md) descrevendo o payload do `/chat`, o prompt com tabela do roteador e o formato do evento de override.
- Criação do [quickstart.md](./quickstart.md) contendo cenários práticos de execução e validação.

### Phase 2: Implementation (A ser detalhado em `tasks.md`)
- Task 1: Atualizar tipos de trace em `src/agents/types.ts` (`type: "route"`, `node: string`).
- Task 2: Implementar nós e o grafo compilado em `src/agents/production-graph.ts`.
- Task 3: Criar testes do grafo em `src/agents/production-graph.test.ts`.
- Task 4: Integrar o grafo de produção no endpoint `/chat` em `src/http/server.ts`.
- Task 5: Atualizar e expandir testes de integração em `src/http/server.test.ts`.
- Task 6: Validação de qualidade com `npm test` e `npm run typecheck`.

## Complexity Tracking

> Nenhuma violação constitucional detectada. Sem padrões complexos desnecessários.
