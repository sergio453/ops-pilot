# Data Model: Status de provedores externos

## Entities

### ProviderStatusRequest

- **Fields**: `provider`
- **Purpose**: Representa a seleção do provedor alvo para consulta operacional.
- **Validation rules**:
  - `provider` opcional
  - quando presente, deve estar no conjunto suportado
  - quando ausente, aplica valor padrão do domínio

### ProviderStatusResponse

- **Fields**: `status.indicator`, `status.description`
- **Purpose**: Representa o estado operacional bruto retornado pela fonte pública.
- **Validation rules**:
  - `status` obrigatório
  - `status.indicator` obrigatório e textual
  - `status.description` obrigatório e textual

### ProviderStatusSummary

- **Fields**: `provider`, `indicator`, `description`, `formattedLine`
- **Purpose**: Representa a saída compacta de sucesso para consumo pelo operador.
- **Validation rules**:
  - `indicator` e `description` derivados de payload validado
  - `formattedLine` deve conter uma única linha legível

### ProviderStatusFailure

- **Fields**: `provider`, `reason`, `formattedLine`
- **Purpose**: Representa falha final observável da consulta após política de tentativas.
- **Validation rules**:
  - `reason` obrigatório e legível para operador
  - `formattedLine` deve conter uma única linha

## Derived Views / Query Shapes

### ProviderStatusToolOutput

- **Input**: `provider` (opcional)
- **Output (sucesso)**: string compacta com indicador e descrição
- **Output (falha final)**: string legível de erro

## State Transitions

### Consulta de status

- `requested -> attempt_1`
- `attempt_1 -> success` quando payload válido é retornado
- `attempt_1 -> attempt_2` para falha transitória elegível
- `attempt_2 -> success` quando payload válido é retornado
- `attempt_2 -> failed` quando ocorre nova falha ou payload inválido final

### Política de erro

- Erro final sempre transita para `failed` com mensagem retornada ao chamador
- Não existe transição para exceção não tratada fora da tool
