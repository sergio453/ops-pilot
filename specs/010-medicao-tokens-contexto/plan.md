# Implementation Plan: Medição e instrumentação de tokens do contexto

**Branch**: `010-medicao-tokens-contexto` | **Date**: 2026-10-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/010-medicao-tokens-contexto/spec.md`

## Summary

Instrumentar a observabilidade de contexto e o consumo de tokens no OpsPilot. A solução implementa em `src/context/tokens.ts` a função pura de estimativa heurística `estimateTokens` (regra `chars / 4`), a captura e agregação do uso real de tokens a partir do LangChain (`usage_metadata.input_tokens`), a decomposição estimada de contexto por fontes (`contextBreakdown` para memórias, histórico e mensagem atual), a inclusão de `promptTokens` e `contextBreakdown` no retorno de métricas do endpoint `POST /chat`, e o script `conversa-longa.sh` para demonstração e inspeção empírica do crescimento de tokens por turno em conversas longas.

## Technical Context

**Language/Version**: TypeScript ESM (`strict: true`) em Node.js 22 LTS

**Primary Dependencies**: `@langchain/core`, `@langchain/openai`, `express`, `zod`, `node:sqlite` (`DatabaseSync`)

**Storage**: SQLite (`OPSPILOT_DB`, padrão `./data/opspilot.db`, ou `:memory:` para testes)

**Testing**: `node --test` via `tsx` (`npm test`) + `npm run typecheck` (`tsc --noEmit`)

**Target Platform**: Serviço backend Node.js 22 LTS / CLI shell script

**Project Type**: Backend web-service / Observability tooling

**Performance Goals**:
- Cálculo de `estimateTokens` e `contextBreakdown` com overhead de CPU desprezível (< 1ms)
- Extração de tokens reais do LangChain sem chamadas extras de rede
- Zero impacto perceptível no throughput do endpoint `POST /chat`

**Constraints**:
- Princípio I da Constituição: Validação de fronteiras com `zod` e tipos TypeScript estritos sem `any`
- Princípio II da Constituição: Separação de responsabilidades (cálculos de tokens isolados em `src/context/tokens.ts`, orquestração no controller `src/http/server.ts`, execução nos agents)
- Princípio III da Constituição: Funções puras para cálculos matemáticos (`estimateTokens`, `calculateContextBreakdown`) e fallbacks defensivos para ausência de metadados
- Princípio IV da Constituição: Cobertura de testes unitários e de integração mantendo `npm test` e `npm run typecheck` 100% verdes
- Princípio V da Constituição: Segurança e operabilidade; scripts CLI portáteis e sem dependências ocultas

**Scale/Scope**: Módulo `src/context/tokens.ts`, testes em `src/context/tokens.test.ts`, atualização de tipos em `src/agents/types.ts`, atualização de métricas no `ReactReasoningStrategy` em `src/agents/react.ts`, extensão do controller `src/http/server.ts`, testes de integração em `src/http/server.test.ts`, e script `conversa-longa.sh`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Type-safe architecture and boundary validation**: PASS  
  Interfaces `ContextBreakdown` e `TokenUsageMetadata` tipadas estritamente. Validação no controller e serialização transparente de métricas.
- **MVC and separation of responsibilities**: PASS  
  Lógica de tokens encapsulada na camada de contexto/serviço (`src/context/`), sem vazamento de detalhes de parsing para o controller HTTP.
- **Pure logic and explicit error handling**: PASS  
  `estimateTokens` e `calculateContextBreakdown` são funções 100% puras, idempotentes e fáceis de testar.
- **Test-first quality gates**: PASS  
  Testes unitários e de integração cobrem estimativa, extração de usage LangChain, fallbacks e retorno HTTP no `/chat`, mantendo `npm test` e `npm run typecheck` 100% verdes.
- **Secure and operationally safe development**: PASS  
  Nenhuma leitura direta de `.env`. Script `conversa-longa.sh` seguro, sem injeção de comandos, com tratamento defensivo de falhas de conexão.

**Post-Design Re-check**: PASS. Todos os artefatos gerados respeitam integralmente os princípios e restrições da Constituição.

## Project Structure

### Documentation (this feature)

```text
specs/010-medicao-tokens-contexto/
├── plan.md              # Este plano de implementação
├── research.md          # Decisões arquiteturais sobre tokens e breakdowns
├── data-model.md        # Entidades ContextBreakdown, TokenUsageMetadata e fluxos
├── quickstart.md        # Roteiro de testes e execução do conversa-longa.sh
├── contracts/
│   └── context-tokens-contract.md # Contratos de tokens, métricas do /chat e CLI
├── checklists/
│   └── requirements.md  # Checklist de qualidade da especificação
└── tasks.md             # Tarefas de implementação (gerado pelo /speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── context/
│   ├── tokens.ts             # Novo: estimateTokens (chars/4), extração LangChain e contextBreakdown
│   └── tokens.test.ts        # Novo: Testes unitários para cálculos e extração de tokens
├── agents/
│   ├── types.ts              # Atualizado: ReasoningMetrics com promptTokens e contextBreakdown
│   └── react.ts              # Atualizado: Extração de promptTokens de result.messages (usage_metadata)
├── http/
│   ├── server.ts             # Atualizado: Composição de contextBreakdown e inclusão no metrics de /chat
│   └── server.test.ts        # Atualizado: Testes de integração de promptTokens e breakdown no /chat
└── conversa-longa.sh         # Novo: Script executável de conversa multi-turno com impressão de tokens
```

## Complexity Tracking

Nenhuma exceção ou violação de princípios constitucionais; tabela de justificativas não se aplica.
