# Research Notes: Persistência real de operações

## Decision 1: Usar SQLite síncrono como storage local padrão

- **Decision**: Adotar armazenamento local com SQLite síncrono, configurável por variável de
  ambiente e com fallback para caminho padrão do projeto.
- **Rationale**: Atende necessidade de persistência real com baixa complexidade operacional e sem
  dependências externas no ambiente de desenvolvimento.
- **Alternatives considered**:
  - Manter apenas store em memória.
  - Introduzir banco servidor dedicado para o fluxo local.
  - Persistir em arquivos JSON sem transações/constraints.

## Decision 2: Schema e seed idempotentes como requisito de inicialização

- **Decision**: Estruturar schema com criação idempotente e seed repetível que não duplica dados.
- **Rationale**: Garante reexecução segura em dev/test e reduz flakiness de setup.
- **Alternatives considered**:
  - Inicialização destrutiva (drop/recreate).
  - Seed obrigatório apenas no primeiro boot.
  - Seed não determinístico por ambiente.

## Decision 3: Restringir domínios fechados na camada de dados

- **Decision**: Validar `tier`, `severity` e `status` por restrição de domínio fechada no
  armazenamento e manter validação de entrada na fronteira das tools.
- **Rationale**: Defesa em profundidade: evita entrada inválida tanto na borda quanto na
  persistência.
- **Alternatives considered**:
  - Validar apenas na camada de aplicação.
  - Aceitar valores livres e normalizar tardiamente.
  - Corrigir silenciosamente valores inválidos.

## Decision 4: Tornar erros de domínio explícitos para consultas operacionais

- **Decision**: Consulta de runbook e resolução de incidente devem falhar de forma explícita para
  recurso inexistente.
- **Rationale**: Em operação de plantão, ausência de dado é sinal relevante e não deve ser
  mascarada por resposta de sucesso vazia.
- **Alternatives considered**:
  - Retornar sucesso com lista vazia ou valor nulo.
  - Substituir por mensagem genérica sem erro.
  - Criar runbook/incidente automaticamente em consulta.

## Decision 5: Composição híbrida para runtime e qualidade

- **Decision**: Usar store persistente no runtime principal e manter store em memória para testes e
  benchmark determinísticos.
- **Rationale**: Equilibra realismo operacional com reprodutibilidade de suíte e cenários de
  comparação.
- **Alternatives considered**:
  - Forçar SQLite em todos os contextos.
  - Forçar memória em todos os contextos.
  - Duplicar lógica de negócio por tipo de store.
