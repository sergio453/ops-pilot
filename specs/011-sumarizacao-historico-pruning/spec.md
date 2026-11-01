# Feature Specification: Sumarização de Histórico Conversacional (Pruning)

**Feature Branch**: `[011-sumarizacao-historico-pruning]`

**Created**: 2026-10-30

**Status**: Draft

**Input**: User description: "Sumarização de histórico (pruning): tabela conversation_summaries; o que sai das 8 mensagens recentes vira resumo de 150 tokens preservando decisões, fatos e pendências, MESCLADO ao resumo anterior e persistido - refeito só quando 8 novas saem da janela, nunca a cada request. Resumo entra no contexto; evento "sumarize". Com teste fake"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Persistência e gerenciamento de resumo de conversa (Priority: P1) 🎯 MVP

Como desenvolvedor ou operador do OpsPilot, quero persistir e recuperar resumos de conversas na tabela `conversation_summaries`, mantendo o histórico de mensagens podadas consolidado com o resumo anterior em ~150 tokens, preservando decisões tomadas, fatos operacionais e pendências em aberto.

**Why this priority**: É o alicerce de dados e estado necessário para permitir que conversas longas não estourem a janela de contexto sem perder informações críticas do passado.

**Independent Test**: Pode ser testado através de métodos no `SqliteConversationStore` (ou componente dedicado `ConversationSummarizerStore`) criando, atualizando e recuperando resumos com a contagem de mensagens resumidas (`last_summarized_message_id` ou `message_count`).

**Acceptance Scenarios**:

1. **Given** uma conversa com histórico, **When** um resumo é gravado na tabela `conversation_summaries`, **Then** ele fica associado ao `conversation_id`, contendo o texto do resumo, carimbo de data/hora e o ponteiro/contador da última mensagem processada.
2. **Given** uma conversa sem resumo existente, **When** o resumo é consultado, **Then** o sistema retorna `null` ou string vazia de forma segura sem lançar exceções.
3. **Given** um resumo existente e novas mensagens que saíram da janela, **When** um novo ciclo de sumarização ocorre, **Then** o novo resumo é mesclado ao resumo anterior e a tabela `conversation_summaries` é atualizada (UPSERT / REPLACE).

---

### User Story 2 - Gatilho de sumarização em lote (Pruning por janelamento de 8) (Priority: P2)

Como engenheiro de sistemas, quero que a sumarização seja disparada **somente** quando 8 mensagens antigas tiverem saído da janela de 8 mensagens recentes (isto é, em múltiplos de 8 mensagens que saíram da janela ativa, totalizando a cada 8 novas mensagens podadas), **nunca a cada request**, emitindo o evento `"summarize"` e chamando um sumarizador plugável (com suporte a fake/mock nos testes).

**Why this priority**: Evita custos excessivos e latência gerados por chamadas desnecessárias de LLM a cada requisição HTTP, garantindo execução em batelada determinística.

**Independent Test**: Simular o envio de 1 a 24 mensagens em sequência numa conversa:
- Com até 8 mensagens no total: nenhuma sumarização dispara.
- Quando as mensagens ultrapassam 8 recentes (ex: chegam a 16 mensagens, onde 8 saíram da janela recente): o evento `"summarize"` é disparado exatamente uma vez, sumarizando as 8 mensagens podadas com o resumo anterior (se houver).
- Da mensagem 17 a 23: nenhuma nova sumarização.
- Na mensagem 24 (mais 8 saíram): dispara o segundo `"summarize"`.

**Acceptance Scenarios**:

1. **Given** uma conversa com menos de 8 mensagens além da janela ativa (ou seja, menos de 8 mensagens acumuladas fora dos 8 itens recentes), **When** uma nova mensagem chega, **Then** nenhuma chamada de sumarização é feita e nenhum evento `"summarize"` é emitido.
2. **Given** que exatamente 8 novas mensagens saíram da janela recente de 8 mensagens, **When** o ciclo de pré-processamento/pós-processamento executa, **Then** o evento `"summarize"` é emitido e a função de sumarização é disparada.
3. **Given** um ambiente de teste, **When** um sumarizador fake/mock for fornecido, **Then** o evento `"summarize"` deve ser capturado com os argumentos corretos e o resumo simulado deve ser mesclado sem invocar APIs externas de LLM.

---

### User Story 3 - Injeção do Resumo no Contexto do Prompt (Priority: P3)

Como agente de IA operando incidentes, quero que o resumo ativo da conversa seja injetado no prompt montado para o raciocínio (`SUMMARY: ...` ou similar) junto às memórias semânticas e às 8 mensagens recentes, garantindo que o agente tome decisões ciente de fatos e pendências passadas.

**Why this priority**: Fecha o ciclo de ponta a ponta, permitindo que o LLM consuma tanto o resumo compacto quanto os turnos recentes.

**Independent Test**: Enviar requisições no endpoint `POST /chat` com uma conversa que já acumulou resumo prévio, e validar que o prompt composto contém a seção de resumo além do histórico recente de 8 mensagens.

**Acceptance Scenarios**:

1. **Given** uma conversa com resumo ativo em `conversation_summaries`, **When** `composePrompt` é chamado, **Then** o texto do resumo é incluído como `SUMMARY: <texto>` antes das mensagens recentes de histórico.
2. **Given** uma conversa sem resumo, **When** `composePrompt` é chamado, **Then** o prompt inclui apenas memórias (se houver) e mensagens recentes, sem linha de `SUMMARY:`.
3. **Given** a composição do contexto com resumo, **When** o `contextBreakdown` for calculado, **Then** o cálculo de tokens estimados considera o resumo no breakdown ou no total estimado.

---

### Edge Cases

- O que acontece se a geração do resumo falhar ou lançar exceção no provedor de LLM?
  - A conversa principal e a resposta ao usuário não devem ser interrompidas; a falha deve ser registrada em log e o estado anterior do resumo deve ser preservado para retry no próximo turno elegível.
- O que acontece se o resumo gerado ultrapassar sensivelmente ~150 tokens?
  - O prompt de sumarização deve instruir explicitamente a concisão (~150 tokens) focando estritamente em decisões, fatos e pendências; adicionalmente, testes com sumarizador fake validam o comportamento estrutural do armazenamento e fusão.
- E se o banco SQLite estiver em `:memory:`?
  - A tabela `conversation_summaries` deve ser criada na inicialização do esquema de banco tanto em disco quanto em `:memory:`.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O banco SQLite MUST criar a tabela `conversation_summaries` com colunas:
  - `conversation_id TEXT PRIMARY KEY REFERENCES conversations(id)`
  - `summary TEXT NOT NULL`
  - `last_summarized_message_id INTEGER NOT NULL` (ou contador de mensagens processadas)
  - `created_at TEXT NOT NULL`
  - `updated_at TEXT NOT NULL`
- **FR-002**: A janela ativa de mensagens recentes retidas no histórico bruto MUST ser ajustada para 8 mensagens (ao invés das 12 anteriores).
- **FR-003**: As mensagens que saírem da janela de 8 recentes MUST ser elegíveis para sumarização.
- **FR-004**: O processo de sumarização MUST disparar apenas quando um lote de 8 novas mensagens tiver saído da janela recente desde a última sumarização, e NUNCA a cada request individual.
- **FR-005**: Ao sumarizar, o novo resumo gerado MUST ser mesclado ao resumo anterior (se houver), preservando decisões, fatos operacionais e pendências, com target em torno de 150 tokens.
- **FR-006**: O sistema MUST emitir um evento identificável `"summarize"` quando a sumarização for disparada, contendo os metadados da operação (como `conversationId`, mensagens resumidas ou quantidade).
- **FR-007**: A função/serviço de sumarização MUST ser injetável/configurável, aceitando uma implementação fake para permitir testes unitários e de integração determinísticos sem custo de LLM.
- **FR-008**: O prompt montado para as estratégias de raciocínio no `/chat` MUST incluir o resumo existente (`SUMMARY: <resumo>`), posicionado antes das mensagens recentes.
- **FR-009**: O sistema MUST fornecer testes unitários e de integração completos com fake summarizer validando:
  - Criação e persistência na tabela `conversation_summaries`.
  - Disparo do evento `"summarize"` estritamente na 8ª mensagem que sai da janela recente.
  - Injeção do resumo no prompt composto.

### Key Entities

- **ConversationSummary**:
  - `conversationId`: Identificador da conversa.
  - `summary`: Texto sumarizado condensando decisões, fatos e pendências.
  - `lastSummarizedMessageId`: ID da última mensagem bruta incorporada ao resumo.
  - `updatedAt`: Timestamp ISO-8601 da última atualização.
- **SummarizeEvent**:
  - `conversationId`: Identificador da conversa.
  - `previousSummary`: Resumo anterior que entrou na fusão.
  - `messagesSummarized`: Array de mensagens compactadas neste lote.
  - `newSummary`: Resumo resultante.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em um diálogo com 15 mensagens, zero sumarizações ocorrem até que 8 mensagens saiam da janela recente.
- **SC-002**: Na 16ª mensagem (onde exatamente 8 mensagens saíram da janela de 8 recentes), o evento `"summarize"` dispara exatamente 1 vez e o registro em `conversation_summaries` é criado.
- **SC-003**: Nas mensagens 17 a 23, nenhuma nova sumarização é disparada.
- **SC-004**: Na 24ª mensagem, o segundo evento `"summarize"` dispara mesclando o resumo anterior com o novo lote de 8 mensagens.
- **SC-005**: Em todas as requisições subsequentes à sumarização, o prompt enviado ao modelo contém o prefixo `SUMMARY:` com o conteúdo consolidado.
- **SC-006**: 100% dos testes da suíte passam com fake summarizer sem necessidade de conexão de rede ou credenciais de LLM.

## Assumptions

- O limite de retenção bruta ativa é de 8 mensagens (4 turnos usuário/assistente).
- A cada 8 mensagens que saem dessa janela (isto é, acúmulo de lote de 8 mensagens não sumarizadas), dispara-se o processo de pruning e consolidação.
- O evento `"summarize"` pode ser emitido via EventEmitter do Node.js ou callback instrumentado.

