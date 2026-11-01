# Contract: Medição e instrumentação de tokens do contexto

## 1. Programmatic Contract: `src/context/tokens.ts`

### `estimateTokens(text: string): number`

Calcula uma estimativa rápida de tokens com base na razão de 4 caracteres por token.

- **Entrada**: `text: string`
- **Retorno**: `number` (inteiro não negativo)
- **Comportamento**:
  - Se `text` for string vazia ou nula: retorna `0`.
  - Caso contrário: retorna `Math.ceil(text.length / 4)`.

### `extractPromptTokens(messages: unknown[], fallbackText?: string): number`

Extrai o número real de tokens de prompt (`input_tokens`) das mensagens `AIMessage` retornadas pelo LangChain.

- **Entrada**:
  - `messages: unknown[]`: Lista de mensagens contidas no resultado do agente LangChain.
  - `fallbackText?: string`: Texto do prompt original para estimativa caso nenhum metadata de uso esteja presente.
- **Retorno**: `number` (inteiro $\ge 0$)
- **Comportamento**:
  - Itera pelas mensagens procurando objetos `AIMessage` contendo `usage_metadata.input_tokens` (ou `response_metadata.tokenUsage.promptTokens`).
  - Se encontrado, soma ou retorna os tokens de entrada reportados.
  - Se não houver metadados de tokens e `fallbackText` for fornecido: retorna `estimateTokens(fallbackText)`.
  - Se não houver metadados nem fallback: retorna `0`.

### `calculateContextBreakdown(input: ContextBreakdownInput): ContextBreakdown`

Decompõe as partes do prompt e calcula a estimativa de tokens por fonte.

```typescript
export interface ContextBreakdownInput {
  memories?: Array<{ fact: string }>;
  history?: Array<{ role: string; content: string }>;
  userMessage: string;
}

export interface ContextBreakdown {
  memories: number;
  history: number;
  userMessage: number;
  totalEstimated: number;
}
```

- **Retorno**: `ContextBreakdown` com inteiros representando as estimativas calculadas via `estimateTokens`.

---

## 2. HTTP Interface Contract: `POST /chat` (Metrics Update)

### Response Body (`200 OK`)

```json
{
  "answer": "O cluster principal opera na região us-east-1.",
  "trace": [
    {
      "type": "thought",
      "content": "Consultando memórias..."
    },
    {
      "type": "answer",
      "content": "O cluster principal opera na região us-east-1."
    }
  ],
  "metrics": {
    "llCalls": 1,
    "latencyMs": 412,
    "historyMessages": 2,
    "memoryHits": 1,
    "promptTokens": 142,
    "contextBreakdown": {
      "memories": 38,
      "history": 64,
      "userMessage": 15,
      "totalEstimated": 125
    }
  },
  "conversationId": "3fa85f64-5717-4562-b3fc-2c963f66afa6"
}
```

- **Garantias**:
  - `metrics.promptTokens` é um número inteiro não-negativo.
  - `metrics.contextBreakdown` está sempre presente em respostas de sucesso.
  - Campos legados de métricas (`llCalls`, `latencyMs`, `historyMessages`, `memoryHits`) mantêm seus tipos e comportamentos.

---

## 3. CLI Script Contract: `conversa-longa.sh`

### Execução

```bash
./conversa-longa.sh
# Ou especificando porta customizada:
PORT=3000 ./conversa-longa.sh
```

### Formato de Saída no Terminal

```text
=== Iniciando Simulação de Conversa Longa (ID: c4b14d80-5fc5-4f49-b003-8d697b6fa202) ===

[Turno 1]
Mensagem: "Olá, sou o operador do cluster de produção."
PromptTokens: 84
ContextBreakdown: memories=0, history=0, userMessage=12, total=84

[Turno 2]
Mensagem: "Qual é o status dos nossos alertas críticos?"
PromptTokens: 146
ContextBreakdown: memories=0, history=54, userMessage=11, total=146

[Turno 3]
Mensagem: "Quais runbooks você recomenda para o serviço auth?"
PromptTokens: 218
ContextBreakdown: memories=0, history=120, userMessage=13, total=218

=== Conversa concluída com sucesso. Crescimento de tokens verificado. ===
```

- **Código de saída**:
  - `0`: Todos os turnos foram executados e responderam HTTP 200 com métricas de tokens.
  - `1`: Servidor indisponível ou erro na resposta da API.

