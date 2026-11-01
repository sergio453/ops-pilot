# Feature Specification: Reflector de aprendizado e esquecimento de preferências

**Feature Branch**: `[009-reflector-aprendizado]`

**Created**: 2026-10-22

**Status**: Draft

**Input**: User description: "Reflector de aprendizado: após cada resposta um withStructuredOutput({hasLearning, fact }) lê a última mensagem do usuário e destila fatos duráveis (nunca pedido pontual, nunca segredo) -> memories.remember assíncrono; tool forget_preference"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Destilação automática e assíncrona de fatos duráveis (Priority: P1) 🎯 MVP

Como consumidor da API de chat, quero que o sistema identifique e registre automaticamente preferências e fatos duráveis que mencionei na conversa, de forma assíncrona logo após o envio da resposta, para que futuras conversas utilizem esse contexto sem atrasar o retorno da mensagem atual.

**Why this priority**: É o valor central da funcionalidade, permitindo aprendizado contínuo do agente sem penalizar a latência percebida pelo usuário final.

**Independent Test**: Enviar uma mensagem declarando uma preferência durável (ex: "minha região primária de infraestrutura é us-east-1"), receber a resposta do chat imediatamente, e verificar em seguida que o fato foi gravado no repositório de memórias do usuário via reflexão assíncrona.

**Acceptance Scenarios**:

1. **Given** um usuário que envia uma mensagem de chat informando uma preferência ou fato durável, **When** a resposta da mensagem é gerada e enviada ao cliente, **Then** o sistema dispara em segundo plano uma reflexão estruturada que extrai o fato e o grava no repositório de memórias daquele usuário.
2. **Given** uma requisição de chat com `userId` válido, **When** o ciclo de reflexão assíncrona é disparado, **Then** a resposta HTTP é retornada ao cliente sem esperar pela conclusão da extração ou da gravação da memória.
3. **Given** uma requisição de chat sem `userId`, **When** a mensagem é processada, **Then** nenhuma tentativa de persistência em memória ocorre.

---

### User Story 2 - Filtragem estrita contra pedidos pontuais e dados sensíveis (Priority: P2)

Como operador responsável por segurança e governança de dados, quero que o mecanismo de aprendizado descarte pedidos pontuais transitórios e recuse terminantemente a gravação de segredos ou credenciais, para evitar poluição da base de memórias e vazamento de informações confidenciais.

**Why this priority**: Evita riscos de segurança (armazenamento de credenciais) e mantém a memória limpa contra comandos efêmeros que não representam contexto durável.

**Independent Test**: Enviar mensagens contendo comandos temporários (ex: "verifique o status do alertmanager agora") ou credenciais simuladas (ex: chaves de API, senhas), validando que o resultado da reflexão indica ausência de aprendizado durável (`hasLearning: false`) e nenhuma memória é criada.

**Acceptance Scenarios**:

1. **Given** uma mensagem do usuário contendo uma instrução ou pergunta pontual, **When** o reflector analisa o conteúdo, **Then** ele classifica o conteúdo como não-durável (`hasLearning: false`) e não invoca a gravação de memória.
2. **Given** uma mensagem do usuário contendo senhas, chaves de API ou tokens de acesso, **When** o reflector analisa o conteúdo, **Then** ele identifica o dado como segredo/sensível, recusa a extração e descarta a gravação.
3. **Given** uma mensagem contendo uma instrução operacional combinada com uma preferência (ex: "reinicie o pod X e lembre-se que sempre uso o namespace production"), **When** a reflexão é executada, **Then** apenas o fato durável sobre o namespace é destilado, ignorando a ação imediata sobre o pod.

---

### User Story 3 - Esquecimento direcionado de preferências via ferramenta (Priority: P3)

Como operador ou assistente conversacional, quero ter acesso à ferramenta `forget_preference` para remover preferências específicas do usuário sob demanda, garantindo controle operacional sobre memórias desatualizadas ou que o usuário solicitou expressamente esquecer.

**Why this priority**: Fecha o ciclo de vida do aprendizado, garantindo governança, retificação de fatos e conformidade com pedidos de esquecimento.

**Independent Test**: Registrar uma preferência para um usuário, invocar a ferramenta `forget_preference` informando o identificador da preferência pertencente àquele usuário, e verificar que o registro é removido e deixa de existir nas consultas subsequentes.

**Acceptance Scenarios**:

1. **Given** uma preferência salva para um usuário, **When** a ferramenta `forget_preference` é invocada com o identificador correspondente daquele usuário, **Then** a memória é permanentemente removida e a ferramenta retorna confirmação de sucesso.
2. **Given** uma tentativa de executar `forget_preference` com identificador de memória inexistente ou pertencente a outro usuário, **When** a ferramenta é executada, **Then** a exclusão é rejeitada e nenhuma memória de terceiros é alterada.

---

### Edge Cases

- O que acontece se a chamada assíncrona do modelo de linguagem (extração estruturada) falhar ou sofrer timeout?
  - A falha deve ser capturada e registrada em log de diagnóstico, sem impactar a resposta já entregue ao cliente nem interromper o ciclo de vida do servidor.
- O que acontece se a mensagem do usuário for vazia ou contiver apenas saudações ("olá", "bom dia")?
  - O reflector avalia como sem aprendizado durável (`hasLearning: false`) e finaliza sem invocar o store de memórias.
- O que acontece se o fato destilado for quase idêntico a um fato já existente na memória do usuário?
  - A rotina de gravação utiliza o mecanismo de deduplicação semântica já existente (limiar $\ge 0.92$), evitando registros duplicados.
- O que acontece se o usuário solicitar via chat "esqueça minha região preferida"?
  - O agente tem a capacidade de consultar/identificar a memória correspondente e acionar a ferramenta `forget_preference` para efetuar a remoção.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST disparar um ciclo de reflexão de aprendizado após a conclusão de cada resposta do endpoint de chat quando o identificador de usuário (`userId`) estiver presente.
- **FR-002**: O ciclo de reflexão de aprendizado MUST ser executado de forma assíncrona e desacoplada do ciclo de vida da requisição HTTP, garantindo que o cliente receba a resposta do chat sem acréscimo de latência decorrente da extração.
- **FR-003**: O reflector de aprendizado MUST utilizar extração estruturada (`withStructuredOutput`) gerando um objeto com indicação de aprendizado (`hasLearning: boolean`) e fato extraído (`fact?: string`).
- **FR-004**: O sistema MUST instruir o modelo a destilar apenas fatos e preferências duráveis de longo prazo (ex: convenções de trabalho, configurações de ambiente, preferências de formato).
- **FR-005**: O sistema MUST proibir explicitamente e filtrar a extração de pedidos pontuais, ordens operacionais imediatas, perguntas triviais ou temporárias (`hasLearning: false`).
- **FR-006**: O sistema MUST proibir explicitamente e filtrar a extração de segredos, credenciais, senhas, tokens de autorização e chaves de API, garantindo que nenhuma informação sensível seja salva.
- **FR-007**: Quando `hasLearning: true` e `fact` for fornecido e válido (não vazio após normalização), o sistema MUST submeter o fato ao método de persistência de memória (`remember`) vinculado ao `userId`.
- **FR-008**: O sistema MUST disponibilizar uma ferramenta (`tool`) denominada `forget_preference`, permitindo a remoção de memórias de preferência por identificador de memória e usuário.
- **FR-009**: A ferramenta `forget_preference` MUST validar o isolamento por usuário, rejeitando a remoção de memórias que não pertençam ao usuário solicitante.
- **FR-010**: Erros ocorridos durante o processamento da reflexão assíncrona MUST ser tratados com tratamento defensivo e registrados nos canais de diagnóstico, sem gerar rejeições de promessa não tratadas (*unhandled rejections*).

### Key Entities *(include if feature involves data)*

- **Learning Reflection Result**: Estrutura contendo o resultado da análise reflexiva sobre a mensagem:
  - `hasLearning` (boolean): Indica se há fato durável legítimo a ser memorizado.
  - `fact` (string, opcional): Conteúdo textual do fato destilado em formato declarativo e conciso.
- **Durable Preference / Memory**: Representação persistida do fato aprendido na tabela de memórias, vinculada a um `userId`, com vetor semântico e timestamp.
- **Forget Preference Input**: Estrutura de entrada da ferramenta de esquecimento contendo o identificador da memória (`memoryId`) e o identificador do usuário (`userId`).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% das requisições de chat respondidas com `userId` disparam a reflexão de aprendizado de forma não-bloqueante, mantendo zero atraso na entrega da resposta HTTP inicial.
- **SC-002**: Em testes automatizados com comandos pontuais transitórios (ex: "mostre o log", "execute o build"), 0% dessas requisições geram fatos persistidos na memória.
- **SC-003**: Em testes automatizados com declarações contendo padrões de credenciais ou chaves sensíveis, 0% dessas declarações resultam em gravação de memória.
- **SC-004**: Em testes automatizados com declarações claras de preferências de longo prazo, 100% dos fatos válidos identificados são encaminhados para a base de memórias do usuário com deduplicação semântica.
- **SC-005**: Em testes da ferramenta `forget_preference`, 100% das chamadas válidas removem com sucesso a memória especificada e 100% das chamadas para outros usuários são bloqueadas sem exclusão.

## Assumptions

- O modelo de linguagem em uso suporta extração estruturada de esquema tipado (`withStructuredOutput` com Zod).
- O `userId` enviado no chat identifica confiavelmente o mesmo usuário entre requisições.
- O subsistema de memória `SqliteMemoryStore` implementado na feature 008 está disponível e funcional, fornecendo os métodos `remember`, `recall` e `forget`.
- A reflexão avalia primordialmente a última mensagem do usuário (podendo considerar a resposta do assistente como contexto para desambiguação).
- O esquecimento de preferências via `forget_preference` é exposto como ferramenta para ser consumida diretamente pelo agente conversacional ou por integrações compatíveis.
