# Research: Sumarização de Histórico Conversacional (Pruning)

**Feature**: `011-sumarizacao-historico-pruning`  
**Date**: 2026-10-30  

## Contexto & Objetivos

No OpsPilot, o histórico conversacional bruto retido diretamente no SQLite cresce linearmente conforme os turnos aumentam. Atualmente, `SqliteConversationStore.lastMessages` busca as últimas mensagens (antes 12, agora 8). Quando uma conversa se estende, as mensagens anteriores são simplesmente descartadas pelo `LIMIT`, perdendo contexto operacional decisivo (ex.: "qual cluster foi reiniciado no turno 2", "qual incidente ainda está pendente").

Para mitigar isso com custo mínimo e sem introduzir latência desnecessária a cada requisição:
1. **Janela recente bruta**: Fixada em 8 mensagens (`RECENT_WINDOW_SIZE = 8`).
2. **Janela de poda (batch trigger)**: Dispara a sumarização **estritamente em múltiplos de 8 mensagens que saíram da janela** (`PRUNE_BATCH_SIZE = 8`).
3. **Persistência do resumo**: Tabela dedicada `conversation_summaries` no SQLite.
4. **Mesclagem cumulativa**: O resumo anterior é enviado junto às novas 8 mensagens podadas para gerar um resumo unificado de ~150 tokens.
5. **Observabilidade & desacoplamento**: Disparo de evento `"summarize"` e suporte a sumarizador injetável/fake para testes.

---

## 1. Estratégia de Janelamento e Poda (Math & Flow)

Considere uma conversa com $M$ mensagens no total:
- **Janela ativa (recente)**: as últimas $R = 8$ mensagens.
- **Mensagens antes da janela ativa**: as primeiras $M - R$ mensagens.
- **Mensagens já sumarizadas**: marcadas por `last_summarized_message_id` ou pelo offset cumulativo $S$.
- **Mensagens pendentes de sumarização**: $U = (M - R) - S$.
- **Condição de disparo**:
  $$\text{Disparar sumarização} \iff U \ge 8$$

### Exemplo Turno a Turno (Mensagens de 1 a 24):
- **Mensagens 1 a 8**: $M \le 8 \implies M - R \le 0 \implies U = 0$ (não dispara).
- **Mensagens 9 a 15**: $M \in [9, 15] \implies M - R \in [1, 7] \implies U < 8$ (não dispara, nunca a cada request).
- **Mensagem 16**: $M = 16 \implies M - R = 8 \implies U = 8$. **Dispara sumarização!**
  - Mensagens 1 a 8 são podadas e mescladas com resumo anterior (vazio).
  - $S$ avança para 8 (ou ID da mensagem 8).
  - Emite evento `"summarize"`.
- **Mensagens 17 a 23**: $M - R \in [9, 15]$, $S = 8 \implies U \in [1, 7]$ (não dispara).
- **Mensagem 24**: $M = 24 \implies M - R = 16$, $S = 8 \implies U = 8$. **Dispara segundo `"summarize"`!**
  - Mensagens 9 a 16 são mescladas com o resumo gerado no turno 16.
  - $S$ avança para 16.

---

## 2. Modelagem do Banco SQLite

A tabela `conversation_summaries` complementa o esquema existente:

```sql
CREATE TABLE IF NOT EXISTS conversation_summaries (
  conversation_id TEXT PRIMARY KEY REFERENCES conversations(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  last_summarized_message_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

- `conversation_id`: PK e FK para `conversations`.
- `summary`: Resumo em linguagem natural focado em decisões, fatos e pendências (~150 tokens).
- `last_summarized_message_id`: ID da última mensagem da tabela `messages` incluída neste resumo (evita reprocessamento e permite cálculo de lote exato).

---

## 3. Interface do Sumarizador e Suporte a Fake

Para respeitar a arquitetura hexagonal e os princípios de testes rápidos:

```typescript
export interface SummarizerInput {
  previousSummary?: string;
  messagesToSummarize: Array<{ role: string; content: string }>;
}

export interface ConversationSummarizer {
  summarize(input: SummarizerInput): Promise<string>;
}
```

- **FakeSummarizer (para testes)**:
  Concatena marcadores previsíveis (ex: `[RESUMO: ${prev} + ${messages.length} msgs]`) ou gera texto determinístico de forma síncrona/imediata sem rede.
- **LlmConversationSummarizer (produção)**:
  Invoca o LLM com structured output ou prompt focado em extrair:
  - Decisões tomadas
  - Fatos operacionais relevantes (clusters, serviços, alertas)
  - Pendências / tarefas em aberto
  - Limite de ~150 tokens.

---

## 4. Emissão do Evento `"summarize"`

Para observabilidade e testes:
- O `SqliteConversationStore` ou o serviço de sumarização emite o evento `"summarize"` via `EventEmitter` do Node.js (`node:events`), repassando:
  - `conversationId`
  - `previousSummary`
  - `messagesSummarized`
  - `newSummary`
- Nos testes unitários e de integração, `eventEmitter.on("summarize", listener)` permite asserções diretas de que o evento disparou no momento exato (ex.: na mensagem 16 e 24, e não nas intermediárias).

---

## 5. Injeção no Prompt

Em `src/http/server.ts`, a função `composePrompt` é enriquecida:

```typescript
function composePrompt(
  history: ConversationMessage[],
  currentMessage: string,
  memories: MemoryRecord[] = [],
  summary?: string,
): string {
  const summaryLine = summary ? `SUMMARY: ${summary}` : undefined;
  const memoryLines = memories.map((m) => `MEMORY: ${m.fact}`);
  const historyLines = history.map((m) => `${m.role === "user" ? "USER" : "ASSISTANT"}: ${m.content}`);

  const parts = [
    ...(summaryLine ? [summaryLine] : []),
    ...memoryLines,
    ...historyLines,
  ];

  if (parts.length === 0) {
    return currentMessage;
  }
  return [...parts, `USER: ${currentMessage}`].join("\n");
}
```

Também atualiza o cálculo de `calculateContextBreakdown` ou o total estimado para contabilizar os tokens do resumo.

