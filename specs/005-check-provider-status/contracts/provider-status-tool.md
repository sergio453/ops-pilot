# Contract: Provider status tool

## Scope

Contrato funcional da tool de consulta de status de provedores externos para triagem operacional.

## Tool: `check_provider_status`

- **Input**
  - `provider`: `github | cloudflare` (opcional, padrão `github`)
- **Output**
  - sucesso: linha única compacta com `indicator` e `description`
  - falha final: linha única com mensagem de erro legível
- **Behavior**
  - consulta fonte pública de status do provedor selecionado
  - aplica timeout de 5 segundos por tentativa
  - realiza no máximo uma nova tentativa para falha transitória de rede, timeout ou indisponibilidade do servidor remoto (5xx)
  - valida a estrutura de status antes de produzir sucesso
  - nunca propaga exceção para fora da tool
  - não retorna payload bruto; retorna string compacta para preservar contexto

## Provider mapping

- `github` -> `https://www.githubstatus.com/api/v2/status.json`
- `cloudflare` -> `https://www.cloudflarestatus.com/api/v2/status.json`

## Error semantics

- Falha de rede após tentativas: retorno legível indicando indisponibilidade de consulta.
- Timeout após tentativas: retorno legível indicando expiração de tempo de consulta.
- Payload inválido após tentativas: retorno legível indicando resposta de status inválida.
- Exemplo de sucesso: `github está none - All Systems Operational`
- Exemplo de falha: `não consegui consultar o status de github (timeout)`

## Test contract

- A implementação deve aceitar função de consulta injetável para execução de testes sem rede.
- Cenários mínimos obrigatórios:
  - sucesso com payload válido
  - timeout com falha final legível
  - payload inválido com falha final legível
