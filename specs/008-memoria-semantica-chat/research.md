# Research Notes: Memória semântica por usuário no chat

## Decision 1: Modelo local de embeddings e padrão lazy singleton

- **Decision**: Adotar o modelo `sentence-transformers/all-MiniLM-L6-v2` executado localmente via `@huggingface/transformers` com *mean pooling* e normalização de vetores ($L_2$). O carregamento do modelo e tokenizer é encapsulado em um lazy singleton em `src/memory/embeddings.ts`.
- **Rationale**: Atende ao requisito de geração de embeddings local, evitando chamadas de API externas para vetorização, garantindo baixa latência e conformidade com os princípios de segurança operacional. O lazy singleton garante que o modelo seja instanciado uma única vez na inicialização ou primeiro uso, sem re-download ou recarga contínua de tensores na memória. Adiciona-se fallback funcional para testes locais que rodam sem rede ou ambiente offline.
- **Alternatives considered**:
  - Chamar API remota de embeddings (ex: OpenAI/OpenRouter): rejeitado pois o requisito especificou explicitamente execução local de `all-MiniLM-L6-v2`.
  - Instanciar pipeline em cada requisição de chat: rejeitado por degradar a latência e estourar memória.
  - Carregamento síncrono na importação do módulo: rejeitado para não bloquear o boot da aplicação nem quebrar testes rápidos.

## Decision 2: Similaridade semântica por produto escalar com vetores normalizados

- **Decision**: Normalizar todos os vetores para norma unitária ($\|\mathbf{v}\|_2 = 1$). Com vetores unitários, o produto escalar $\mathbf{u} \cdot \mathbf{v}$ coincide exatamente com a similaridade de cossenos.
- **Rationale**: O requisito pede cálculo de similaridade por produto escalar com limiar mínimo de 0.30 e deduplicação > 0.92. A normalização garante que o produto escalar permaneça estritamente no intervalo $[-1, 1]$, tornando a comparação de limiares estável e matematicamente equivalente à similaridade de cossenos.
- **Alternatives considered**:
  - Produto escalar em vetores brutos sem normalização: rejeitado porque a magnitude dos vetores distorce os limiares 0.92 e 0.30.
  - Distância euclidiana pura: rejeitada por não corresponder à semântica solicitada de produto escalar/cosseno.

## Decision 3: Estratégia de deduplicação semântica no `remember` (> 0.92)

- **Decision**: No método `remember(userId, fact)`, calcular o embedding do fato e verificar a similaridade com todas as memórias já cadastradas para aquele `userId`. Se houver algum fato existente com score $\ge 0.92$, a inserção é suprimida e a memória existente é retornada.
- **Rationale**: Evita inchaço de dados redundantes e previne que variações superficiais da mesma afirmação poluam o contexto do modelo.
- **Alternatives considered**:
  - Deduplicação apenas por string exata: rejeitada por ignorar paráfrases e pequenas variações lexicais.
  - Atualização/sobrescrita do fato existente: rejeitada para preservar a formulação original e integridade temporal (`created_at`).

## Decision 4: Recuperação semântica (`recall`) com Top-3 e corte mínimo de 0.30

- **Decision**: O método `recall(userId, query, limit = 3)` calcula a similaridade da query com as memórias do usuário, filtra aquelas com score $\ge 0.30$, ordena de forma decrescente e retorna no máximo as 3 melhores.
- **Rationale**: Filtra ruído semântico de baixa relevância (< 0.30) e limita a quantidade de contexto injetado no prompt em 3 itens para não estourar a janela de contexto nem aumentar custos desnecessários.
- **Alternatives considered**:
  - Retornar todas as memórias acima de 0.30 sem limite: rejeitado por risco de sobrecarga de tokens no prompt.
  - Retornar top-3 fixo sem nota de corte: rejeitado pois memórias completamente irrelevantes seriam injetadas se houvesse poucas entradas.

## Decision 5: Armazenamento em SQLite com coluna de embedding em BLOB

- **Decision**: Criar tabela `memories` no SQLite com colunas `id` (TEXT), `user_id` (TEXT), `fact` (TEXT), `embedding` (BLOB) e `created_at` (TEXT). O `Float32Array` é serializado diretamente como Buffer de bytes (`Float32Array.BYTES_PER_ELEMENT = 4`) e salvo como `BLOB`.
- **Rationale**: Conforme solicitado nos requisitos (`memories` com coluna `embedding` em BLOB). É extremamente eficiente em espaço e velocidade de serialização/desserialização no `node:sqlite` nativo sem necessidade de extensões externas como sqlite-vss.
- **Alternatives considered**:
  - Salvar embedding como JSON textual: rejeitado por ser ineficiente em espaço e velocidade de parsing numérico.
  - Uso de banco vetorial externo (Qdrant, Chroma, Milvus): rejeitado pois a arquitetura do projeto padroniza armazenamento no SQLite (`node:sqlite`).

## Decision 6: Integração no endpoint `/chat` e isolamento estrito por usuário

- **Decision**: O endpoint `POST /chat` recebe `userId` opcional validado com `zod`. Quando fornecido, invoca `memoryStore.recall(userId, message, 3)` e injeta os fatos no prompt antes do histórico de mensagens no formato `MEMORY: <fato>`.
- **Rationale**: Garante que o contexto relevante seja aproveitado na geração de resposta pelo agente. O isolamento estrito por `user_id` em queries SQL impede qualquer vazamento de memória entre usuários diferentes.
- **Alternatives considered**:
  - Compartilhar memórias globalmente entre usuários: rejeitado por quebrar privacidade e pertinência de dados.
  - Injetar memórias como uma mensagem artificial do histórico: rejeitado pois poluíria a métrica `historyMessages` e o histórico conversacional real.
