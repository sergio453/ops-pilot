# Contracts: Sumarização de Histórico Conversacional (Pruning)

**Feature**: `011-sumarizacao-historico-pruning`  
**Date**: 2026-10-30  

## 1. Contrato da Interface `ConversationSummarizer`

```typescript
export interface SummarizerInput {
  previousSummary?: string;
  messagesToSummarize: Array<{ role: string; content: string }>;
}

export interface ConversationSummarizer {
  summarize(input: SummarizerInput): Promise<string>;
}
```

### Comportamento Esperado:
- Se `previousSummary` for fornecido, a saída deve mesclar as informações anteriores com os novos eventos.
- A saída deve priorizar: **Decisões tomadas**, **Fatos operacionais** e **Pendências / itens em aberto**.
- A extensão estimada do texto deve girar em torno de ~150 tokens.

---

## 2. Contrato de Eventos

EventEmitter dispara:
- **Nome do evento**: `"summarize"`
- **Payload**:
```typescript
{
  conversationId: string;
  previousSummary?: string;
  messagesSummarized: Array<{ id: number; role: "user" | "assistant"; content: string }>;
  newSummary: string;
}
```

---

## 3. Contrato de Composição de Prompt no `/chat`

Quando um resumo existe para a conversa `conv-123`:
```
SUMMARY: O cluster auth-service teve reinício preventivo às 10h. Pendência: validar latência do pod 2.
MEMORY: O usuário opera o cluster de produção em us-east-1
USER: mensagem 9
ASSISTANT: resposta 9
...
USER: mensagem 16
```

Se nenhum resumo existir, o prefixo `SUMMARY:` é omitido.

