# Research Notes: Medição e instrumentação de tokens do contexto

## Decision 1: Heurística `estimateTokens` baseada em `chars / 4`

- **Decision**: Implementar `estimateTokens(text: string): number` como `Math.ceil(text.trim().length / 4)` (ou `Math.ceil(text.length / 4)` com caso base 0 para string vazia).
- **Rationale**: A aproximação padrão da indústria (OpenAI, Anthropic e LangChain) para texto em idiomas ocidentais estabelece que 1 token equivale em média a ~4 caracteres (ou ~0.75 palavras). É uma função pura, síncrona, extremamente rápida (O(1) após leitura de tamanho de string) e sem dependência de bibliotecas pesadas de tokenização em runtime C/Wasm como `tiktoken`, preservando leveza operacional.
- **Alternatives considered**:
  - Biblioteca `tiktoken` (cl100k_base): rejeitada para evitar dependências nativas/Wasm adicionais e complexidade de compilação em múltiplos ambientes, já que a especificação pediu explicitamente a heurística `chars/4`.
  - Contagem de palavras simples (`words * 1.33`): rejeitada porque variações de pontuação e código afetam muito a contagem de palavras, enquanto `chars / 4` é mais estável.

## Decision 2: Extração de `promptTokens` real a partir do LangChain

- **Decision**: Extrair a contagem real de tokens a partir do campo `usage_metadata.input_tokens` (ou `response_metadata.tokenUsage.promptTokens`) das mensagens `AIMessage` retornadas pela execução do agente LangChain / LangGraph. Quando indisponível (ex: mocks de teste ou provedores sem suporte a usage), utilizar `estimateTokens(prompt)` como fallback defensivo.
- **Rationale**: Provedores LLM modernos via ChatOpenAI (OpenRouter) retornam a contagem exata e faturável de tokens no metadata da resposta do modelo (`usage_metadata: { input_tokens, output_tokens, total_tokens }`). Ao somar ou extrair o último `input_tokens` das chamadas de modelo da iteração, obtemos a medição real consumida na GPU/provedor sem overhead adicional.
- **Alternatives considered**:
  - Chamar endpoint remoto de contagem de tokens do provedor: rejeitado por introduzir latência de rede extra em cada requisição.
  - Usar apenas tokens estimados sem usage real: rejeitado pois a especificação requer tanto o usage real do LangChain quanto o breakdown estimado.

## Decision 3: Estrutura e cálculo do `contextBreakdown` por fontes

- **Decision**: Decompor o prompt em suas três fontes essenciais no OpsPilot:
  1. `memories`: texto de fatos injetados (`MEMORY: <fato>`).
  2. `history`: mensagens acumuladas do diálogo (`USER: <msg>`, `ASSISTANT: <resp>`).
  3. `userMessage`: mensagem atual enviada pelo usuário (`USER: <msg>`).
  4. `totalEstimated`: soma total calculada para o prompt composto.
- **Rationale**: O endpoint `POST /chat` já possui a função `composePrompt`, que concatena exatamente essas três seções. Calcular a estimativa individualmente para cada uma dessas coleções antes da junção permite fornecer visibilidade transparente de quem está consumindo a janela de contexto.
- **Alternatives considered**:
  - Parsing reverso do prompt gerado via regex: rejeitado por ser frágil se a formatação do prompt mudar.
  - Atribuir tokens a tags internas de sistema do modelo: rejeitado por variar de modelo para modelo.

## Decision 4: Design e portabilidade de `conversa-longa.sh`

- **Decision**: Criar `conversa-longa.sh` como script Bash portátil compatível com Linux/macOS e Git Bash / WSL no Windows, utilizando `curl` para chamadas HTTP e extração via `node -e` ou `jq` (com fallback).
- **Rationale**: Garante execução sem dependências extras além de Node.js e cURL (presentes em qualquer ambiente de desenvolvimento do projeto). O script gera um `conversationId` UUID (via `node -e "console.log(crypto.randomUUID())"`), envia sequencialmente 3 a 4 mensagens e exibe no terminal o `promptTokens` de cada turno de forma limpa.
- **Alternatives considered**:
  - Script exclusivo PowerShell (`conversa-longa.ps1`): rejeitado porque a especificação solicitou explicitamente `conversa-longa.sh`.
  - Script em Python: rejeitado para não introduzir runtime Python em um projeto 100% Node.js/TypeScript.

