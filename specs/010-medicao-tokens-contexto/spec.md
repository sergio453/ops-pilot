# Feature Specification: Medição e instrumentação de tokens do contexto

**Feature Branch**: `[010-medicao-tokens-contexto]`

**Created**: 2026-10-27

**Status**: Draft

**Input**: User description: "Instrumente a medição de contexto: src/context/tokens.ts com estimateTokens (chars/4) e o usage real do LangChain; métricas do /chat com promptTokens real e contextBreakdown estimado por fontes; conversa-longa.sh imprime o promptTokens por turno. Com testes."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Medição e estimativa de tokens no contexto (Priority: P1) 🎯 MVP

Como desenvolvedor ou operador do OpsPilot, quero ter funções dedicadas em `src/context/tokens.ts` para estimar tokens heuristicamente (caracteres / 4) e capturar o uso real de tokens a partir do LangChain, para quantificar com precisão o volume de contexto processado pelo modelo.

**Why this priority**: É o bloco fundamental de cálculo e extração sobre o qual todas as métricas do chat e análises de custo se apoiam.

**Independent Test**: Pode ser testado invocando `estimateTokens` com strings de comprimentos variados, validando a regra `chars / 4` (arredondada para cima), e invocando o extrator de usage com estruturas de resposta do LangChain contendo `usage_metadata`, verificando a captura fiel de `promptTokens`.

**Acceptance Scenarios**:

1. **Given** um texto com $N$ caracteres, **When** `estimateTokens` é invocado, **Then** o sistema retorna `Math.ceil(N / 4)`.
2. **Given** um texto vazio, **When** `estimateTokens` é invocado, **Then** o sistema retorna 0.
3. **Given** uma lista de mensagens de execução do LangChain contendo metadados de uso (`usage_metadata`), **When** o utilitário de extração é chamado, **Then** o valor real de tokens de prompt (`input_tokens`) é retornado.
4. **Given** uma execução sem metadados de uso do LangChain, **When** o valor real é solicitado, **Then** o sistema utiliza a estimativa baseada no texto do prompt como fallback transparente.

---

### User Story 2 - Métricas de contexto e breakdown por fontes no `/chat` (Priority: P2)

Como consumidor da API de chat, quero que o endpoint `POST /chat` retorne no objeto `metrics` o total de `promptTokens` e o detalhamento estimado por fontes (`contextBreakdown`), para entender visualmente quanto do contexto foi consumido por memórias, histórico e mensagem atual.

**Why this priority**: Permite observabilidade granular sobre a composição do prompt, facilitando a identificação de conversas inchadas ou excesso de contexto injetado.

**Independent Test**: Enviar requisições para `POST /chat` variando o uso de histórico e memórias, validando que a resposta HTTP 200 contém `metrics.promptTokens` (inteiro) e `metrics.contextBreakdown` contendo os valores estimados para cada componente do prompt (`memories`, `history`, `userMessage`, `totalEstimated`).

**Acceptance Scenarios**:

1. **Given** uma requisição bem-sucedida para `POST /chat`, **When** a resposta é retornada com status 200, **Then** o objeto `metrics` contém o campo `promptTokens` representando os tokens reais do prompt.
2. **Given** uma requisição que utilizou memórias e histórico de mensagens anteriores, **When** a resposta é gerada, **Then** `metrics.contextBreakdown` discrimina estimativas separadas para `memories`, `history`, `userMessage` e o total estimado.
3. **Given** uma requisição simples sem histórico e sem memórias, **When** a resposta é gerada, **Then** `contextBreakdown.memories` e `contextBreakdown.history` são 0, e `userMessage` reflete os tokens estimados da mensagem.
4. **Given** a introdução das novas métricas, **When** clientes existentes consom o endpoint, **Then** todos os campos anteriores (`answer`, `trace`, `conversationId`, `metrics.llCalls`, `metrics.latencyMs`, `metrics.historyMessages`, `metrics.memoryHits`) permanecem inalterados.

---

### User Story 3 - Rastreamento de tokens em conversa longa via script (Priority: P3)

Como operador de infraestrutura ou engenheiro de prompt, quero executar o script `conversa-longa.sh` para simular uma conversa de múltiplos turnos e visualizar o crescimento do `promptTokens` a cada iteração, para avaliar empiricamente o impacto da retenção de histórico no consumo de tokens.

**Why this priority**: Fornece uma ferramenta prática e demonstrável de validação operacional em linha de comando, comprovando a instrumentação fim a fim.

**Independent Test**: Executar `./conversa-longa.sh` contra a API local, observando a saída impressa no terminal contendo o número de cada turno, a mensagem enviada e o valor de `promptTokens` extraído da resposta do servidor.

**Acceptance Scenarios**:

1. **Given** o servidor HTTP em execução, **When** o script `conversa-longa.sh` é disparado, **Then** ele realiza chamadas sequenciais para `POST /chat` compartilhando o mesmo `conversationId`.
2. **Given** a execução de cada turno, **When** o servidor responde, **Then** o script extrai e imprime no terminal a contagem de `promptTokens` daquele turno.
3. **Given** o servidor HTTP indisponível ou offline, **When** o script é executado, **Then** ele emite uma mensagem clara de erro operacional e finaliza com código de saída não-zero.

---

### Edge Cases

- O que acontece se o modelo do LangChain não reportar metadados de tokens (`usage_metadata` ausente ou undefined)?
  - O sistema calcula o valor estimado do prompt completo via `estimateTokens` e o utiliza para preencher `promptTokens`, garantindo que o campo nunca retorne nulo ou quebre o contrato da API.
- O que acontece quando a mensagem do usuário ou o histórico contém caracteres Unicode especiais ou emojis?
  - A heurística `chars / 4` considera o tamanho da string em caracteres (`text.length`), mantendo determinismo e velocidade no cálculo.
- O que acontece quando o número de mensagens no histórico atinge o limite máximo (12 mensagens)?
  - A estimativa de `history` no `contextBreakdown` estabiliza proporcionalmente ao tamanho das 12 últimas mensagens retidas.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST criar o módulo `src/context/tokens.ts` exportando a função `estimateTokens(text: string): number`, calculando `Math.ceil(text.length / 4)` (ou 0 para texto vazio).
- **FR-002**: O módulo `src/context/tokens.ts` MUST exportar função para extração do total de `promptTokens` reais a partir de mensagens de execução ou resultados do LangChain, com fallback para estimativa textual quando o usage nativo não estiver presente.
- **FR-003**: O módulo `src/context/tokens.ts` MUST fornecer função de cálculo do `contextBreakdown`, decompondo a estimativa de tokens em fontes: `memories`, `history`, `userMessage` e `totalEstimated`.
- **FR-004**: O tipo `ReasoningMetrics` em `src/agents/types.ts` MUST ser estendido para incluir opcionalmente `promptTokens: number` e `contextBreakdown?: ContextBreakdown`.
- **FR-005**: As estratégias de raciocínio (`ReactReasoningStrategy` e correlatas) MUST extrair o uso real de tokens reportado pelo LangChain ao final da execução do grafo/agente e incluí-lo em suas métricas.
- **FR-006**: O endpoint `POST /chat` em `src/http/server.ts` MUST compor o `contextBreakdown` a partir das partes constituintes do prompt (`memories`, `history`, `userMessage`) e incluí-lo no objeto `metrics` da resposta JSON.
- **FR-007**: O endpoint `POST /chat` MUST incluir `promptTokens` (inteiro não negativo) no objeto `metrics` retornado ao cliente.
- **FR-008**: O repositório MUST incluir o script executável `conversa-longa.sh` na raiz do projeto, com permissão de execução, que interaja com o `/chat` em múltiplos turnos de conversa e imprima os `promptTokens` de cada turno.
- **FR-009**: O sistema MUST fornecer suíte de testes unitários em `src/context/tokens.test.ts` validando a estimativa de tokens, a extração de usage e o cálculo do breakdown.
- **FR-010**: O sistema MUST fornecer testes de integração em `src/http/server.test.ts` validando a presença e corretude de `promptTokens` e `contextBreakdown` na resposta HTTP do endpoint `/chat`.

### Key Entities *(include if feature involves data)*

- **ContextBreakdown**: Estrutura detalhando a distribuição estimada de tokens no prompt:
  - `memories` (number): Tokens estimados provenientes das memórias semânticas injetadas (`MEMORY: ...`).
  - `history` (number): Tokens estimados provenientes do histórico conversacional (`USER: ...`, `ASSISTANT: ...`).
  - `userMessage` (number): Tokens estimados da mensagem atual enviada pelo usuário.
  - `totalEstimated` (number): Soma total dos tokens estimados de todas as partes do contexto.
- **TokenUsageMetadata**: Representação normalizada dos tokens consumidos no ciclo do agente:
  - `promptTokens` (number): Quantidade real de tokens consumidos na entrada do modelo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em 100% dos testes unitários de `estimateTokens`, o valor retornado é exatamente igual a `Math.ceil(chars / 4)` (e 0 para strings vazias).
- **SC-002**: Em 100% das requisições bem-sucedidas do `POST /chat`, a resposta contém os campos `metrics.promptTokens` (inteiro $\ge 0$) e `metrics.contextBreakdown` com a separação por fontes.
- **SC-003**: Em chamadas onde o LangChain reporta `usage_metadata`, o valor retornado em `metrics.promptTokens` coincide com o valor real de `input_tokens` do provedor.
- **SC-004**: O script `conversa-longa.sh` é executável, realiza pelo menos 3 turnos sequenciais em uma mesma conversa e imprime o valor de `promptTokens` por turno de forma clara no terminal.
- **SC-005**: 100% dos testes da suíte (`npm test`) e checagem de tipos estrita (`npm run typecheck`) passam com status verde sem regressões.

## Assumptions

- A heurística `chars / 4` é uma convenção padrão do projeto para aproximação de tokens em modelos baseados em tokenizadores BPE/WordPiece.
- Modelos executados via LangChain com OpenAI / OpenRouter expõem `usage_metadata` contendo `input_tokens` no objeto de mensagem final `AIMessage`.
- O script `conversa-longa.sh` utiliza `curl` e `jq` (ou fallback sem jq via grep/sed) apontando por padrão para `http://localhost:3000/chat` (ou porta configurável via `$PORT`).
