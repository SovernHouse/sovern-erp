import { useState, useRef, useEffect } from 'react'
import { Sparkles, Send, Loader2, Bot, User } from 'lucide-react'
import { aiAPI } from '../services/api'

/**
 * LeadAIPanel — inline AI Assistant chat for a single lead.
 *
 * The first user message gets prepended with a context block describing
 * the lead + current draft subject/body so the AI has everything it
 * needs without a separate endpoint. Subsequent messages reuse the
 * conversationId and don't re-prepend (history carries the context).
 *
 * After each AI turn the parent calls onLeadChanged() so the Draft Email
 * card refetches and shows whatever the AI just wrote via update_lead.
 */
export default function LeadAIPanel({ lead, onLeadChanged }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [conversationId, setConversationId] = useState(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const scrollRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, sending])

  const buildContextBlock = () => {
    const parts = [
      `## Lead context (use the update_lead MCP tool to edit fields on this lead)`,
      ``,
      `Lead ID: ${lead.id}`,
      `Company: ${lead.companyName}${lead.country ? ` (${lead.country})` : ''}`,
      lead.industry ? `Industry: ${lead.industry}` : null,
      lead.contactName ? `Contact: ${lead.contactName} <${lead.email}>` : `Email: ${lead.email}`,
      lead.vertical ? `Vertical: ${lead.vertical}` : null,
      ``,
      `Current draft email subject: ${lead.draftEmailSubject || '(empty)'}`,
      ``,
      `Current draft email body:`,
      `"""`,
      lead.draftEmailBody || '(empty)',
      `"""`,
      ``,
      `When the user asks you to change the draft, call update_lead with the lead ID above and the new draftEmailSubject and/or draftEmailBody. Always show the user the new draft text in your reply too. Follow Sovern's voice: 80-120 words, no em dashes, one ask, factory-direct positioning for Malaysia LVT/SPC (L-014: "we're shipping from our factory in Malaysia," never middleman framing).`,
      ``,
      `## User request`,
      ``,
    ]
    return parts.filter(p => p !== null).join('\n')
  }

  const send = async (text) => {
    const trimmed = (text || input).trim()
    if (!trimmed || sending) return
    setError(null)
    setInput('')
    const userMsg = { role: 'user', content: trimmed, ts: Date.now() }
    setMessages((m) => [...m, userMsg])
    setSending(true)

    try {
      const messageToSend = conversationId ? trimmed : (buildContextBlock() + trimmed)
      const res = await aiAPI.chat({
        message: messageToSend,
        conversationId,
      })
      const data = res?.data || res
      const reply = data?.reply || data?.message || data?.response || ''
      const newConvId = data?.conversationId || data?.conversation?.id || conversationId
      if (newConvId && !conversationId) setConversationId(newConvId)
      setMessages((m) => [...m, { role: 'assistant', content: reply, ts: Date.now() }])
      if (typeof onLeadChanged === 'function') onLeadChanged()
    } catch (e) {
      setError(e.response?.data?.error || e.response?.data?.message || e.message || 'AI request failed')
      setMessages((m) => [...m, {
        role: 'assistant',
        content: '_(error: see banner above)_',
        ts: Date.now(),
        error: true,
      }])
    } finally {
      setSending(false)
    }
  }

  const QUICK_ACTIONS = [
    { label: 'Shorter (60-80 words)', prompt: 'Tighten the draft email body to 60-80 words. Keep the specific opener about this company. Keep the factory-direct Malaysia positioning. Save with update_lead.' },
    { label: 'More direct tone', prompt: 'Rewrite the draft email body in a more direct tone. Cut hedges and softeners. One clear ask. Save with update_lead.' },
    { label: 'Add tariff specifics', prompt: 'Add concrete tariff numbers to the draft email: zero Section 301 on Malaysia origin vs the current 25%+ on Chinese-origin LVT/SPC. Keep the email under 120 words. Save with update_lead.' },
    { label: 'Reference their product line', prompt: `Rewrite the opener to reference this company's actual product line${lead.industry ? ' (' + lead.industry + ')' : ''} more specifically. Save with update_lead.` },
    { label: 'New subject options', prompt: 'Propose 3 alternative subject lines for this draft, each 3-6 words, lowercase except proper nouns. Pick the best one and save it via update_lead.' },
  ]

  return (
    <div className="border-2 border-blue-200 bg-blue-50/40 rounded-lg p-6">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-blue-600" />
        <h2 className="text-xl font-semibold text-gray-900">AI Assistant</h2>
        <span className="text-xs text-gray-500">— ask to refine the draft, the AI edits it live via update_lead</span>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mb-3">{error}</div>
      )}

      <div
        ref={scrollRef}
        className="bg-white border border-gray-200 rounded-lg p-3 mb-3 overflow-y-auto"
        style={{ maxHeight: '300px', minHeight: messages.length === 0 ? '60px' : '120px' }}
      >
        {messages.length === 0 && !sending ? (
          <p className="text-sm text-gray-500 italic">No messages yet. Try a quick action below or type your own request.</p>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`flex gap-2 mb-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${m.role === 'user' ? 'bg-blue-600' : 'bg-emerald-600'}`}>
                {m.role === 'user' ? <User className="w-3 h-3 text-white" /> : <Bot className="w-3 h-3 text-white" />}
              </div>
              <div className={`flex-1 max-w-[85%] ${m.role === 'user' ? 'text-right' : ''}`}>
                <div className={`inline-block text-sm px-3 py-2 rounded-lg whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : m.error
                      ? 'bg-red-50 text-red-700 border border-red-200'
                      : 'bg-gray-100 text-gray-900'
                }`}>{m.content}</div>
              </div>
            </div>
          ))
        )}
        {sending && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Thinking — may take 30–60s if the AI is fetching pages or editing the draft…
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {QUICK_ACTIONS.map((a) => (
          <button
            key={a.label}
            type="button"
            disabled={sending}
            onClick={() => send(a.prompt)}
            className="text-xs px-3 py-1.5 bg-white border border-blue-300 text-blue-700 rounded-full hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {a.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          placeholder="Ask the AI to refine this draft… e.g. 'mention their Toronto warehouse'"
          disabled={sending}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
        />
        <button
          type="button"
          onClick={() => send()}
          disabled={sending || !input.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Send
        </button>
      </div>
    </div>
  )
}
