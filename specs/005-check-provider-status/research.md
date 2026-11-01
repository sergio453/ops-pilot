# Research Notes: Status de provedores externos

## Decision 1: Usar API pública de status por provedor com mapeamento explícito

- **Decision**: Mapear provedores suportados para endpoints públicos de status e limitar escopo a
  GitHub e Cloudflare nesta versão.
- **Rationale**: Mantém a consulta determinística, sem autenticação e alinhada ao requisito de
  triagem rápida para dependências externas.
- **Alternatives considered**:
  - Permitir URL arbitrária na entrada da tool.
  - Integrar múltiplos serviços de status além do escopo solicitado.
  - Usar scraping de páginas HTML em vez de endpoint de status estruturado.

## Decision 2: Aplicar timeout por tentativa com limite rígido

- **Decision**: Encerrar cada chamada de consulta após 5 segundos para evitar bloqueio da conversa
  em cenários de lentidão externa.
- **Rationale**: Em plantão, latência prolongada degrada a decisão operacional; limite rígido reduz
  espera e permite fallback rápido.
- **Alternatives considered**:
  - Timeout maior para tentar maximizar chance de sucesso.
  - Sem timeout explícito e depender de timeout padrão do runtime.
  - Timeout global único compartilhado entre todas as tentativas.

## Decision 3: Retry único apenas para falhas transitórias

- **Decision**: Realizar exatamente uma nova tentativa somente em falha de rede ou erro de servidor
  remoto.
- **Rationale**: Equilibra resiliência e previsibilidade, evitando repetição excessiva e mantendo
  comportamento simples para o operador.
- **Alternatives considered**:
  - Sem retry.
  - Retry com backoff e múltiplas tentativas.
  - Retry também para respostas inválidas de payload.

## Decision 4: Validar payload de sucesso com schema mínimo de status

- **Decision**: Considerar sucesso apenas quando o payload contiver status com indicador e
  descrição válidos.
- **Rationale**: Garante que a saída compacta seja baseada em dado confiável, não em estrutura
  parcial ou inesperada.
- **Alternatives considered**:
  - Aceitar payload parcial e completar campos com valores padrão.
  - Confiar no contrato externo sem validação local.
  - Retornar JSON bruto ao usuário.

## Decision 5: Erro final como observação legível, sem throw externo

- **Decision**: Toda falha final retorna string de erro legível como resultado da tool, sem exceção
  propagada para fora.
- **Rationale**: Alinha com o fluxo de agentes conversacionais, onde erro operacional deve ser
  observável e acionável dentro da própria resposta.
- **Alternatives considered**:
  - Lançar exceção para o chamador decidir mensagem.
  - Retornar objeto de erro técnico com detalhes internos extensos.
  - Suprimir erro e retornar mensagem de sucesso vazia.

## Decision 6: Testabilidade por injeção de fetch

- **Decision**: Tornar a função de consulta externa injetável para testes.
- **Rationale**: Permite cenários de sucesso, timeout e payload inválido sem rede e com resultados
  determinísticos.
- **Alternatives considered**:
  - Mock global de `fetch` em todo o processo de teste.
  - Testes de integração com rede real.
  - Não testar cenários de falha de rede.
