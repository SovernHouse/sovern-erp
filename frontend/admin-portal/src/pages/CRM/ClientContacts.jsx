import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../services/api';
import { useBrands } from '../../contexts/BrandsContext';
import BrandBadge from '../../components/BrandBadge';
import {
  Search, Plus, Mail, Globe, Phone, MapPin, ExternalLink,
  ChevronDown, ChevronRight, Send, Clock, CheckCircle2,
  AlertCircle, X, RefreshCw, Filter, Users2, Calendar,
  ArrowUpRight, Shield, ShieldCheck, MailCheck, ArrowUpDown,
  UserPlus, Trash2, Upload, UserCheck, Zap, BarChart2,
  CheckSquare, Square,
} from 'lucide-react';

const VERTICAL_LABELS = {
  flooring: 'Flooring',
  auto_parts: 'Auto Parts',
  'car-parts-accessories': 'Car Parts & Accessories',
  garments: 'Garments',
  'garments-fabrics': 'Garments & Fabrics',
  bathroom: 'Bathroom / Hardware',
  'bathroom-products': 'Bathroom Products',
  'ironmongery-hardware': 'Ironmongery & Hardware',
  travel: 'Travel Accessories',
  'travel-accessories': 'Travel Accessories',
  other: 'Other',
};

// ─── Category Filter Popover ───────────────────────────────────────────────────
function CategoryFilter({ selected, onChange, categoryTree }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState({});
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleSlug = (slug) => {
    onChange(selected.includes(slug) ? selected.filter(s => s !== slug) : [...selected, slug]);
  };

  const toggleParent = (parent) => {
    const childSlugs = (parent.children || []).map(c => c.slug).filter(Boolean);
    const allSelected = childSlugs.every(s => selected.includes(s));
    if (allSelected) {
      // Deselect parent slug + all children
      onChange(selected.filter(s => s !== parent.slug && !childSlugs.includes(s)));
    } else {
      // Select parent slug + all children
      const toAdd = [parent.slug, ...childSlugs].filter(s => !selected.includes(s));
      onChange([...selected, ...toAdd]);
    }
  };

  const clearAll = () => onChange([]);

  const label = selected.length === 0
    ? 'All categories'
    : `${selected.length} categor${selected.length === 1 ? 'y' : 'ies'}`;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 text-sm border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 whitespace-nowrap ${
          selected.length > 0 ? 'border-slate-900 text-slate-900 font-medium' : 'border-slate-200 text-slate-600'
        }`}
      >
        <Filter size={13} />
        {label}
        {selected.length > 0 && (
          <span
            onClick={(e) => { e.stopPropagation(); clearAll(); }}
            className="ml-1 text-slate-400 hover:text-slate-700"
          >×</span>
        )}
        <ChevronDown size={12} className="text-slate-400" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-xl w-72 max-h-96 overflow-y-auto py-1">
          {categoryTree.length === 0 && (
            <p className="px-4 py-3 text-xs text-slate-400">No categories configured. Go to Settings → Product Taxonomy.</p>
          )}
          {categoryTree.map(parent => {
            const isExpanded = expanded[parent.slug] !== false; // default expanded
            const childSlugs = (parent.children || []).map(c => c.slug).filter(Boolean);
            const allChildrenSelected = childSlugs.length > 0 && childSlugs.every(s => selected.includes(s));
            const someChildrenSelected = childSlugs.some(s => selected.includes(s)) || selected.includes(parent.slug);
            return (
              <div key={parent.id}>
                {/* Parent row */}
                <div className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50">
                  <button
                    onClick={() => setExpanded(e => ({ ...e, [parent.slug]: !isExpanded }))}
                    className="text-slate-400 hover:text-slate-700 flex-shrink-0"
                  >
                    {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  </button>
                  <label className="flex items-center gap-2 flex-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allChildrenSelected}
                      ref={el => { if (el) el.indeterminate = someChildrenSelected && !allChildrenSelected; }}
                      onChange={() => toggleParent(parent)}
                      className="rounded"
                    />
                    <span className="text-sm font-medium text-slate-800">
                      {parent.icon && <span className="mr-1">{parent.icon}</span>}
                      {parent.name}
                    </span>
                  </label>
                </div>
                {/* Sub-category rows */}
                {isExpanded && (parent.children || []).map(child => (
                  <label key={child.id} className="flex items-center gap-2 pl-9 pr-3 py-1 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selected.includes(child.slug)}
                      onChange={() => toggleSlug(child.slug)}
                      className="rounded"
                    />
                    <span className="text-sm text-slate-700">{child.name}</span>
                  </label>
                ))}
              </div>
            );
          })}
          {selected.length > 0 && (
            <div className="border-t border-slate-100 px-3 py-2 mt-1">
              <button onClick={clearAll} className="text-xs text-slate-500 hover:text-slate-800">Clear all filters</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const STATUS_STYLES = {
  new: 'bg-slate-100 text-slate-700',
  contacted: 'bg-blue-100 text-blue-700',
  qualified: 'bg-purple-100 text-purple-700',
  proposal: 'bg-amber-100 text-amber-700',
  negotiation: 'bg-orange-100 text-orange-700',
  won: 'bg-green-100 text-green-700',
  lost: 'bg-red-100 text-red-700',
};

const COUNTRY_FLAGS = {
  Egypt: '🇪🇬',
  'United States': '🇺🇸',
  Australia: '🇦🇺',
  Chile: '🇨🇱',
  UK: '🇬🇧',
  Brazil: '🇧🇷',
  Mexico: '🇲🇽',
};

const TOUCH_LABELS = {
  1: 'First contact',
  2: 'Follow-up #2',
  3: 'Follow-up #3',
  4: 'Follow-up #4',
  5: 'Breakup',
};

const DEFAULT_BCC = '"Mohannad Fanzey" <mohanadfanzey@gmail.com>';

// ─── Email Compose Panel ───────────────────────────────────────────────────
function ComposePanel({ prospect, onClose, onSent }) {
  const { getBrand, defaultBrand } = useBrands();
  const prospectBrandCode = prospect.brandCode || defaultBrand || 'SH';
  const brand = getBrand(prospectBrandCode);
  const isSHBrand = prospectBrandCode === 'SH';

  const [form, setForm] = useState({
    fromAddress: brand?.senderEmail || 'alex@sovernhouse.co',
    toAddress: prospect.email || '',
    toName: prospect.contactName || '',
    cc: '',
    bcc: (prospect.country === 'Egypt' && isSHBrand) ? DEFAULT_BCC : '',
    subject: '',
    bodyText: '',
    touchNumber: 1,
    followUpDays: 4,
  });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [showSave, setShowSave] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [savingTpl, setSavingTpl] = useState(false);
  const [signatures, setSignatures] = useState([]);
  const [selectedSigId, setSelectedSigId] = useState('');

  useEffect(() => {
    api.get(`/crm/email-templates?brandCode=${prospectBrandCode}`).then(r => setTemplates(r.data?.data || [])).catch(() => {});
    api.get('/crm/email-signatures').then(r => {
      const sigs = r.data?.data || [];
      setSignatures(sigs);
      const def = sigs.find(s => s.isDefault);
      if (def) setSelectedSigId(def.id);
    }).catch(() => {});
  }, []);

  const loadTemplate = (id) => {
    const t = templates.find(t => t.id === id);
    if (t) setForm(f => ({ ...f, subject: t.subject, bodyText: t.bodyText }));
  };

  const saveTemplate = async () => {
    if (!saveName.trim() || !form.subject || !form.bodyText) return;
    setSavingTpl(true);
    try {
      const res = await api.post('/crm/email-templates', { name: saveName.trim(), subject: form.subject, bodyText: form.bodyText, brandCode: prospectBrandCode });
      setTemplates(ts => [...ts, res.data.data]);
      setSaveName(''); setShowSave(false);
    } catch {}
    setSavingTpl(false);
  };

  const followUpMap = { 1: 4, 2: 10, 3: 18, 4: 25, 5: 0 };

  const handleTouchChange = (val) => {
    const touch = parseInt(val);
    setForm(f => ({ ...f, touchNumber: touch, followUpDays: followUpMap[touch] || 4 }));
  };

  const handleSend = async () => {
    if (!form.toAddress || !form.subject || !form.bodyText) {
      setError('To address, subject, and body are required.');
      return;
    }
    setSending(true);
    setError(null);
    try {
      await api.post(`/crm/leads/${prospect.id}/outreach-emails`, {
        ...form,
        cc: form.cc || undefined,
        bcc: form.bcc || undefined,
        signatureId: selectedSigId || undefined,
      });
      onSent();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send email. Check SMTP config in .env.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">New Outreach Email</h3>
            <p className="text-sm text-slate-500 mt-0.5">to {prospect.companyName}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100">
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle size={16} className="text-red-600 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* ── Template bar ── */}
          <div className="flex items-center gap-2 flex-wrap pb-1 border-b border-slate-100">
            <select
              className="flex-1 min-w-0 border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-600"
              defaultValue=""
              onChange={e => { if (e.target.value) { loadTemplate(e.target.value); e.target.value = ''; } }}
            >
              <option value="">{templates.length ? 'Load template…' : 'No templates saved yet'}</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            {!showSave ? (
              <button type="button" onClick={() => setShowSave(true)} className="shrink-0 text-xs px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 whitespace-nowrap">
                Save as template
              </button>
            ) : (
              <>
                <input
                  autoFocus
                  className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                  placeholder="Template name…"
                  value={saveName}
                  onChange={e => setSaveName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveTemplate(); if (e.key === 'Escape') setShowSave(false); }}
                />
                <button onClick={saveTemplate} disabled={savingTpl || !saveName.trim()} className="shrink-0 text-xs px-3 py-1.5 bg-slate-900 text-white rounded-lg disabled:opacity-40 hover:bg-slate-700">
                  {savingTpl ? '…' : 'Save'}
                </button>
                <button onClick={() => { setShowSave(false); setSaveName(''); }} className="shrink-0 text-xs px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
                  ✕
                </button>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-2">
                From
                <BrandBadge code={prospectBrandCode} size="sm" />
              </label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                value={form.fromAddress}
                onChange={e => setForm(f => ({ ...f, fromAddress: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Touch #</label>
              <select
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white"
                value={form.touchNumber}
                onChange={e => handleTouchChange(e.target.value)}
              >
                {Object.entries(TOUCH_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{k} — {v}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">To (email)</label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                value={form.toAddress}
                onChange={e => setForm(f => ({ ...f, toAddress: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">To (name)</label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                value={form.toName}
                onChange={e => setForm(f => ({ ...f, toName: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">CC</label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                placeholder="cc@example.com"
                value={form.cc}
                onChange={e => setForm(f => ({ ...f, cc: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                BCC
                {prospect.country === 'Egypt' && isSHBrand && (
                  <span className="ml-1.5 text-[10px] text-amber-600 font-normal">🇪🇬 Egypt (SH) — Mohannad auto-added</span>
                )}
              </label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                value={form.bcc}
                onChange={e => setForm(f => ({ ...f, bcc: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Subject</label>
            <input
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              placeholder="e.g. direct factory, auto consumables — Cairo"
              value={form.subject}
              onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Body (plain text)</label>
            <textarea
              rows={10}
              spellCheck="true"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-serif focus:outline-none focus:ring-2 focus:ring-slate-400 resize-none"
              placeholder="Dear Mr. [Surname],&#10;&#10;..."
              value={form.bodyText}
              onChange={e => setForm(f => ({ ...f, bodyText: e.target.value }))}
            />
            {/* Signature selector + preview */}
            <div className="mt-2 border border-slate-100 rounded-lg px-4 py-3 bg-slate-50 text-xs text-slate-500 select-none">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400">— Signature (auto-appended) —</span>
                {signatures.length > 0 && (
                  <select
                    className="text-xs border border-slate-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 text-slate-700"
                    value={selectedSigId}
                    onChange={e => setSelectedSigId(e.target.value)}
                  >
                    <option value="">— Default (Alex) —</option>
                    {signatures.map(s => (
                      <option key={s.id} value={s.id}>{s.name}{s.isDefault ? ' ★' : ''}</option>
                    ))}
                  </select>
                )}
              </div>
              {(() => {
                const sig = signatures.find(s => s.id === selectedSigId);
                if (!sig) return (
                  <>
                    {/* Green rule separator */}
                    <div style={{ height: 2, background: '#1D5A32', marginBottom: 12 }} />
                    {/* Handwritten signature */}
                    <div style={{ marginBottom: 8 }}><img src="https://sovernhouse.co/images/alex-signature.jpg" alt="Alex McConnell" style={{ height: 44 }} /></div>
                    {/* Name */}
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#0E0D0C', marginBottom: 2 }}>Alexander McConnell</div>
                    {/* Title */}
                    <div style={{ fontSize: 11, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Founder</div>
                    {/* Contact */}
                    <div style={{ fontSize: 12, marginBottom: 12 }}>
                      <span style={{ color: '#1D5A32', fontWeight: 600 }}>sovernhouse.co</span>
                      <span style={{ color: '#cbd5e1', margin: '0 6px' }}>·</span>
                      <span style={{ color: '#334155' }}>+886 970 781 818</span>
                    </div>
                    {/* Wordmark — CSS-rendered per L-034: no PNG, HOUSE uses flex space-between */}
                    <div style={{ lineHeight: 1, userSelect: 'none', display: 'inline-block', marginBottom: 8 }}>
                      <div style={{ fontFamily: "'Big Shoulders Display', sans-serif", fontWeight: 700, fontSize: 64, color: '#0E0D0C', letterSpacing: '0.04em', lineHeight: 1 }}>SOVERN</div>
                      <div style={{ height: 3, background: '#1D5A32', margin: '5px 0' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'Arsenal SC', serif", fontWeight: 400, fontSize: 18, color: 'rgba(14,13,12,0.55)', textTransform: 'uppercase', letterSpacing: 0, lineHeight: 1, width: '100%' }}>
                        {'HOUSE'.split('').map((ch, i) => <span key={i}>{ch}</span>)}
                      </div>
                    </div>
                    {/* Tagline */}
                    <div style={{ fontSize: 12, fontStyle: 'italic', color: '#94a3b8', marginBottom: 10 }}>Your buying office in Asia.</div>
                    {/* Footer divider + disclaimer */}
                    <div style={{ height: 1, background: '#e2e8f0', marginBottom: 6 }} />
                    <div style={{ fontSize: 10, color: '#94a3b8' }}>Sovern House is a brand of New Route International Exchange Co., Ltd. — Taiwan.</div>
                  </>
                );
                return (
                  <>
                    {sig.signatureImageUrl && <div className="mb-2"><img src={sig.signatureImageUrl} alt={sig.displayName} style={{ height: 44 }} /></div>}
                    <div className="font-medium text-slate-800 text-sm">{sig.displayName}</div>
                    {sig.title && <div className="text-slate-500">{sig.title} · Sovern House</div>}
                    {(sig.website || sig.phone) && (
                      <div className="mt-1">
                        {sig.website && <span className="text-green-700 font-medium">{sig.website}</span>}
                        {sig.website && sig.phone && <span className="text-slate-300 mx-1">·</span>}
                        {sig.phone && <span>{sig.phone}</span>}
                      </div>
                    )}
                    {sig.tagline && <div className="mt-1.5 italic text-slate-400">{sig.tagline}</div>}
                  </>
                );
              })()}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Follow-up reminder (days after send)
            </label>
            <input
              type="number"
              min={0}
              max={60}
              className="w-32 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              value={form.followUpDays}
              onChange={e => setForm(f => ({ ...f, followUpDays: parseInt(e.target.value) || 0 }))}
            />
            <span className="text-xs text-slate-400 ml-2">0 = no reminder</span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
          <p className="text-xs text-slate-400 flex items-center gap-1.5">
            Sends from <strong>{form.fromAddress}</strong>
            <BrandBadge code={prospectBrandCode} size="sm" />
          </p>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100">
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={sending}
              className="flex items-center gap-2 px-5 py-2 bg-slate-900 text-white text-sm rounded-lg hover:bg-slate-700 disabled:opacity-50"
            >
              {sending ? <RefreshCw size={15} className="animate-spin" /> : <Send size={15} />}
              {sending ? 'Sending…' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Email History for a prospect ─────────────────────────────────────────
function EmailHistory({ prospect, refresh }) {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchEmails = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`/crm/leads/${prospect.id}/outreach-emails`);
      setEmails(res.data?.outreachEmails || res.data || []);
    } catch {
      setEmails([]);
    } finally {
      setLoading(false);
    }
  }, [prospect.id, refresh]);

  useEffect(() => { fetchEmails(); }, [fetchEmails]);

  const markFollowUpDone = async (emailId) => {
    await api.patch(`/crm/leads/${prospect.id}/outreach-emails/${emailId}`, {
      followUpCompleted: true,
    });
    fetchEmails();
  };

  if (loading) return <div className="py-4 text-sm text-slate-400 text-center">Loading history…</div>;
  if (!emails.length) return <div className="py-4 text-sm text-slate-400 text-center">No emails sent yet.</div>;

  return (
    <div className="space-y-3 mt-3">
      {emails.map(email => {
        const sentDate = email.sentAt ? new Date(email.sentAt) : null;
        const dueDate = email.followUpDueAt ? new Date(email.followUpDueAt) : null;
        const isOverdue = dueDate && !email.followUpCompleted && dueDate < new Date();
        return (
          <div key={email.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">
                    Touch {email.touchNumber} — {TOUCH_LABELS[email.touchNumber] || 'Email'}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    email.status === 'sent' ? 'bg-green-100 text-green-700' :
                    email.status === 'failed' ? 'bg-red-100 text-red-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>{email.status}</span>
                  {sentDate && (
                    <span className="text-xs text-slate-400">
                      {sentDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium text-slate-800 mt-1">{email.subject}</p>
                <p className="text-xs text-slate-500 mt-0.5">From: {email.fromAddress} → {email.toAddress}</p>
                {email.bodyText && (
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2 font-serif">{email.bodyText.substring(0, 140)}…</p>
                )}
              </div>
            </div>
            {dueDate && !email.followUpCompleted && (
              <div className={`flex items-center justify-between mt-3 pt-3 border-t ${isOverdue ? 'border-red-200' : 'border-slate-200'}`}>
                <div className="flex items-center gap-1.5">
                  <Clock size={13} className={isOverdue ? 'text-red-500' : 'text-amber-500'} />
                  <span className={`text-xs font-medium ${isOverdue ? 'text-red-600' : 'text-amber-600'}`}>
                    Follow-up {isOverdue ? 'overdue:' : 'due:'} {dueDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
                <button
                  onClick={() => markFollowUpDone(email.id)}
                  className="flex items-center gap-1 text-xs text-slate-600 hover:text-green-700 border border-slate-200 hover:border-green-300 px-2 py-1 rounded-lg hover:bg-green-50"
                >
                  <CheckCircle2 size={12} /> Mark done
                </button>
              </div>
            )}
            {email.followUpCompleted && (
              <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-200">
                <CheckCircle2 size={13} className="text-green-500" />
                <span className="text-xs text-green-600 font-medium">Follow-up completed</span>
                {email.followUpNote && <span className="text-xs text-slate-400">— {email.followUpNote}</span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Prospect Row / Card ───────────────────────────────────────────────────
function ProspectCard({ prospect, onCompose, refreshKey, selected, onToggleSelect }) {
  const [expanded, setExpanded] = useState(false);

  const flag = COUNTRY_FLAGS[prospect.country] || '🌐';
  const vertLabel = VERTICAL_LABELS[prospect.vertical] || prospect.vertical || '—';
  // productInterests may arrive as a JSON string from the API (SQLite JSON field) — parse defensively
  // Also filter out the parent vertical slug (already shown as the category pill) and format known acronyms
  const SLUG_LABELS = { lvt: 'LVT', spc: 'SPC', wpc: 'WPC', pvc: 'PVC', abs: 'ABS' };
  const formatSlug = s => SLUG_LABELS[s] || s.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const productInterests = (() => {
    const raw = prospect.productInterests;
    let arr = [];
    if (Array.isArray(raw)) arr = raw;
    else if (typeof raw === 'string') { try { const p = JSON.parse(raw); arr = Array.isArray(p) ? p : []; } catch { arr = []; } }
    // Filter out the parent vertical slug — it's already shown in the category pill
    return arr.filter(s => s !== prospect.vertical);
  })();

  return (
    <div className={`bg-white rounded-xl border transition-colors ${selected ? 'border-green-400 ring-1 ring-green-200' : 'border-slate-200 hover:border-slate-300'}`}>
      {/* Summary row */}
      <div
        className="flex items-center gap-4 px-5 py-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Selection checkbox */}
        <button
          onClick={e => { e.stopPropagation(); onToggleSelect(prospect.id); }}
          className="shrink-0 text-slate-400 hover:text-green-700"
          title={selected ? 'Deselect' : 'Select for bulk send'}
        >
          {selected ? <CheckSquare size={17} className="text-green-700" /> : <Square size={17} />}
        </button>
        {/* Company + contact */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-semibold text-slate-900">{prospect.companyName}</span>
            {prospect.website && (
              <a
                href={`https://${prospect.website}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="text-slate-400 hover:text-slate-700"
              >
                <ExternalLink size={13} />
              </a>
            )}
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[prospect.status] || 'bg-slate-100 text-slate-700'}`}>
              {prospect.status}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="text-sm text-slate-500">{flag} {prospect.country}</span>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{vertLabel}</span>
            {/* Product interest tags (child sub-categories) */}
            {productInterests.length > 0 &&
              productInterests.slice(0, 3).map(slug => (
                <span key={slug} className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-full">
                  {formatSlug(slug)}
                </span>
              ))
            }
            {productInterests.length > 3 && (
              <span className="text-xs text-slate-400">+{productInterests.length - 3} more</span>
            )}
            {prospect.contactName && prospect.contactName !== 'TBD' && (
              <span className="text-sm text-slate-500">{prospect.contactName}</span>
            )}
          </div>
        </div>

        {/* Status indicators */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex flex-col items-end gap-1">
            {prospect.emailVerified && (
              <div className="flex items-center gap-1 text-xs text-green-600">
                <MailCheck size={12} /> Verified
              </div>
            )}
            {prospect.sanctionsScreened && (
              <div className="flex items-center gap-1 text-xs text-blue-600">
                <ShieldCheck size={12} /> Screened
              </div>
            )}
            {!prospect.sanctionsScreened && (
              <div className="flex items-center gap-1 text-xs text-amber-600">
                <Shield size={12} /> Screen first
              </div>
            )}
          </div>

          {/* Compose button */}
          <button
            onClick={e => { e.stopPropagation(); onCompose(prospect); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-700"
          >
            <Mail size={13} /> Email
          </button>

          {/* Expand chevron */}
          {expanded ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-slate-100 px-5 pb-5 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: details */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Contact details</h4>
              {prospect.email && prospect.email !== 'TBD' && (
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  <Mail size={14} className="text-slate-400 shrink-0" />
                  <a href={`mailto:${prospect.email}`} className="hover:underline">{prospect.email}</a>
                </div>
              )}
              {prospect.phone && (
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  <Phone size={14} className="text-slate-400 shrink-0" />
                  {prospect.phone}
                </div>
              )}
              {prospect.address && (
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  <MapPin size={14} className="text-slate-400 shrink-0" />
                  {prospect.address}{prospect.city ? `, ${prospect.city}` : ''}
                </div>
              )}
              {prospect.website && (
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  <Globe size={14} className="text-slate-400 shrink-0" />
                  <a href={`https://${prospect.website}`} target="_blank" rel="noopener noreferrer" className="hover:underline text-blue-600">
                    {prospect.website}
                  </a>
                </div>
              )}
              {prospect.linkedinUrl && (
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  <ArrowUpRight size={14} className="text-slate-400 shrink-0" />
                  <a href={prospect.linkedinUrl} target="_blank" rel="noopener noreferrer" className="hover:underline text-blue-600">
                    LinkedIn
                  </a>
                </div>
              )}
              {prospect.description && (
                <p className="text-xs text-slate-500 mt-3 leading-relaxed">{prospect.description}</p>
              )}

              {/* Checklist */}
              <div className="mt-4 flex items-center gap-4">
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input type="checkbox" checked={!!prospect.sanctionsScreened} readOnly className="rounded" />
                  <span className="text-slate-600">Sanctions screened</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input type="checkbox" checked={!!prospect.emailVerified} readOnly className="rounded" />
                  <span className="text-slate-600">Email verified</span>
                </label>
              </div>
            </div>

            {/* Right: email history */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Email history</h4>
                <button
                  onClick={() => onCompose(prospect)}
                  className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900"
                >
                  <Plus size={12} /> New email
                </button>
              </div>
              <EmailHistory prospect={prospect} refresh={refreshKey} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CSV parser (no library needed) ──────────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { headers: [], rows: [] };
  const parseRow = (line) => {
    const cells = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { cells.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    cells.push(cur.trim());
    return cells;
  };
  const headers = parseRow(lines[0]).map(h => h.replace(/^"|"$/g, '').toLowerCase().trim());
  const rows = lines.slice(1).filter(l => l.trim()).map(l => {
    const vals = parseRow(l).map(v => v.replace(/^"|"$/g, '').trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
    return obj;
  });
  return { headers, rows };
}

// Map CSV column name → Lead field
const CSV_FIELD_MAP = {
  company: 'companyName', company_name: 'companyName', companyname: 'companyName',
  contact: 'contactName', contact_name: 'contactName', contactname: 'contactName', name: 'contactName',
  email: 'email', email_address: 'email',
  phone: 'phone', telephone: 'phone', tel: 'phone',
  country: 'country',
  vertical: 'vertical', category: 'vertical', industry: 'vertical',
  website: 'website', url: 'website', web: 'website',
  linkedin: 'linkedinUrl', linkedin_url: 'linkedinUrl',
  address: 'address',
  notes: 'description', description: 'description', note: 'description',
  job_title: 'jobTitle', jobtitle: 'jobTitle', title: 'jobTitle', position: 'jobTitle',
};

// ─── Import CSV Tab ────────────────────────────────────────────────────────
function ImportCSVTab({ staffList, onImported, onClose }) {
  const fileRef = useRef(null);
  const [parsed, setParsed] = useState(null);   // { headers, rows, mapped }
  const [colMap, setColMap] = useState({});      // csvHeader → leadField
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const [assignedToId, setAssignedToId] = useState('');

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const { headers, rows } = parseCSV(ev.target.result);
      // Auto-detect column mapping
      const auto = {};
      headers.forEach(h => {
        const norm = h.replace(/\s+/g, '_');
        if (CSV_FIELD_MAP[norm]) auto[h] = CSV_FIELD_MAP[norm];
        else if (CSV_FIELD_MAP[h]) auto[h] = CSV_FIELD_MAP[h];
      });
      setColMap(auto);
      setParsed({ headers, rows });
      setError(null);
    };
    reader.readAsText(file);
  };

  const mappedRows = parsed?.rows.map(row => {
    const lead = {};
    Object.entries(colMap).forEach(([csvCol, field]) => {
      if (field && row[csvCol] !== undefined) lead[field] = row[csvCol];
    });
    return lead;
  }) || [];

  const valid = mappedRows.filter(r => r.companyName && r.contactName && r.email && r.country);

  const handleImport = async () => {
    if (!valid.length) return;
    setImporting(true);
    setError(null);
    let ok = 0, fail = 0;
    for (let i = 0; i < valid.length; i++) {
      setProgress(`Importing ${i + 1} of ${valid.length}…`);
      try {
        const { jobTitle, ...rest } = valid[i];
        await api.post('/crm/leads', {
          ...rest,
          leadType: 'outbound_prospect',
          source: 'cold_call',
          status: 'new',
          currency: 'USD',
          tags: [],
          assignedToId: assignedToId || undefined,
          additionalContacts: jobTitle ? [{ name: rest.contactName, jobTitle }] : [],
        });
        ok++;
      } catch { fail++; }
    }
    setImporting(false);
    setProgress(null);
    if (fail > 0) setError(`Imported ${ok} — ${fail} failed (missing required fields or duplicate email).`);
    else { onImported(); onClose(); }
  };

  const inputCls = 'w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white';
  const LEAD_FIELDS = [
    { value: '', label: '— Ignore —' },
    { value: 'companyName', label: 'Company name *' },
    { value: 'contactName', label: 'Contact name *' },
    { value: 'email', label: 'Email *' },
    { value: 'country', label: 'Country *' },
    { value: 'phone', label: 'Phone' },
    { value: 'vertical', label: 'Vertical' },
    { value: 'website', label: 'Website' },
    { value: 'linkedinUrl', label: 'LinkedIn URL' },
    { value: 'address', label: 'Address' },
    { value: 'description', label: 'Notes' },
    { value: 'jobTitle', label: 'Job title (primary contact)' },
  ];

  return (
    <div className="space-y-5">
      {/* File picker */}
      <div
        className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-slate-400 transition-colors"
        onClick={() => fileRef.current?.click()}
      >
        <Upload size={24} className="mx-auto text-slate-300 mb-2" />
        <p className="text-sm font-medium text-slate-600">Click to select a CSV file</p>
        <p className="text-xs text-slate-400 mt-1">Required columns: Company, Contact Name, Email, Country</p>
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
      </div>

      {parsed && (
        <>
          {/* Column mapping */}
          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Map columns — {parsed.rows.length} rows detected
            </h4>
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {parsed.headers.map(h => (
                <div key={h} className="flex items-center gap-3">
                  <span className="text-sm text-slate-700 w-40 shrink-0 truncate font-mono bg-slate-50 border border-slate-200 rounded px-2 py-1">
                    {h}
                  </span>
                  <span className="text-slate-400 text-xs">→</span>
                  <select
                    className={inputCls}
                    value={colMap[h] || ''}
                    onChange={e => setColMap(m => ({ ...m, [h]: e.target.value }))}
                  >
                    {LEAD_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Preview */}
          {mappedRows.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Preview — first 3 rows
              </h4>
              <div className="space-y-1.5">
                {mappedRows.slice(0, 3).map((r, i) => (
                  <div key={i} className={`text-xs rounded-lg px-3 py-2 flex items-center gap-3 ${
                    r.companyName && r.contactName && r.email && r.country
                      ? 'bg-green-50 border border-green-200 text-green-800'
                      : 'bg-red-50 border border-red-200 text-red-700'
                  }`}>
                    <span className="font-semibold">{r.companyName || '?'}</span>
                    <span>{r.contactName || '?'}</span>
                    <span>{r.email || '?'}</span>
                    <span>{r.country || '?'}</span>
                    {(!r.companyName || !r.contactName || !r.email || !r.country) && (
                      <span className="ml-auto font-medium">Missing required field</span>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-2">
                <strong className="text-green-700">{valid.length} valid</strong> of {mappedRows.length} rows will be imported.
                {mappedRows.length - valid.length > 0 && (
                  <span className="text-red-600"> {mappedRows.length - valid.length} will be skipped (missing required fields).</span>
                )}
              </p>
            </div>
          )}

          {/* Staff assignment for bulk import */}
          {staffList.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Assign all to (optional)</label>
              <select className={inputCls} value={assignedToId} onChange={e => setAssignedToId(e.target.value)}>
                <option value="">— Unassigned —</option>
                {staffList.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.firstName} {s.lastName} ({s.role})
                  </option>
                ))}
              </select>
            </div>
          )}

          {error && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center gap-2">
              <AlertCircle size={15} className="text-amber-600 shrink-0" />
              <p className="text-sm text-amber-700">{error}</p>
            </div>
          )}

          {progress && (
            <div className="text-sm text-slate-500 text-center">{progress}</div>
          )}

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">Cancel</button>
            <button
              type="button"
              onClick={handleImport}
              disabled={importing || valid.length === 0}
              className="flex items-center gap-2 px-5 py-2 bg-slate-900 text-white text-sm rounded-lg hover:bg-slate-700 disabled:opacity-50"
            >
              {importing ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
              {importing ? progress : `Import ${valid.length} prospect${valid.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </>
      )}

      {!parsed && (
        <div className="flex justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">Cancel</button>
        </div>
      )}
    </div>
  );
}

// ─── Add Prospect Modal ────────────────────────────────────────────────────
function AddProspectModal({ onClose, onCreated }) {
  const [tab, setTab] = useState('single'); // 'single' | 'import'
  const [staffList, setStaffList] = useState([]);

  // Form state — single prospect
  const EMPTY_CONTACT = { name: '', jobTitle: '' };
  const [companyName, setCompanyName] = useState('');
  const [contacts, setContacts] = useState([{ ...EMPTY_CONTACT }]); // primary first
  const [emails, setEmails] = useState(['']);                         // primary first
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('');
  const [vertical, setVertical] = useState('');
  const [productInterests, setProductInterests] = useState([]);
  const [website, setWebsite] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [assignedToId, setAssignedToId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [categoryTree, setCategoryTree] = useState([]);

  // Fetch staff + taxonomy
  useEffect(() => {
    api.get('/auth/staff').then(res => setStaffList(res.data || [])).catch(() => setStaffList([]));
    api.get('/products/categories/tree').then(res => setCategoryTree(res.data || [])).catch(() => {});
  }, []);

  // When vertical changes, clear product interests that don't belong to that parent
  useEffect(() => {
    if (!vertical) return;
    const parent = categoryTree.find(p => p.slug === vertical || p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') === vertical);
    if (!parent) return;
    const validSlugs = (parent.children || []).map(c => c.slug);
    setProductInterests(prev => prev.filter(s => validSlugs.includes(s)));
  }, [vertical, categoryTree]);

  // Contacts helpers
  const addContact = () => setContacts(c => [...c, { ...EMPTY_CONTACT }]);
  const removeContact = (i) => setContacts(c => c.filter((_, idx) => idx !== i));
  const updateContact = (i, field, val) => setContacts(c => c.map((ct, idx) => idx === i ? { ...ct, [field]: val } : ct));

  // Emails helpers
  const addEmail = () => setEmails(e => [...e, '']);
  const removeEmail = (i) => setEmails(e => e.filter((_, idx) => idx !== i));
  const updateEmail = (i, val) => setEmails(e => e.map((em, idx) => idx === i ? val : em));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const primaryContact = contacts[0];
    const primaryEmail = emails[0];
    if (!companyName || !primaryContact.name || !primaryEmail || !country) {
      setError('Company name, primary contact, primary email, and country are required.');
      return;
    }
    try {
      setSaving(true);
      setError(null);
      const additionalContacts = contacts.slice(1).filter(c => c.name).map(c => ({
        name: c.name,
        jobTitle: c.jobTitle || undefined,
      }));
      // If primary contact has a job title, include it in additionalContacts as first entry metadata
      if (primaryContact.jobTitle) {
        additionalContacts.unshift({ name: primaryContact.name, jobTitle: primaryContact.jobTitle, isPrimary: true });
      }
      await api.post('/crm/leads', {
        companyName,
        contactName: primaryContact.name,
        email: primaryEmail,
        phone: phone || undefined,
        country,
        vertical: vertical || undefined,
        productInterests: productInterests.length > 0 ? productInterests : undefined,
        website: website || undefined,
        linkedinUrl: linkedinUrl || undefined,
        address: address || undefined,
        description: description || undefined,
        assignedToId: assignedToId || undefined,
        leadType: 'outbound_prospect',
        source: 'cold_call',
        status: 'new',
        currency: 'USD',
        tags: emails.slice(1).filter(Boolean).map(em => `email:${em}`),
        additionalContacts,
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create prospect.');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white';
  const labelCls = 'block text-xs font-medium text-slate-600 mb-1';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100 shrink-0">
          <h2 className="text-lg font-bold text-slate-900">Add Prospect</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 shrink-0 px-6">
          {[
            { id: 'single', label: 'Single entry', icon: UserPlus },
            { id: 'import', label: 'Import CSV', icon: Upload },
          ].map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.id
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                <Icon size={14} />{t.label}
              </button>
            );
          })}
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {tab === 'import' ? (
            <ImportCSVTab staffList={staffList} onImported={onCreated} onClose={onClose} />
          ) : (
            <form id="add-prospect-form" onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center gap-2">
                  <AlertCircle size={15} className="text-red-600 shrink-0" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* Company */}
              <div>
                <label className={labelCls}>Company name <span className="text-red-500">*</span></label>
                <input className={inputCls} value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="e.g. Acme Flooring Ltd" />
              </div>

              {/* Contacts */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={labelCls + ' mb-0'}>Contacts <span className="text-red-500">*</span></label>
                  <button type="button" onClick={addContact} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 border border-slate-200 rounded-md px-2 py-1 hover:border-slate-400">
                    <Plus size={11} /> Add contact
                  </button>
                </div>
                <div className="space-y-2">
                  {contacts.map((ct, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <input
                          className={inputCls}
                          placeholder={i === 0 ? 'Full name *' : 'Full name'}
                          value={ct.name}
                          onChange={e => updateContact(i, 'name', e.target.value)}
                        />
                        <input
                          className={inputCls}
                          placeholder="Job title (optional)"
                          value={ct.jobTitle}
                          onChange={e => updateContact(i, 'jobTitle', e.target.value)}
                        />
                      </div>
                      {i > 0 && (
                        <button type="button" onClick={() => removeContact(i)} className="mt-2 text-slate-300 hover:text-red-500 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Emails */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={labelCls + ' mb-0'}>Email addresses <span className="text-red-500">*</span></label>
                  <button type="button" onClick={addEmail} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 border border-slate-200 rounded-md px-2 py-1 hover:border-slate-400">
                    <Plus size={11} /> Add email
                  </button>
                </div>
                <div className="space-y-2">
                  {emails.map((em, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="email"
                        className={inputCls}
                        placeholder={i === 0 ? 'Primary email *' : 'Additional email'}
                        value={em}
                        onChange={e => updateEmail(i, e.target.value)}
                      />
                      {i > 0 && (
                        <button type="button" onClick={() => removeEmail(i)} className="text-slate-300 hover:text-red-500 transition-colors shrink-0">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Core fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Phone</label>
                  <input className={inputCls} value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 555 000 0000" />
                </div>
                <div>
                  <label className={labelCls}>Country <span className="text-red-500">*</span></label>
                  <input className={inputCls} value={country} onChange={e => setCountry(e.target.value)} placeholder="e.g. Egypt" />
                </div>
                <div>
                  <label className={labelCls}>Vertical (Category)</label>
                  <select className={inputCls} value={vertical} onChange={e => setVertical(e.target.value)}>
                    <option value="">— Select —</option>
                    {categoryTree.length > 0
                      ? categoryTree.map(p => <option key={p.slug} value={p.slug}>{p.icon ? `${p.icon} ` : ''}{p.name}</option>)
                      : Object.entries(VERTICAL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)
                    }
                  </select>
                </div>
                {/* Sub-category interests — shown only when a vertical with children is selected */}
                {(() => {
                  const parent = categoryTree.find(p => p.slug === vertical);
                  if (!parent || !parent.children?.length) return null;
                  return (
                    <div className="sm:col-span-2">
                      <label className={labelCls}>Product Interests <span className="text-slate-400 font-normal">(select all that apply)</span></label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {parent.children.map(child => {
                          const isSelected = productInterests.includes(child.slug);
                          return (
                            <button
                              key={child.slug}
                              type="button"
                              onClick={() => setProductInterests(prev =>
                                isSelected ? prev.filter(s => s !== child.slug) : [...prev, child.slug]
                              )}
                              className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                                isSelected
                                  ? 'bg-slate-900 text-white border-slate-900'
                                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                              }`}
                            >
                              {child.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
                <div>
                  <label className={labelCls}>Website</label>
                  <input className={inputCls} value={website} onChange={e => setWebsite(e.target.value)} placeholder="company.com" />
                </div>
                <div>
                  <label className={labelCls}>LinkedIn URL</label>
                  <input className={inputCls} value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)} placeholder="linkedin.com/company/…" />
                </div>

                {/* Staff assignment */}
                <div>
                  <label className={labelCls}>
                    <span className="flex items-center gap-1"><UserCheck size={11} /> Assign to</span>
                  </label>
                  <select className={inputCls} value={assignedToId} onChange={e => setAssignedToId(e.target.value)}>
                    <option value="">— Unassigned —</option>
                    {staffList.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.firstName} {s.lastName} ({s.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className={labelCls}>Address</label>
                <input className={inputCls} value={address} onChange={e => setAddress(e.target.value)} placeholder="Street, City" />
              </div>
              <div>
                <label className={labelCls}>Notes</label>
                <textarea className={inputCls} rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Products they import, how you found them, key details…" />
              </div>
            </form>
          )}
        </div>

        {/* Footer — single tab only (import tab has its own footer) */}
        {tab === 'single' && (
          <div className="px-6 py-4 border-t border-slate-100 shrink-0 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">Cancel</button>
            <button
              type="submit"
              form="add-prospect-form"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-slate-900 text-white text-sm rounded-lg hover:bg-slate-700 disabled:opacity-50"
            >
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
              {saving ? 'Saving…' : 'Add prospect'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Bulk Send Modal ───────────────────────────────────────────────────────
const MERGE_HINTS = ['{{firstName}}', '{{companyName}}', '{{country}}', '{{vertical}}'];

function resolveMerge(template, lead) {
  if (!template || !lead) return template || '';
  const firstName = (lead.contactName || '').split(' ')[0] || '';
  return template
    .replace(/\{\{firstName\}\}/g, firstName)
    .replace(/\{\{contactName\}\}/g, lead.contactName || '')
    .replace(/\{\{companyName\}\}/g, lead.companyName || '')
    .replace(/\{\{country\}\}/g, lead.country || '')
    .replace(/\{\{vertical\}\}/g, VERTICAL_LABELS[lead.vertical] || lead.vertical || '');
}

function BulkSendModal({ selectedLeads, onClose, onComplete }) {
  const { getBrand, accessibleBrands, defaultBrand } = useBrands();

  // Build FROM_OPTIONS from accessible brands (ordered by defaultBrand first).
  const fromOptions = [...accessibleBrands]
    .sort((a, b) => (a === defaultBrand ? -1 : b === defaultBrand ? 1 : 0))
    .map(code => {
      const b = getBrand(code);
      return b ? { value: b.senderEmail, label: `${b.senderEmail}  (${b.displayName})`, code } : null;
    })
    .filter(Boolean);
  if (fromOptions.length === 0) {
    fromOptions.push({ value: 'alex@sovernhouse.co', label: 'alex@sovernhouse.co  (Sovern House)', code: 'SH' });
  }
  const defaultFromAddress = fromOptions[0].value;

  // Egypt BCC rule: only when ALL selected leads are SH-brand Egyptian leads.
  const allEgyptSH = selectedLeads.length > 0 &&
    selectedLeads.every(l => l.country === 'Egypt' && (l.brandCode || 'SH') === 'SH');

  // Detect mixed-brand selection for the warning banner.
  const selectedBrandCodes = [...new Set(selectedLeads.map(l => l.brandCode || 'SH'))];
  const isMixedBrand = selectedBrandCodes.length > 1;

  const [form, setForm] = useState({
    name: `Outreach ${new Date().toISOString().slice(0, 10)}`,
    fromAddress: defaultFromAddress,
    cc: '',
    bcc: allEgyptSH ? DEFAULT_BCC : '',
    touchNumber: 1,
    followUpDays: 4,
    subjectTemplate: '',
    bodyTemplate: '',
  });
  const [previewIdx, setPreviewIdx] = useState(0);
  const [tab, setTab] = useState('compose'); // 'compose' | 'progress'
  const [campaignId, setCampaignId] = useState(null);
  const [progress, setProgress] = useState(null); // { sendStatus, sentCount, failedCount, totalRecipients, emails }
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [showSave, setShowSave] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [savingTpl, setSavingTpl] = useState(false);
  const [signatures, setSignatures] = useState([]);
  const [selectedSigId, setSelectedSigId] = useState('');
  const pollRef = useRef(null);

  // Re-fetch templates when the from-address brand changes.
  useEffect(() => {
    const brandCode = fromOptions.find(o => o.value === form.fromAddress)?.code || 'SH';
    api.get(`/crm/email-templates?brandCode=${brandCode}`).then(r => setTemplates(r.data?.data || [])).catch(() => {});
  }, [form.fromAddress]);

  useEffect(() => {
    api.get('/crm/email-signatures').then(r => {
      const sigs = r.data?.data || [];
      setSignatures(sigs);
      const def = sigs.find(s => s.isDefault);
      if (def) setSelectedSigId(def.id);
    }).catch(() => {});
  }, []);

  const loadTemplate = (id) => {
    const t = templates.find(t => t.id === id);
    if (t) setForm(f => ({ ...f, subjectTemplate: t.subject, bodyTemplate: t.bodyText }));
  };

  const saveTemplate = async () => {
    if (!saveName.trim() || !form.subjectTemplate || !form.bodyTemplate) return;
    setSavingTpl(true);
    const currentBrandCode = fromOptions.find(o => o.value === form.fromAddress)?.code || 'SH';
    try {
      const res = await api.post('/crm/email-templates', { name: saveName.trim(), subject: form.subjectTemplate, bodyText: form.bodyTemplate, brandCode: currentBrandCode });
      setTemplates(ts => [...ts, res.data.data]);
      setSaveName(''); setShowSave(false);
    } catch {}
    setSavingTpl(false);
  };

  const followUpMap = { 1: 4, 2: 10, 3: 18, 4: 25, 5: 0 };
  const previewLead = selectedLeads[previewIdx] || selectedLeads[0];

  // Poll status while sending
  useEffect(() => {
    if (!campaignId) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await api.get(`/crm/campaigns/${campaignId}/status`);
        // L-045: axios interceptor already unwraps {success,data}.
        // res.data is the payload directly; fall through if not unwrapped.
        const d = res.data?.data ?? res.data;
        setProgress(d);
        if (d?.sendStatus === 'completed' || d?.sendStatus === 'failed') {
          clearInterval(pollRef.current);
          setSending(false);
        }
      } catch { /* keep polling */ }
    }, 2000);
    return () => clearInterval(pollRef.current);
  }, [campaignId]);

  const handleSend = async () => {
    if (!form.subjectTemplate || !form.bodyTemplate) {
      setError('Subject and body are required.');
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await api.post('/crm/campaigns/send', {
        name: form.name,
        leadIds: selectedLeads.map(l => l.id),
        fromAddress: form.fromAddress,
        cc: form.cc || null,
        bcc: form.bcc || null,
        subjectTemplate: form.subjectTemplate,
        bodyTemplate: form.bodyTemplate,
        touchNumber: form.touchNumber,
        followUpDays: form.followUpDays,
        signatureId: selectedSigId || undefined,
      });
      setCampaignId(res.data.campaignId);
      setTab('progress');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to start campaign. Check SMTP config.');
      setSending(false);
    }
  };

  const isDone = progress?.sendStatus === 'completed' || progress?.sendStatus === 'failed';

  const insertMerge = (token, field) => {
    setForm(f => ({ ...f, [field]: f[field] + token }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Bulk Send Campaign</h3>
            <p className="text-sm text-slate-500 mt-0.5">{selectedLeads.length} prospect{selectedLeads.length !== 1 ? 's' : ''} selected · staggered 2–8s between sends</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 px-6">
          {[
            { id: 'compose', label: 'Compose', icon: Mail },
            { id: 'progress', label: 'Progress', icon: BarChart2, disabled: !campaignId },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => !t.disabled && setTab(t.id)}
              disabled={t.disabled}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <t.icon size={14} />{t.label}
            </button>
          ))}
        </div>

        {/* ── Compose tab ── */}
        {tab === 'compose' && (
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle size={16} className="text-red-600 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {isMixedBrand && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle size={16} className="text-amber-600 mt-0.5 shrink-0" />
                <p className="text-sm text-amber-700">
                  Mixed brands selected: {selectedBrandCodes.join(' + ')}. Choose "Send from" carefully — the Egypt BCC rule applies per-lead based on each lead's brand.
                </p>
              </div>
            )}

            {/* ── Template bar ── */}
            <div className="flex items-center gap-2 flex-wrap pb-1 border-b border-slate-100">
              <select
                className="flex-1 min-w-0 border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-600"
                defaultValue=""
                onChange={e => { if (e.target.value) { loadTemplate(e.target.value); e.target.value = ''; } }}
              >
                <option value="">{templates.length ? 'Load template…' : 'No templates saved yet'}</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              {!showSave ? (
                <button type="button" onClick={() => setShowSave(true)} className="shrink-0 text-xs px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 whitespace-nowrap">
                  Save as template
                </button>
              ) : (
                <>
                  <input
                    autoFocus
                    className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                    placeholder="Template name…"
                    value={saveName}
                    onChange={e => setSaveName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveTemplate(); if (e.key === 'Escape') setShowSave(false); }}
                  />
                  <button onClick={saveTemplate} disabled={savingTpl || !saveName.trim()} className="shrink-0 text-xs px-3 py-1.5 bg-slate-900 text-white rounded-lg disabled:opacity-40 hover:bg-slate-700">
                    {savingTpl ? '…' : 'Save'}
                  </button>
                  <button onClick={() => { setShowSave(false); setSaveName(''); }} className="shrink-0 text-xs px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
                    ✕
                  </button>
                </>
              )}
            </div>

            {/* Campaign name + FROM */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Campaign name</label>
                <input
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Send from</label>
                <select
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
                  value={form.fromAddress}
                  onChange={e => setForm(f => ({ ...f, fromAddress: e.target.value }))}
                >
                  {fromOptions.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* CC + BCC */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">CC</label>
                <input
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                  placeholder="cc@example.com"
                  value={form.cc}
                  onChange={e => setForm(f => ({ ...f, cc: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  BCC
                  {allEgyptSH && (
                    <span className="ml-1.5 text-[10px] text-amber-600 font-normal">🇪🇬 Egypt (SH) — Mohannad auto-added</span>
                  )}
                </label>
                <input
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                  value={form.bcc}
                  onChange={e => setForm(f => ({ ...f, bcc: e.target.value }))}
                />
              </div>
            </div>

            {/* Touch # + follow-up */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Touch #</label>
                <select
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
                  value={form.touchNumber}
                  onChange={e => {
                    const t = parseInt(e.target.value);
                    setForm(f => ({ ...f, touchNumber: t, followUpDays: followUpMap[t] ?? 4 }));
                  }}
                >
                  {Object.entries(TOUCH_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{k} — {v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Follow-up reminder (days)</label>
                <input
                  type="number" min={0} max={60}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                  value={form.followUpDays}
                  onChange={e => setForm(f => ({ ...f, followUpDays: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>

            {/* Merge field pills */}
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-xs text-slate-400">Insert merge field:</span>
              {MERGE_HINTS.map(token => (
                <button
                  key={token}
                  type="button"
                  className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full hover:bg-slate-200 font-mono"
                  onClick={() => {
                    // Insert into whichever field was last focused — default to body
                    insertMerge(token, 'bodyTemplate');
                  }}
                >
                  {token}
                </button>
              ))}
            </div>

            {/* Subject */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Subject template</label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                placeholder="e.g. direct factory partner for {{companyName}}"
                value={form.subjectTemplate}
                onChange={e => setForm(f => ({ ...f, subjectTemplate: e.target.value }))}
              />
            </div>

            {/* Body */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Body template (plain text)</label>
              <textarea
                rows={9}
                spellCheck="true"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-serif focus:outline-none focus:ring-2 focus:ring-slate-400 resize-none"
                placeholder={"Dear {{firstName}},\n\nI'm reaching out because..."}
                value={form.bodyTemplate}
                onChange={e => setForm(f => ({ ...f, bodyTemplate: e.target.value }))}
              />
              {/* Signature selector */}
              <div className="mt-2 border border-slate-100 rounded-lg px-3 py-2 bg-slate-50 flex items-center gap-2">
                <span className="text-xs text-slate-400 shrink-0">Signature:</span>
                <select
                  className="flex-1 text-xs border border-slate-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 text-slate-700"
                  value={selectedSigId}
                  onChange={e => setSelectedSigId(e.target.value)}
                >
                  <option value="">— Default (Alex McConnell) —</option>
                  {signatures.map(s => (
                    <option key={s.id} value={s.id}>{s.name}{s.isDefault ? ' ★' : ''}</option>
                  ))}
                </select>
                {selectedSigId && (() => {
                  const sig = signatures.find(s => s.id === selectedSigId);
                  return sig ? <span className="text-xs text-slate-500 shrink-0">{sig.displayName}{sig.title ? ` · ${sig.title}` : ''}</span> : null;
                })()}
              </div>
            </div>

            {/* Preview panel */}
            {form.subjectTemplate && form.bodyTemplate && selectedLeads.length > 0 && (
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Preview</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Prospect:</span>
                    <select
                      className="text-xs border border-slate-200 rounded px-2 py-1 bg-white"
                      value={previewIdx}
                      onChange={e => setPreviewIdx(parseInt(e.target.value))}
                    >
                      {selectedLeads.map((l, i) => (
                        <option key={l.id} value={i}>{l.companyName}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="text-xs font-medium text-slate-700 mb-1">
                  Subject: {resolveMerge(form.subjectTemplate, previewLead)}
                </p>
                <p className="text-xs text-slate-600 whitespace-pre-wrap font-serif leading-relaxed">
                  {resolveMerge(form.bodyTemplate, previewLead)}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Progress tab ── */}
        {tab === 'progress' && (
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {progress ? (
              <>
                {/* Status summary */}
                <div className="bg-slate-50 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <div className={`text-sm font-semibold ${
                      progress.sendStatus === 'completed' ? 'text-green-700' :
                      progress.sendStatus === 'failed'    ? 'text-red-700'   :
                      'text-blue-700'
                    }`}>
                      {progress.sendStatus === 'sending'   && '⏳ Sending…'}
                      {progress.sendStatus === 'completed' && '✓ Campaign complete'}
                      {progress.sendStatus === 'failed'    && '✗ Campaign failed'}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {progress.sentCount} sent · {progress.failedCount} failed · {progress.totalRecipients} total
                    </div>
                  </div>
                  {progress.sendStatus === 'sending' && (
                    <RefreshCw size={18} className="text-blue-500 animate-spin" />
                  )}
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${
                      progress.sendStatus === 'failed' ? 'bg-red-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.round(((progress.sentCount + progress.failedCount) / (progress.totalRecipients || 1)) * 100)}%` }}
                  />
                </div>

                {/* Per-prospect results */}
                <div className="space-y-2">
                  {(progress.emails || []).map(em => (
                    <div key={em.id} className="flex items-center justify-between text-sm border border-slate-100 rounded-lg px-4 py-2.5 bg-white">
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-slate-800">{em.lead?.companyName || em.toAddress}</span>
                        <span className="text-slate-400 text-xs ml-2">{em.lead?.contactName}</span>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        em.status === 'sent'   ? 'bg-green-100 text-green-700' :
                        em.status === 'failed' ? 'bg-red-100 text-red-700'    :
                        'bg-slate-100 text-slate-600'
                      }`}>{em.status}</span>
                    </div>
                  ))}
                  {/* Pending prospects not yet attempted */}
                  {progress.sendStatus === 'sending' && selectedLeads
                    .filter(l => !(progress.emails || []).some(e => e.toAddress === l.email))
                    .map(l => (
                      <div key={l.id} className="flex items-center justify-between text-sm border border-slate-100 rounded-lg px-4 py-2.5 bg-white opacity-50">
                        <span className="font-medium text-slate-800">{l.companyName}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">queued</span>
                      </div>
                    ))
                  }
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-slate-400 text-sm">
                <RefreshCw size={20} className="animate-spin mx-auto mb-2" />
                Starting campaign…
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
          {tab === 'compose' ? (
            <>
              <p className="text-xs text-slate-400 flex items-center gap-1.5">
                {selectedLeads.length} email{selectedLeads.length !== 1 ? 's' : ''} · from <strong>{form.fromAddress}</strong>
                {fromOptions.find(o => o.value === form.fromAddress) && (
                  <BrandBadge code={fromOptions.find(o => o.value === form.fromAddress).code} size="sm" />
                )}
              </p>
              <div className="flex gap-3">
                <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100">
                  Cancel
                </button>
                <button
                  onClick={handleSend}
                  disabled={sending || !form.subjectTemplate || !form.bodyTemplate}
                  className="flex items-center gap-2 px-5 py-2 bg-slate-900 text-white text-sm rounded-lg hover:bg-slate-700 disabled:opacity-50"
                >
                  {sending ? <RefreshCw size={15} className="animate-spin" /> : <Zap size={15} />}
                  {sending ? 'Starting…' : `Send to ${selectedLeads.length}`}
                </button>
              </div>
            </>
          ) : (
            <div className="w-full flex justify-end">
              <button
                onClick={() => { onComplete(); onClose(); }}
                disabled={!isDone}
                className="px-5 py-2 bg-slate-900 text-white text-sm rounded-lg hover:bg-slate-700 disabled:opacity-40"
              >
                {isDone ? 'Done' : 'Sending… please wait'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Client Contacts Page ─────────────────────────────────────────────
export default function ClientContacts() {
  const [prospects, setProspects] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState([]); // array of slugs (parent or sub-category)
  const [countryFilter, setCountryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [composeTarget, setComposeTarget] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkSend, setShowBulkSend] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [refreshKey, setRefreshKey] = useState(0);
  const [followups, setFollowups] = useState([]);
  const [categoryTree, setCategoryTree] = useState([]);

  const STATUS_ORDER = { new: 1, contacted: 2, qualified: 3, proposal: 4, negotiation: 5, won: 6, lost: 7 };

  const fetchProspects = async () => {
    try {
      setLoading(true);
      const res = await api.get('/crm/leads?leadType=outbound_prospect&limit=200');
      setProspects(res.data || []);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load client contacts');
    } finally {
      setLoading(false);
    }
  };

  const fetchFollowups = async () => {
    try {
      const res = await api.get('/crm/outreach/followups');
      setFollowups(res.data || []);
    } catch {
      setFollowups([]);
    }
  };

  useEffect(() => {
    fetchProspects();
    fetchFollowups();
    api.get('/products/categories/tree')
      .then(r => setCategoryTree(r.data || []))
      .catch(() => {});
  }, [refreshKey]);

  useEffect(() => {
    let f = [...prospects];

    // Filter
    if (search) {
      const q = search.toLowerCase();
      f = f.filter(p =>
        p.companyName?.toLowerCase().includes(q) ||
        p.contactName?.toLowerCase().includes(q) ||
        p.email?.toLowerCase().includes(q) ||
        p.country?.toLowerCase().includes(q)
      );
    }
    if (categoryFilter.length > 0) {
      f = f.filter(p => {
        const interests = Array.isArray(p.productInterests) ? p.productInterests : [];
        return categoryFilter.some(slug =>
          // Parent match — backward compat for leads that only have `vertical` set
          p.vertical === slug ||
          // Sub-category match — leads tagged with specific product interests
          interests.includes(slug)
        );
      });
    }
    if (countryFilter) f = f.filter(p => p.country === countryFilter);
    if (statusFilter) f = f.filter(p => p.status === statusFilter);

    // Sort
    const followupMap = {};
    followups.forEach(fu => {
      if (fu.lead?.id) followupMap[fu.lead.id] = fu.followUpDueAt;
    });

    f.sort((a, b) => {
      switch (sortBy) {
        case 'az':
          return (a.companyName || '').localeCompare(b.companyName || '');
        case 'za':
          return (b.companyName || '').localeCompare(a.companyName || '');
        case 'country':
          return (a.country || '').localeCompare(b.country || '') ||
                 (a.companyName || '').localeCompare(b.companyName || '');
        case 'vertical':
          return (a.vertical || '').localeCompare(b.vertical || '') ||
                 (a.companyName || '').localeCompare(b.companyName || '');
        case 'stage':
          return (STATUS_ORDER[a.status] || 99) - (STATUS_ORDER[b.status] || 99);
        case 'followup': {
          const aDate = followupMap[a.id] ? new Date(followupMap[a.id]) : null;
          const bDate = followupMap[b.id] ? new Date(followupMap[b.id]) : null;
          if (aDate && bDate) return aDate - bDate;
          if (aDate) return -1;
          if (bDate) return 1;
          return 0;
        }
        case 'oldest':
          return new Date(a.createdAt) - new Date(b.createdAt);
        case 'newest':
        default:
          return new Date(b.createdAt) - new Date(a.createdAt);
      }
    });

    setFiltered(f);
  }, [prospects, search, categoryFilter, countryFilter, statusFilter, sortBy, followups]);

  const countries = [...new Set(prospects.map(p => p.country).filter(Boolean))].sort();

  const handleSent = () => {
    setRefreshKey(k => k + 1);
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(p => p.id)));
    }
  };

  const selectedLeads = filtered.filter(p => selectedIds.has(p.id));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-700 mx-auto" />
          <p className="mt-3 text-sm text-slate-500">Loading client contacts…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {/* Page header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Users2 size={22} className="text-slate-700" />
              <h1 className="text-2xl font-bold text-slate-900">Client Contacts</h1>
            </div>
            <p className="text-slate-500 text-sm">
              Outbound prospect pipeline — {filtered.length} of {prospects.length} contacts
              {selectedIds.size > 0 && (
                <span className="ml-2 text-slate-700 font-medium">· {selectedIds.size} selected</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <button
                onClick={() => setShowBulkSend(true)}
                className="flex items-center gap-2 px-4 py-2 bg-green-700 text-white text-sm rounded-lg hover:bg-green-800"
              >
                <Zap size={15} /> Bulk Send ({selectedIds.size})
              </button>
            )}
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm rounded-lg hover:bg-slate-700"
            >
              <Plus size={16} /> Add prospect
            </button>
          </div>
        </div>

        {/* Follow-up alert bar */}
        {followups.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 mb-6 flex items-center gap-3">
            <Clock size={16} className="text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800">
              <strong>{followups.length} follow-up{followups.length > 1 ? 's' : ''}</strong> due within 7 days.{' '}
              {followups.slice(0, 3).map(f => f.lead?.companyName).filter(Boolean).join(', ')}
              {followups.length > 3 ? ` and ${followups.length - 3} more.` : '.'}
            </p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-2">
            <AlertCircle size={16} className="text-red-600 mt-0.5 shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl border border-slate-200 px-5 py-4 mb-6 flex flex-wrap gap-3 items-center">
          {/* Select-all toggle */}
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 shrink-0"
            title={selectedIds.size === filtered.length ? 'Deselect all' : 'Select all'}
          >
            {selectedIds.size === filtered.length && filtered.length > 0
              ? <CheckSquare size={16} className="text-green-700" />
              : <Square size={16} />
            }
            <span className="hidden sm:inline">All</span>
          </button>
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search company, contact, country…"
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <CategoryFilter
            selected={categoryFilter}
            onChange={setCategoryFilter}
            categoryTree={categoryTree}
          />
          <select
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
            value={countryFilter}
            onChange={e => setCountryFilter(e.target.value)}
          >
            <option value="">All countries</option>
            {countries.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            {['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost'].map(s => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>

          {/* Sort */}
          <div className="flex items-center gap-2 ml-auto pl-3 border-l border-slate-200">
            <ArrowUpDown size={14} className="text-slate-400 shrink-0" />
            <select
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
            >
              <option value="newest">Newest added</option>
              <option value="oldest">Oldest added</option>
              <option value="az">A → Z</option>
              <option value="za">Z → A</option>
              <option value="country">Country</option>
              <option value="vertical">Vertical</option>
              <option value="stage">Pipeline stage</option>
              <option value="followup">Follow-up due</option>
            </select>
          </div>
        </div>

        {/* Prospect list */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 py-16 text-center">
            <Users2 size={40} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 text-sm">No client contacts found.</p>
            <p className="text-slate-400 text-xs mt-1">
              Run <code className="bg-slate-100 px-1 rounded">npm run seed:prospects</code> in the backend to import batch 01.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(p => (
              <ProspectCard
                key={p.id}
                prospect={p}
                onCompose={setComposeTarget}
                refreshKey={refreshKey}
                selected={selectedIds.has(p.id)}
                onToggleSelect={toggleSelect}
              />
            ))}
          </div>
        )}
      </div>

      {/* Compose modal */}
      {composeTarget && (
        <ComposePanel
          prospect={composeTarget}
          onClose={() => setComposeTarget(null)}
          onSent={handleSent}
        />
      )}

      {/* Bulk Send modal */}
      {showBulkSend && selectedLeads.length > 0 && (
        <BulkSendModal
          selectedLeads={selectedLeads}
          onClose={() => setShowBulkSend(false)}
          onComplete={() => { setSelectedIds(new Set()); setRefreshKey(k => k + 1); }}
        />
      )}

      {/* Add Prospect modal */}
      {showAddModal && (
        <AddProspectModal
          onClose={() => setShowAddModal(false)}
          onCreated={() => setRefreshKey(k => k + 1)}
        />
      )}
    </div>
  );
}
