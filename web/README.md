# OpsPilot Web

Frontend React + TypeScript + Vite para o OpsPilot. A tela inicial envia perguntas ao backend Express e apresenta a resposta, métricas e eventos de trace.

## Pré-requisitos

- Node.js 22+
- Dependências instaladas na raiz e em `web/`
- Credenciais do provedor configuradas no ambiente do backend para executar chamadas reais ao agente

## Iniciar localmente

Na raiz do repositório, em terminais separados:

```powershell
npm run dev:backend:env
```

```powershell
npm run dev:frontend
```

O backend usa a porta `3000` por padrão. O frontend fica disponível em `http://localhost:5173` e encaminha `/api/*` para o backend, removendo o prefixo `/api`. Para usar outra origem de API, defina `API_TARGET` ao iniciar o Vite.

Configure `.env` localmente com base em `.env.example`; não versione credenciais. O backend também pode ser iniciado sem carregamento de `.env` com `npm run dev:backend`, desde que as variáveis exigidas já estejam no ambiente.

## Validar

```powershell
npm --prefix web run build
npm --prefix web run lint
npm test
npm run typecheck
```

## Funcionalidades iniciais

- Consulta ao endpoint `POST /chat` usando a estratégia `react`
- Continuidade da conversa por `conversationId`
- Estados de carregamento, vazio e erro
- Visualização de métricas e eventos da execução
- Layout responsivo, modo escuro do sistema e navegação acessível por teclado
