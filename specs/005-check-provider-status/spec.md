# Feature Specification: Status de provedores externos

**Feature Branch**: `005-check-provider-status`

**Created**: 2026-10-16

**Status**: Draft

**Input**: User description: "Tool de status de provedores externos com consulta pública para GitHub e Cloudflare, uso em triagem de incidentes, timeout de 5 segundos, uma nova tentativa para falhas transitórias, retorno compacto e testes sem rede."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Confirmar se a falha é externa (Priority: P1)

Como plantonista, quero consultar rapidamente o estado de um provedor externo para decidir se o
incidente é interno ou causado por dependência fora do ar.

**Why this priority**: Esta decisão orienta os próximos passos do plantão e evita investigação
interna desnecessária quando o problema está em um serviço terceiro.

**Independent Test**: Pode ser testada consultando cada provedor suportado e validando retorno com
estado resumido legível para tomada de decisão.

**Acceptance Scenarios**:

1. **Given** suspeita de falha em dependência externa, **When** o operador consulta o provedor sem
   informar parâmetro, **Then** recebe o status do provedor padrão em formato compacto.
2. **Given** suspeita de falha em dependência externa, **When** o operador consulta explicitamente
   um provedor suportado, **Then** recebe o status desse provedor em formato compacto.

---

### User Story 2 - Manter diagnóstico útil em instabilidade transitória (Priority: P2)

Como plantonista, quero que a consulta trate falhas transitórias com resiliência controlada para
obter uma resposta útil sem repetir o comando manualmente.

**Why this priority**: Falhas transitórias são comuns em incidentes e uma tentativa adicional reduz
ruído operacional e retrabalho.

**Independent Test**: Pode ser testada simulando falha transitória na primeira tentativa e sucesso
na segunda, além de cenário com falha final.

**Acceptance Scenarios**:

1. **Given** falha de rede ou indisponibilidade temporária na primeira tentativa, **When** a
   consulta é executada, **Then** o sistema realiza exatamente mais uma tentativa antes de concluir.
2. **Given** falha persistente após as tentativas previstas, **When** a consulta é encerrada,
   **Then** o operador recebe uma mensagem de erro legível como resultado da ferramenta.

---

### User Story 3 - Preservar contexto da conversa durante o plantão (Priority: P3)

Como usuário do agente, quero receber uma resposta curta da consulta para não inflar o contexto e
manter foco nas próximas ações de mitigação.

**Why this priority**: Saída compacta melhora legibilidade do chat e reduz custo cognitivo em
situações de pressão.

**Independent Test**: Pode ser testada verificando que respostas de sucesso e de erro final cabem
em uma linha resumida.

**Acceptance Scenarios**:

1. **Given** consulta bem-sucedida, **When** o resultado é apresentado, **Then** o retorno contém
   apenas indicador e descrição do status em uma única linha.
2. **Given** falha final de consulta, **When** o resultado é apresentado, **Then** o retorno contém
   uma mensagem clara para o operador sem interromper o fluxo da conversa.

---

### Edge Cases

- O que acontece quando o operador não informa provedor?
- Como o sistema responde quando a fonte externa demora além do limite de espera?
- Como o sistema responde quando a fonte externa retorna conteúdo inválido ou incompleto?
- Como o sistema responde quando as duas tentativas falham por erro de rede?
- Como o sistema responde quando a fonte externa retorna indisponibilidade do servidor?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST disponibilizar uma ferramenta para consulta de status de provedores
  externos em cenários de triagem operacional.
- **FR-002**: A ferramenta MUST suportar os provedores GitHub e Cloudflare.
- **FR-003**: A ferramenta MUST usar GitHub como valor padrão quando o provedor não for informado.
- **FR-004**: A ferramenta MUST orientar seu uso para diagnóstico de dúvida operacional do tipo "é
  problema nosso ou do provedor?".
- **FR-005**: A ferramenta MUST encerrar cada tentativa de consulta quando ultrapassar 5 segundos.
- **FR-006**: A ferramenta MUST executar exatamente uma nova tentativa quando houver falha de rede
  ou falha de servidor da fonte externa.
- **FR-007**: A ferramenta MUST tratar como sucesso apenas respostas no formato esperado de status
  com indicador e descrição.
- **FR-008**: A ferramenta MUST retornar em caso de sucesso um resumo de uma linha com indicador e
  descrição do estado atual.
- **FR-009**: A ferramenta MUST retornar mensagem de erro legível como resultado quando a consulta
  falhar ao final da política de tentativas.
- **FR-010**: A ferramenta MUST tratar erro como observação operacional e nunca propagar exceção
  para fora do limite da própria ferramenta.
- **FR-011**: A solução MUST permitir substituir a função de consulta externa para testes sem rede.
- **FR-012**: O sistema MUST possuir testes automatizados cobrindo, no mínimo, sucesso, timeout e
  resposta inválida sem acesso à internet.

### Key Entities *(include if feature involves data)*

- **Provider Input**: Seleção do provedor alvo da consulta, com valor padrão quando não informado.
- **Provider Status Output**: Resumo operacional compacto com indicador e descrição para decisão de
  triagem.
- **Provider Error Output**: Mensagem final legível de falha após esgotamento da política de
  tentativas.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% das consultas bem-sucedidas retornam resposta compacta em uma linha contendo
  indicador e descrição.
- **SC-002**: 100% das falhas finais retornam mensagem legível para operador, sem interromper o
  fluxo da ferramenta.
- **SC-003**: 100% das falhas transitórias elegíveis acionam no máximo uma nova tentativa antes da
  conclusão.
- **SC-004**: A suíte de testes da feature valida, sem rede real, os três cenários críticos:
  sucesso, timeout e resposta inválida.

## Assumptions

- Nesta versão, o escopo é restrito a dois provedores externos: GitHub e Cloudflare.
- O resumo de uma linha é suficiente para decisão inicial de triagem durante o plantão.
- A validação de entrada segue o padrão já existente do projeto para parâmetros de ferramenta.
- Mensagens de erro legíveis devem priorizar ação operacional e não detalhamento técnico interno.
