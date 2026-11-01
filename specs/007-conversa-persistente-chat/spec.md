# Feature Specification: Conversa persistente no chat

**Feature Branch**: `[007-conversa-persistente-chat]`

**Created**: 2026-10-19

**Status**: Draft

**Input**: User description: "Conversa persistente: ConversationStore (append/lastMessages/create) + tabela messages como no SqliteOpsStore; /chat com conversationId opcional devolvido na resposta; 12 últimas mensagens no prompt via composição; métrica historyMessages; testes com :memory: e fake."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Continuar uma conversa existente (Priority: P1)

Como consumidor da API de chat, quero reutilizar um identificador de conversa para manter contexto entre requisições e obter respostas mais coerentes com o histórico.

**Why this priority**: A continuidade de contexto é o principal valor da feature e muda diretamente a qualidade percebida da interação.

**Independent Test**: Pode ser testada enviando duas ou mais mensagens com o mesmo identificador e verificando que o histórico anterior é considerado antes da nova resposta.

**Acceptance Scenarios**:

1. **Given** uma conversa já existente com mensagens registradas, **When** o cliente envia nova mensagem com o mesmo identificador, **Then** o sistema usa o histórico recente dessa conversa na composição do prompt.
2. **Given** uma requisição bem-sucedida de conversa, **When** a resposta é retornada, **Then** o identificador da conversa é incluído no payload de resposta.

---

### User Story 2 - Iniciar conversa sem identificador prévio (Priority: P2)

Como consumidor da API de chat, quero enviar mensagens sem informar identificador para iniciar conversa de forma simples, sem gestão manual de sessão no primeiro envio.

**Why this priority**: Reduz fricção de integração para clientes novos e mantém retrocompatibilidade de uso básico.

**Independent Test**: Pode ser testada enviando uma requisição sem identificador e confirmando criação de nova conversa e retorno do identificador gerado.

**Acceptance Scenarios**:

1. **Given** uma requisição sem identificador de conversa, **When** o cliente envia a mensagem, **Then** o sistema cria uma nova conversa e retorna o identificador na resposta.
2. **Given** um identificador informado que ainda não existe, **When** a requisição é recebida, **Then** o sistema cria a conversa com esse identificador e processa normalmente.

---

### User Story 3 - Observar uso de histórico na resposta (Priority: P3)

Como consumidor da API, quero uma métrica explícita de histórico utilizado para auditar comportamento de contexto e facilitar diagnóstico durante integrações.

**Why this priority**: Traz observabilidade de comportamento sem depender de inspeção interna do serviço.

**Independent Test**: Pode ser testada comparando respostas de conversa inicial e conversa com histórico, validando a contagem de mensagens usadas em cada caso.

**Acceptance Scenarios**:

1. **Given** uma conversa sem mensagens anteriores, **When** a resposta é emitida, **Then** a métrica de histórico usado indica zero.
2. **Given** uma conversa com mensagens anteriores suficientes, **When** nova requisição é processada, **Then** a métrica indica a quantidade efetivamente usada, limitada ao máximo definido.

### Edge Cases

- O que acontece quando a conversa possui mais de 12 mensagens históricas?
- Como o sistema se comporta quando o cliente envia identificador com espaços em branco nas extremidades?
- O que ocorre quando há timeout ou falha interna após receber a nova mensagem?
- Como o sistema trata tentativas de persistir conteúdo vazio na conversa?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST aceitar `conversationId` como campo opcional na requisição de chat.
- **FR-002**: O sistema MUST criar uma nova conversa quando `conversationId` não for informado.
- **FR-003**: O sistema MUST criar a conversa com o mesmo identificador informado quando `conversationId` não existir previamente.
- **FR-004**: O sistema MUST incluir `conversationId` em toda resposta de chat bem-sucedida.
- **FR-005**: O sistema MUST persistir mensagens de conversa em armazenamento durável associado a um identificador de conversa.
- **FR-006**: O sistema MUST registrar apenas mensagens do usuário e resposta final do assistente no histórico persistido da conversa.
- **FR-007**: O sistema MUST compor o prompt de execução com até as 12 mensagens mais recentes da conversa, em ordem cronológica.
- **FR-008**: O sistema MUST incluir no retorno a métrica `historyMessages` com a quantidade de mensagens históricas efetivamente usadas na composição.
- **FR-009**: O sistema MUST manter os contratos existentes de validação, estratégia desconhecida e timeout sem regressão de comportamento.
- **FR-010**: O sistema MUST permitir validação determinística em testes locais com armazenamento efêmero e estratégia fake sem dependência de rede.

### Key Entities *(include if feature involves data)*

- **Conversation**: Identificador lógico que agrupa o histórico de interações entre cliente e assistente.
- **Conversation Message**: Registro textual de uma interação com papel (`user` ou `assistant`) e instante de criação.
- **Chat Request**: Entrada de mensagem com parâmetros opcionais de estratégia, reflexão e identificador de conversa.
- **Chat Response**: Saída com resposta gerada, rastreabilidade, métricas e identificador de conversa.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% das respostas bem-sucedidas de chat retornam `conversationId`.
- **SC-002**: 100% das conversas com até 12 mensagens anteriores usam todo o histórico disponível na composição.
- **SC-003**: 100% das conversas com mais de 12 mensagens anteriores limitam o histórico utilizado às 12 mensagens mais recentes.
- **SC-004**: 100% das respostas bem-sucedidas informam `historyMessages` compatível com a quantidade de histórico aplicada.
- **SC-005**: Cenários principais de conversa nova e conversa contínua passam de forma determinística em ambiente de teste local sem acesso à rede.

## Assumptions

- Clientes armazenam e reenviam `conversationId` entre chamadas quando desejam continuidade contextual.
- O limite de 12 mensagens atende ao equilíbrio esperado entre contexto útil e custo operacional.
- Mensagens históricas são consideradas em ordem cronológica para preservar sequência semântica da conversa.
- Falhas de processamento antes de resposta final não alteram o contrato de erro já estabelecido para o endpoint.
