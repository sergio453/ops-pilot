# Feature Specification: Memória semântica por usuário

**Feature Branch**: `[008-memoria-semantica-chat]`

**Created**: 2026-10-20

**Status**: Draft

**Input**: User description: "Memória Semântica: MemoryStore por userId - rember (deup > 0.92 ), recall top-3 por produto escalar(min 0.3), forget; tabela memories, embedding all-MiniLM-L6-v2 local em BLOB; /chat ganha userId e injeta o recall no prompt; teste: recall acha fato sem palavra em comum. user: @huggingface/transformers com pooling: mean + normaliza: true e lazy singleton src/memory/embeddings.ts e src/memory/memory-store.ts. As colunas de memories (id, user_id, fact, embedding, created_at)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Relembrar fatos relevantes no chat (Priority: P1)

Como consumidor da API, quero que o sistema recupere memórias relevantes do usuário no momento da conversa para gerar respostas mais contextualizadas, mesmo quando a pergunta não repete as mesmas palavras do fato salvo.

**Why this priority**: A recuperação semântica é o principal valor da feature e impacta diretamente a utilidade do chat em produção.

**Independent Test**: Pode ser testada salvando um fato para um usuário e fazendo uma pergunta semanticamente equivalente com vocabulário diferente, validando que o fato aparece entre os itens recuperados e influencia o contexto da resposta.

**Acceptance Scenarios**:

1. **Given** que um usuário possui fatos previamente salvos, **When** ele envia uma nova mensagem relacionada, **Then** o sistema recupera até três memórias mais relevantes desse usuário para compor o contexto da conversa.
2. **Given** que há memórias relevantes acima do limiar mínimo, **When** a requisição de chat é processada com `userId`, **Then** o contexto usado para gerar a resposta inclui essas memórias recuperadas.
3. **Given** que existe um fato semanticamente relacionado sem palavras em comum com a consulta, **When** a recuperação é executada, **Then** o fato ainda pode ser recuperado por similaridade semântica.

---

### User Story 2 - Evitar duplicidade de memórias (Priority: P2)

Como consumidor da API, quero evitar registros duplicados de fatos muito semelhantes para manter uma memória limpa e útil por usuário.

**Why this priority**: Reduz ruído no contexto recuperado e evita crescimento desnecessário da base de memórias.

**Independent Test**: Pode ser testada tentando salvar duas vezes fatos semanticamente quase idênticos para o mesmo usuário e validando que apenas um registro é mantido.

**Acceptance Scenarios**:

1. **Given** um fato já salvo para um usuário, **When** um novo fato com similaridade acima do limite de deduplicação é enviado, **Then** o sistema não cria um novo registro duplicado.
2. **Given** dois fatos similares para usuários diferentes, **When** ambos são salvos, **Then** cada usuário mantém seu próprio registro sem interferência cruzada.

---

### User Story 3 - Esquecer memórias específicas (Priority: P3)

Como consumidor da API, quero remover um fato específico da memória de um usuário para corrigir ou limpar contexto que não deve mais ser utilizado.

**Why this priority**: Garante controle operacional sobre o conteúdo persistido e permite ajustes de contexto ao longo do tempo.

**Independent Test**: Pode ser testada removendo um fato por identificador e validando que ele deixa de aparecer em recuperações futuras para o mesmo usuário.

**Acceptance Scenarios**:

1. **Given** um fato salvo para um usuário, **When** a operação de esquecimento é executada para aquele identificador, **Then** o fato não é mais retornado nas próximas recuperações desse usuário.
2. **Given** um identificador de memória que pertence a outro usuário, **When** a remoção é solicitada, **Then** nenhum registro do usuário atual é removido.

### Edge Cases

- O que acontece quando o `userId` não é informado na requisição de chat?
- Como o sistema se comporta quando não há memórias com similaridade mínima suficiente?
- O que acontece quando mais de três memórias superam o limiar de similaridade?
- Como o sistema trata tentativas de esquecer um identificador inexistente?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST aceitar `userId` como campo opcional na entrada do chat.
- **FR-002**: O sistema MUST manter memórias vinculadas a um usuário específico e impedir recuperação cruzada entre usuários.
- **FR-003**: O sistema MUST oferecer uma operação de registro de memória que salve fato textual por usuário.
- **FR-004**: O sistema MUST aplicar deduplicação semântica na operação de registro e impedir novo registro quando a similaridade for maior que 0.92 para o mesmo usuário.
- **FR-005**: O sistema MUST oferecer uma operação de recuperação semântica por usuário que retorne no máximo 3 memórias ordenadas por relevância.
- **FR-006**: O sistema MUST considerar apenas memórias com similaridade mínima de 0.30 na recuperação.
- **FR-007**: O sistema MUST oferecer operação de esquecimento por identificador e usuário, removendo apenas o registro correspondente.
- **FR-008**: O sistema MUST incluir as memórias recuperadas no contexto de geração de resposta do chat quando `userId` for informado e houver itens elegíveis.
- **FR-009**: O sistema MUST preservar o comportamento atual do chat quando `userId` não for informado ou quando nenhuma memória atender ao limiar mínimo.
- **FR-010**: O sistema MUST persistir cada memória com os atributos `id`, `user_id`, `fact`, `embedding` e `created_at`.
- **FR-011**: O sistema MUST permitir validação automatizada do cenário em que um fato semanticamente relevante é recuperado mesmo sem compartilhar palavras com a consulta.

### Key Entities *(include if feature involves data)*

- **Memory**: Fato textual associado a um único usuário, com conteúdo, vetor semântico e instante de criação.
- **Memory Recall Result**: Item retornado pela recuperação semântica com referência da memória e seu nível de relevância.
- **Chat Request**: Mensagem de entrada com identificador opcional de usuário para contextualização semântica.
- **Chat Response**: Resposta gerada com métricas e rastreabilidade sobre o uso de memória contextual.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em testes automatizados de recuperação semântica por usuário, 100% dos resultados retornados pertencem ao usuário solicitante.
- **SC-002**: Em testes automatizados, 100% das recuperações respeitam simultaneamente limite máximo de 3 itens e limiar mínimo de similaridade de 0.30.
- **SC-003**: Em testes automatizados de deduplicação, 100% das tentativas de registrar fatos acima do limiar de 0.92 não criam registros adicionais para o mesmo usuário.
- **SC-004**: Em testes automatizados de esquecimento, 100% dos fatos removidos deixam de aparecer em recuperações futuras do mesmo usuário.
- **SC-005**: Em teste automatizado de regressão, um caso de consulta semanticamente equivalente sem palavras em comum recupera corretamente o fato esperado.

## Assumptions

- O identificador de usuário informado no chat representa uma identidade estável para agrupamento das memórias.
- O escopo inicial cobre operações de registrar, recuperar e esquecer memórias por usuário, sem necessidade de edição parcial de fatos.
- O sistema pode continuar respondendo normalmente mesmo quando não houver memórias relevantes para contextualização.
- A avaliação de qualidade da recuperação semântica será feita por cenários automatizados determinísticos definidos pelo time.
