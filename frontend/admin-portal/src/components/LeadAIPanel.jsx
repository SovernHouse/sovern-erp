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
      `## Lead context — you are helping the user with this specific lead. Be conversational and direct.`,
      ``,
      `Lead ID: ${lead.id}`,
      `Company: ${lead.companyName}${lead.country ? ` (${lead.country})` : ''}`,
      `Contact: ${lead.contactName || '(unknown)'} <${lead.email}>`,
      `Industry: ${lead.industry || '(empty — fill in if you can verify it)'}`,
      `Address: ${lead.address || '(empty — fill in if a street address is on the company\'s site)'}`,
      `City: ${lead.city || '(empty)'}`,
      `State / Province: ${lead.state || '(empty)'}`,
      `Country: ${lead.country || '(empty)'}`,
      lead.website ? `Website: ${lead.website}` : `Website: (not on file — see if you can find one)`,
      lead.vertical ? `Vertical: ${lead.vertical}` : null,
      ``,
      `Current draft email subject: ${lead.draftEmailSubject || '(empty)'}`,
      ``,
      `Current draft email body:`,
      `"""`,
      lead.draftEmailBody || '(empty)',
      `"""`,
      ``,
      `## What you can do for the user`,
      ``,
      `1. **Refine the draft email** — when the user asks you to change subject or body (shorter, more direct, mention X, etc.), call update_lead with the new draftEmailSubject and/or draftEmailBody. Always show the new draft text in your reply too. Follow Sovern's voice: 80-120 words, no em dashes, one ask, factory-direct positioning for Malaysia LVT/SPC (L-014: "we're shipping from our factory in Malaysia," never middleman framing). For non-flooring or non-Malaysia leads, use the buying-house voice (5% flat, 30-year founder Asia story, Taiwan-based).`,
      ``,
      `2. **Answer questions about the draft** — the user may ask "is this opener relevant?", "would this work in Quebec?", "is the tariff number accurate?", "should I lead with DDP or FOB?". Give a direct, opinionated answer; cite a source URL via WebFetch if you need to verify a fact.`,
      ``,
      `3. **Answer questions about the lead** — "what does this company actually sell?", "are they likely to import direct?", "who are their competitors?". Use WebFetch / WebSearch to look up the company's site or recent news. Be honest if you can't find solid info; never make up facts.`,
      ``,
      `4. **Fill in missing lead fields** — if industry/address/city/state/country/website is empty above, you can fetch the company's site and call update_lead to populate them. Do NOT fabricate — if a field can't be verified, leave it empty and tell the user.`,
      ``,
      `5. **Suggest other CRM fields** — vertical, productInterests (slugs), priority, estimated value range. Save anything verifiable via update_lead.`,
      ``,
      `When you call update_lead, always summarise what changed in your text reply so the user can spot it without scrolling.`,
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
    { label: 'Fill missing fields', prompt: 'Fetch this company\'s website and use update_lead to fill any empty fields (industry, address, city, state, country, website). Do not fabricate — if a field can\'t be verified from the page, leave it empty and tell me which ones you couldn\'t fill.' },
    { label: 'Is the draft relevant?', prompt: 'Critique the current draft email. Is the opener actually relevant to this company? Is the tariff angle accurate? Would the ask land? Be direct and specific — point to the lines that work and the ones that don\'t.' },
    { label: 'Shorter (60-80 words)', prompt: 'Tighten the draft email body to 60-80 words. Keep the specific opener about this company. Keep the factory-direct Malaysia positioning. Save with update_lead.' },
    { label: 'More direct tone', prompt: 'Rewrite the draft email body in a more direct tone. Cut hedges and softeners. One clear ask. Save with update_lead.' },
    { label: 'Verify the company', prompt: 'Look up this company on their website and a couple of independent sources. Confirm they actually distribute LVT/SPC at scale, what region they cover, and any recent product/distribution news. Tell me what you found and link the sources.' },
    { label: 'New subject options', prompt: 'Propose 3 alternative subject lines for this draft, each 3-6 words, lowercase except proper nouns. Pick the best one and save it via update_lead.' },
  ]

  return (
    <div className="border-2 border-blue-200 bg-blue-50/40 rounded-lg p-6">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-blue-600" />
        <h2 className="text-xl font-semibold text-gray-900">AI Assistant</h2>
        <span className="text-xs text-gray-500">— ask anything about this lead. Refine the draft, fill missing fields, verify the company, critique relevance.</span>
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
          placeholder="Ask anything about this lead… 'is the opener relevant?' / 'fill in the address' / 'find their LinkedIn'"
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
