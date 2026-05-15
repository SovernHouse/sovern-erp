/**
 * Tariff Rates admin — Phase 4.9 C-2.
 *
 * Super-admin CRUD for the TariffRate table. Lists current + expiring
 * rates with edit/delete actions, plus an inline create row at the
 * top. Sourced rates seeded at boot (CN->US, MY->US) per Alex's
 * HanHua factory note; everything from there is admin-managed.
 *
 * L-045: this page reads via the shared `api` axios instance, so
 * `res.data` is already the unwrapped payload — do not write
 * `res.data?.data`.
 */

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2, Pencil, AlertTriangle, Check, X } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../hooks/useAuth';

function todayISO() { return new Date().toISOString().slice(0, 10); }
function plusDaysISO(d) { const x = new Date(); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10); }
function daysFromToday(iso) {
  const a = new Date(todayISO()).getTime();
  const b = new Date(iso).getTime();
  return Math.round((b - a) / 86400000);
}

function ExpiryBadge({ effectiveUntil }) {
  const diff = daysFromToday(effectiveUntil);
  if (diff < 0) return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-200"><AlertTriangle size={12} /> Expired {-diff}d ago</span>;
  if (diff <= 7) return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200"><AlertTriangle size={12} /> Expires in {diff}d</span>;
  return <span className="text-xs text-slate-500">{diff}d</span>;
}

export default function TariffRates() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showExpired, setShowExpired] = useState(false);
  const [editing, setEditing] = useState(null); // row id being edited
  const [draft, setDraft] = useState(null);     // editing state OR new-row state
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const qs = showExpired ? '?includeExpired=true' : '';
      const res = await api.get(`/tariff-rates${qs}`);
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load tariff rates');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [showExpired]);

  const startCreate = () => {
    setCreating(true);
    setDraft({
      originCountry: '',
      destinationCountry: '',
      ratePercent: '',
      effectiveFrom: todayISO(),
      effectiveUntil: plusDaysISO(30),
      sourceNote: '',
      brandCode: '',
    });
  };

  const cancelDraft = () => { setCreating(false); setEditing(null); setDraft(null); };

  const startEdit = (row) => {
    setEditing(row.id);
    setDraft({
      originCountry: row.originCountry,
      destinationCountry: row.destinationCountry,
      ratePercent: String(row.ratePercent),
      effectiveFrom: row.effectiveFrom,
      effectiveUntil: row.effectiveUntil,
      sourceNote: row.sourceNote || '',
      brandCode: row.brandCode || '',
    });
  };

  const saveDraft = async () => {
    if (!draft.originCountry || !draft.destinationCountry || !draft.ratePercent || !draft.effectiveFrom || !draft.effectiveUntil) {
      toast.error('Origin, destination, rate %, and effective dates are required');
      return;
    }
    const payload = {
      ...draft,
      ratePercent: Number(draft.ratePercent),
      brandCode: draft.brandCode || null,
      sourceNote: draft.sourceNote || null,
    };
    try {
      if (creating) {
        await api.post('/tariff-rates', payload);
        toast.success('Tariff rate created');
      } else {
        await api.put(`/tariff-rates/${editing}`, payload);
        toast.success('Tariff rate updated');
      }
      cancelDraft();
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    }
  };

  const handleDelete = async (row) => {
    if (!confirm(`Delete the tariff rate for ${row.originCountry} -> ${row.destinationCountry} (${row.ratePercent}%)?`)) return;
    try {
      await api.delete(`/tariff-rates/${row.id}`);
      toast.success('Tariff rate deleted');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  const fieldDraft = (k) => (e) => setDraft((prev) => ({ ...prev, [k]: e.target.value }));

  const grouped = useMemo(() => {
    const map = {};
    for (const r of rows) {
      const key = `${r.originCountry} -> ${r.destinationCountry}`;
      if (!map[key]) map[key] = [];
      map[key].push(r);
    }
    return map;
  }, [rows]);

  if (!isSuperAdmin) {
    return (
      <div className="p-8 text-center text-slate-500">
        <h2 className="text-xl font-semibold mb-2">Forbidden</h2>
        <p>Tariff rate admin is super-admin only. List view is open to all authenticated users via the API.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tariff rates</h1>
          <p className="text-sm text-slate-500 mt-1">
            Import duty rates by origin -> destination. Quotation builder reads from this table when generating landed-cost columns on USA-destination quotes. Confirm with factory before quoting near or past an expiry date.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" checked={showExpired} onChange={(e) => setShowExpired(e.target.checked)} className="w-4 h-4 rounded border-slate-300" />
            Show expired
          </label>
          <button onClick={startCreate} className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 text-sm font-medium">
            <Plus className="w-4 h-4" /> New rate
          </button>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-xs text-amber-900">
        US tariff policy moves fast (Section 301 + IEEPA + reciprocal stacks change monthly in 2026). Every row carries an explicit effectiveUntil; the quotation builder warns when a rate is expiring or expired. Source the rate from the factory or USTR order and paste a one-line note so the provenance is audit-trail-clear.
      </div>

      {creating && draft && (
        <DraftRow draft={draft} fieldDraft={fieldDraft} onSave={saveDraft} onCancel={cancelDraft} label="New rate" />
      )}

      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />)}</div>
      ) : rows.length === 0 ? (
        <div className="p-8 text-center text-slate-500 border border-slate-200 rounded-lg">
          No tariff rates {showExpired ? 'at all' : 'currently in effect'}. {showExpired ? '' : 'Toggle "Show expired" to see prior rates.'}
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([pair, list]) => (
            <div key={pair} className="bg-white rounded-lg shadow overflow-hidden">
              <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 text-sm font-semibold text-slate-700 font-mono">{pair}</div>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-slate-600">Rate %</th>
                    <th className="text-left px-4 py-2 font-medium text-slate-600">Effective from</th>
                    <th className="text-left px-4 py-2 font-medium text-slate-600">Effective until</th>
                    <th className="text-left px-4 py-2 font-medium text-slate-600">Brand</th>
                    <th className="text-left px-4 py-2 font-medium text-slate-600">Source</th>
                    <th className="text-right px-4 py-2 font-medium text-slate-600"> </th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((r) => editing === r.id && draft ? (
                    <tr key={r.id}>
                      <td colSpan={6} className="p-0">
                        <DraftRow draft={draft} fieldDraft={fieldDraft} onSave={saveDraft} onCancel={cancelDraft} label="Edit rate" />
                      </td>
                    </tr>
                  ) : (
                    <tr key={r.id} className="border-b border-slate-100">
                      <td className="px-4 py-3 font-mono font-semibold text-slate-900">{Number(r.ratePercent).toFixed(4)}%</td>
                      <td className="px-4 py-3 text-slate-700">{r.effectiveFrom}</td>
                      <td className="px-4 py-3"><ExpiryBadge effectiveUntil={r.effectiveUntil} /> <span className="text-slate-600 ml-2">{r.effectiveUntil}</span></td>
                      <td className="px-4 py-3 text-slate-600">{r.brandCode || <span className="text-slate-400">all</span>}</td>
                      <td className="px-4 py-3 text-xs text-slate-500 max-w-md truncate" title={r.sourceNote || ''}>{r.sourceNote || <span className="text-slate-300">—</span>}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex gap-2">
                          <button onClick={() => startEdit(r)} className="p-1.5 hover:bg-slate-200 rounded"><Pencil className="w-4 h-4 text-slate-600" /></button>
                          <button onClick={() => handleDelete(r)} className="p-1.5 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-600" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DraftRow({ draft, fieldDraft, onSave, onCancel, label }) {
  return (
    <div className="bg-emerald-50/30 border border-emerald-200 rounded-lg p-4">
      <p className="text-xs font-semibold text-emerald-900 mb-3 uppercase tracking-wide">{label}</p>
      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-1">
          <label className="block text-xs text-slate-600 mb-1">Origin</label>
          <input value={draft.originCountry} onChange={(e) => fieldDraft('originCountry')({ target: { value: e.target.value.toUpperCase() } })} maxLength={2} placeholder="CN" className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm font-mono uppercase" />
        </div>
        <div className="col-span-1">
          <label className="block text-xs text-slate-600 mb-1">Dest</label>
          <input value={draft.destinationCountry} onChange={(e) => fieldDraft('destinationCountry')({ target: { value: e.target.value.toUpperCase() } })} maxLength={2} placeholder="US" className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm font-mono uppercase" />
        </div>
        <div className="col-span-2">
          <label className="block text-xs text-slate-600 mb-1">Rate %</label>
          <input type="number" step="0.0001" value={draft.ratePercent} onChange={fieldDraft('ratePercent')} placeholder="40.7714" className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
        </div>
        <div className="col-span-2">
          <label className="block text-xs text-slate-600 mb-1">Effective from</label>
          <input type="date" value={draft.effectiveFrom} onChange={fieldDraft('effectiveFrom')} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
        </div>
        <div className="col-span-2">
          <label className="block text-xs text-slate-600 mb-1">Effective until</label>
          <input type="date" value={draft.effectiveUntil} onChange={fieldDraft('effectiveUntil')} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
        </div>
        <div className="col-span-1">
          <label className="block text-xs text-slate-600 mb-1">Brand</label>
          <select value={draft.brandCode || ''} onChange={fieldDraft('brandCode')} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm bg-white">
            <option value="">all</option>
            <option value="SH">SH</option>
            <option value="FW">FW</option>
          </select>
        </div>
        <div className="col-span-3">
          <label className="block text-xs text-slate-600 mb-1">Source note</label>
          <input value={draft.sourceNote} onChange={fieldDraft('sourceNote')} placeholder="e.g. HanHua factory note May 14, 2026" className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" spellCheck="true" />
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-3">
        <button onClick={onCancel} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded inline-flex items-center gap-1"><X size={14} /> Cancel</button>
        <button onClick={onSave} className="px-4 py-1.5 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700 inline-flex items-center gap-1"><Check size={14} /> Save</button>
      </div>
    </div>
  );
}
