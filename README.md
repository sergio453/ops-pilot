# OpsPilot

OpsPilot é um assistente de operações com backend HTTP em Express/TypeScript e uma interface web React/TypeScript em `web/`.

## Pré-requisitos

- Node.js 22+
- Dependências do backend e do frontend instaladas
- Variáveis do provedor configuradas localmente para executar consultas reais ao agente

## Instalação

```powershell
npm install
npm --prefix web install
```

Configure as variáveis do provedor localmente conforme `.env.example`. Não versione credenciais.

## Desenvolvimento

Inicie os processos em terminais separados, na raiz do repositório:

```powershell
npm run dev:backend:env
```

```powershell
npm run dev:frontend
```

O backend atende em `http://localhost:3000`; o frontend em `http://localhost:5173`. O proxy de desenvolvimento encaminha `/api/*` do Vite ao backend. Defina `API_TARGET` para alterar o destino.

Scripts úteis:

- `npm run dev:backend`: inicia a API usando as variáveis já presentes no ambiente.
- `npm run dev:backend:env`: inicia a API carregando o `.env` local pelo Node.
- `npm run dev:frontend`: inicia o Vite.
- `npm --prefix web run build`: valida e gera o build de produção do frontend.

## Testes

```powershell
npm test
npm run typecheck
npm --prefix web run build
npm --prefix web run lint
```
