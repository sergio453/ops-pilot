import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { z } from 'zod'
import './App.css'

const chatResponseSchema = z.object({
  requestId: z.string().min(1),
  conversationId: z.string().min(1),
  answer: z.string(),
  trace: z.array(z.object({
    type: z.string(),
    content: z.string(),
    node: z.string().optional(),
  }).passthrough()),
  metrics: z.object({
    llCalls: z.number().int().nonnegative(),
    latencyMs: z.number().nonnegative(),
    historyMessages: z.number().int().nonnegative(),
    memoryHits: z.number().int().nonnegative(),
  }).passthrough(),
})

const apiErrorSchema = z.object({
  error: z.string().optional(),
  message: z.string().optional(),
})

type ChatResponse = z.infer<typeof chatResponseSchema>

function getApiErrorMessage(status: number, payload: unknown): string {
  const parsedError = apiErrorSchema.safeParse(payload)
  const errorCode = parsedError.success ? parsedError.data.error : undefined

  if (status === 502 || status === 503) {
    return 'Não foi possível conectar ao backend. Verifique se a API está em execução na porta 3000.'
  }
  if (status === 504 || errorCode === 'timeout') {
    return 'A solicitação excedeu o tempo limite. Tente novamente.'
  }
  if (status === 422) {
    return 'A estratégia selecionada não está disponível.'
  }
  if (status === 400) {
    return 'Revise a mensagem e tente novamente.'
  }
  if (errorCode === 'persistence_error') {
    return 'O backend não conseguiu registrar a execução. Confira os logs da API.'
  }
  if (status >= 500) {
    return 'O backend não conseguiu processar a mensagem. Confira os logs da API e a configuração do provedor OpenRouter.'
  }

  return parsedError.success && parsedError.data.message
    ? parsedError.data.message
    : 'Não foi possível concluir a solicitação.'
}

function App() {
  const [message, setMessage] = useState('')
  const [conversationId, setConversationId] = useState<string>()
  const [result, setResult] = useState<ChatResponse>()
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const prompt = message.trim()
    if (!prompt || isLoading) return

    setIsLoading(true)
    setError('')
    setResult(undefined)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: prompt,
          strategy: 'react',
          ...(conversationId ? { conversationId } : {}),
        }),
      })
      const responseText = await response.text()
      let payload: unknown
      if (responseText) {
        try {
          payload = JSON.parse(responseText) as unknown
        } catch {
          if (response.ok) {
            throw new Error('A API retornou uma resposta em formato inválido.')
          }
        }
      }

      if (!response.ok) {
        throw new Error(getApiErrorMessage(response.status, payload))
      }

      const parsedResponse = chatResponseSchema.safeParse(payload)
      if (!parsedResponse.success) {
        throw new Error('A API retornou uma resposta em formato inválido.')
      }

      const chatResponse = parsedResponse.data
      setResult(chatResponse)
      setConversationId(chatResponse.conversationId)
      setMessage('')
    } catch (requestError) {
      setError(
        requestError instanceof TypeError
          ? 'Não foi possível conectar ao backend. Inicie a API com "npm run dev:backend:env" e tente novamente.'
          : requestError instanceof Error
            ? requestError.message
            : 'Erro inesperado ao conectar à API.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  function startNewConversation() {
    setConversationId(undefined)
    setResult(undefined)
    setError('')
    setMessage('')
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="OpsPilot, início">
          <span className="brand-mark" aria-hidden="true">O</span>
          <span>OpsPilot</span>
        </a>
        <div className="connection-status">
          <span className="status-dot" aria-hidden="true" />
          Assistente de operações
        </div>
      </header>

      <section className="workspace" aria-labelledby="page-title">
        <div className="intro">
          <p className="eyebrow">CENTRO DE OPERAÇÕES</p>
          <h1 id="page-title">Como posso ajudar?</h1>
          <p className="subtitle">Investigue alertas, incidentes e serviços usando linguagem natural.</p>
        </div>

        <form className="composer" onSubmit={submitMessage}>
          <label htmlFor="prompt">Mensagem</label>
          <textarea
            id="prompt"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                event.currentTarget.form?.requestSubmit()
              }
            }}
            placeholder="Ex.: Qual serviço está com mais alertas críticos?"
            rows={4}
            disabled={isLoading}
          />
          <div className="composer-footer">
            <span className="hint">Enter para enviar · Shift + Enter para nova linha</span>
            <button type="submit" disabled={!message.trim() || isLoading}>
              {isLoading ? 'Analisando…' : 'Enviar'}
              {!isLoading && <span aria-hidden="true">→</span>}
            </button>
          </div>
        </form>

        {error && (
          <section className="feedback error" role="alert">
            <div>
              <h2>Não foi possível obter uma resposta</h2>
              <p>{error}</p>
            </div>
            <button className="secondary-button" type="button" onClick={() => setError('')}>
              Fechar
            </button>
          </section>
        )}

        {isLoading && (
          <p className="loading-message" role="status" aria-live="polite">
            Preparando uma resposta…
          </p>
        )}

        {!result && !error && !isLoading && (
          <section className="empty-state" aria-label="Sugestões de perguntas">
            <div className="empty-icon" aria-hidden="true">✳</div>
            <h2>Comece com uma pergunta</h2>
            <p>Seu assistente pode ajudar a entender o estado atual das operações.</p>
            <div className="suggestions">
              <button type="button" onClick={() => setMessage('Quais são os alertas ativos?')}>
                Ver alertas ativos
              </button>
              <button type="button" onClick={() => setMessage('Resuma o estado dos serviços.')}>
                Resumir serviços
              </button>
            </div>
          </section>
        )}

        {result && (
          <section className="response-card" aria-labelledby="response-title">
            <div className="response-heading">
              <div>
                <p className="eyebrow">RESPOSTA DO OPSPILOT</p>
                <h2 id="response-title">Investigação concluída</h2>
              </div>
              <button className="secondary-button" type="button" onClick={startNewConversation}>
                Nova conversa
              </button>
            </div>
            <p className="answer">{result.answer}</p>
            <details className="trace-details">
              <summary>Detalhes da execução ({result.trace.length} eventos)</summary>
              <ol className="trace-list">
                {result.trace.map((event, index) => (
                  <li key={`${event.node ?? event.type}-${index}`}>
                    <span className="trace-node">{event.node ?? event.type}</span>
                    <span>{event.content}</span>
                  </li>
                ))}
              </ol>
            </details>
            <footer className="response-meta">
              <span>Request ID: <code>{result.requestId}</code></span>
              <span>{result.metrics.latencyMs} ms</span>
              <span>{result.metrics.llCalls} chamadas de modelo</span>
            </footer>
          </section>
        )}
      </section>
    </main>
  )
}

export default App
