# Feature Specification: Construção de Contexto com Orçamento por Seção (`buildContext`)

**Feature Branch**: `[012-orcamento-contexto-buildcontext]`

**Created**: 2026-10-30

**Status**: Draft

**Input**: User description:
```typescript
export function buildContext(input: BuildInput): BuildContext {
  const sections = [
    section("system", SYSTEM_PROMPT, { budget: B.system, cut: "never" }),
    section("summary", conversations.summaryOf(input.conversationId), { budget: B.summary, cut: "never" }),
    section("history", conversations.lastMessages(input.conversationId, 8), { budget: B.history, cut: "oldest-first" }),
    section("memories", memories.recall(input.userId, input.message, 3), { budget: B.memories, cut: "lowest-score-first" }),
  ];
  const fitted = sections.map(fitToBudget); // aplica teto e regra de corte por seção
  return assemble(fitted, input.message); // + breakdown por seção
}
```

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Modelagem de Seções com Orçamento e Políticas de Corte (Priority: P1) 🎯 MVP

Como engenheiro de prompt do OpsPilot, quero ter uma estrutura declarativa de seções com orçamento máximo de tokens (`budget`) e regras de corte especializadas (`cut`: `"never"` | `"oldest-first"` | `"lowest-score-first"`), para que o contexto nunca ultrapasse a janela máxima do modelo e cada fonte seja podada de forma inteligente.

**Why this priority**: É o motor algorítmico que garante estabilidade de custo e integridade de contexto, prevenindo estouro de janela e priorizando as informações mais relevantes.

**Acceptance Scenarios**:
1. **Given** a seção `"system"` ou `"summary"`, **When** configurada com `{ cut: "never" }`, **Then** o conteúdo é preservado integralmente sem descarte de linhas.
2. **Given** a seção `"history"` com mensagens excedendo `budget`, **When** `fitToBudget` é aplicado com `{ cut: "oldest-first" }`, **Then** as mensagens mais antigas são descartadas sucessivamente até que o total caiba no orçamento.
3. **Given** a seção `"memories"` com itens excedendo `budget`, **When** `fitToBudget` é aplicado com `{ cut: "lowest-score-first" }`, **Then** as memórias com menor score de similaridade são descartadas primeiro.

---

### User Story 2 - Montagem Final e Breakdown por Seção (`assemble`) (Priority: P2)

Como consumidor da API de chat, quero que `buildContext` retorne o texto consolidado do prompt montado (`prompt`) e o breakdown exato de tokens estimados consumidos por cada seção (`breakdown`), para manter total observabilidade sobre o uso de cada componente.

**Acceptance Scenarios**:
1. **Given** as seções ajustadas ao orçamento, **When** `assemble` é executado com a mensagem atual do usuário, **Then** o texto completo do prompt é montado de forma estruturada.
2. **Given** a conclusão de `assemble`, **When** o `BuildContext` é inspecionado, **Then** o campo `breakdown` discrimina os tokens de `system`, `summary`, `history`, `memories`, `userMessage` e o total consolidado.

---

### User Story 3 - Integração no Fluxo do Servidor HTTP `/chat` (Priority: P3)

Como operador do OpsPilot, quero que o endpoint `POST /chat` utilize `buildContext` para preparar o prompt enviado para a estratégia de raciocínio, eliminando montagens ad-hoc e garantindo respeito estrito aos tetos de tokens.

**Acceptance Scenarios**:
1. **Given** uma requisição para `POST /chat`, **When** o contexto é montado, **Then** `buildContext` é invocado e os limites de tokens são respeitados.
2. **Given** a resposta 200 do `/chat`, **When** o objeto `metrics` for retornado, **Then** ele reflete o `contextBreakdown` gerado diretamente pelo `buildContext`.

