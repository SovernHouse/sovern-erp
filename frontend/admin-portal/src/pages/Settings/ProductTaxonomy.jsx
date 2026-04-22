import React, { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import {
  ChevronDown, ChevronRight, Plus, Pencil, Trash2, Check, X,
  Download, Upload, RotateCcw, Save, AlertCircle, CheckCircle,
  Layers, ChevronUp,
} from 'lucide-react';

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ message, type, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3500);
    return () => clearTimeout(t);
  }, [onDismiss]);
  const base = 'fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium max-w-sm';
  const styles = type === 'success'
    ? `${base} bg-emerald-50 border border-emerald-200 text-emerald-800`
    : `${base} bg-red-50 border border-red-200 text-red-800`;
  return (
    <div className={styles}>
      {type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
      {message}
    </div>
  );
}

// ─── Inline sub-category add row ──────────────────────────────────────────────
function AddChildRow({ parentId, onSaved, onCancel }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await api.post('/products/categories', { name: name.trim(), parentId });
      onSaved(res.data.data);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create sub-category');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2 pl-8 py-1.5">
      <input
        ref={inputRef}
        className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
        placeholder="Sub-category name…"
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onCancel(); }}
      />
      <button
        onClick={handleSave}
        disabled={saving || !name.trim()}
        className="px-3 py-1.5 bg-slate-900 text-white text-xs rounded-lg disabled:opacity-40 hover:bg-slate-700"
      >
        {saving ? '…' : 'Save'}
      </button>
      <button onClick={onCancel} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100">
        <X size={14} />
      </button>
    </div>
  );
}

// ─── Inline edit field ────────────────────────────────────────────────────────
function InlineEdit({ value, onSave, onCancel }) {
  const [text, setText] = useState(value);
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select(); }, []);
  return (
    <div className="flex items-center gap-2 flex-1">
      <input
        ref={inputRef}
        className="flex-1 border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') onSave(text.trim()); if (e.key === 'Escape') onCancel(); }}
      />
      <button onClick={() => onSave(text.trim())} className="p-1 text-emerald-600 hover:text-emerald-800"><Check size={14} /></button>
      <button onClick={onCancel} className="p-1 text-slate-400 hover:text-slate-600"><X size={14} /></button>
    </div>
  );
}

// ─── Sub-category row ─────────────────────────────────────────────────────────
function SubCategoryRow({ child, onUpdate, onDelete, onMoveUp, onMoveDown, isFirst, isLast }) {
  const [editing, setEditing] = useState(false);

  const handleSave = async (newName) => {
    if (!newName) return;
    try {
      const res = await api.put(`/products/categories/${child.id}`, { name: newName });
      onUpdate(res.data.data);
      setEditing(false);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${child.name}"?`)) return;
    try {
      await api.delete(`/products/categories/${child.id}`);
      onDelete(child.id);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete');
    }
  };

  return (
    <div className="flex items-center gap-2 pl-8 py-1.5 group hover:bg-slate-50 rounded-lg">
      <span className="text-slate-300 text-xs mr-1">└</span>
      {editing ? (
        <InlineEdit value={child.name} onSave={handleSave} onCancel={() => setEditing(false)} />
      ) : (
        <>
          <span className="flex-1 text-sm text-slate-700">{child.name}</span>
          <div className="hidden group-hover:flex items-center gap-1">
            <button
              onClick={onMoveUp} disabled={isFirst}
              className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 rounded hover:bg-slate-200"
            ><ChevronUp size={13} /></button>
            <button
              onClick={onMoveDown} disabled={isLast}
              className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 rounded hover:bg-slate-200"
            ><ChevronDown size={13} /></button>
            <button
              onClick={() => setEditing(true)}
              className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-200"
            ><Pencil size={13} /></button>
            <button
              onClick={handleDelete}
              className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50"
            ><Trash2 size={13} /></button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Parent category card ─────────────────────────────────────────────────────
function ParentCard({ category, onUpdate, onDelete, onMoveUp, onMoveDown, isFirst, isLast }) {
  const [expanded, setExpanded] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [editingIcon, setEditingIcon] = useState(false);
  const [children, setChildren] = useState(category.children || []);
  const [addingChild, setAddingChild] = useState(false);
  const [iconVal, setIconVal] = useState(category.icon || '');

  const handleNameSave = async (newName) => {
    if (!newName) return;
    try {
      const res = await api.put(`/products/categories/${category.id}`, { name: newName });
      onUpdate({ ...category, ...res.data.data, children });
      setEditingName(false);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update');
    }
  };

  const handleIconSave = async () => {
    try {
      await api.put(`/products/categories/${category.id}`, { icon: iconVal });
      onUpdate({ ...category, icon: iconVal, children });
      setEditingIcon(false);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update icon');
    }
  };

  const handleDelete = async () => {
    const msg = children.length > 0
      ? `Delete "${category.name}" and its ${children.length} sub-categor${children.length === 1 ? 'y' : 'ies'}?`
      : `Delete "${category.name}"?`;
    if (!window.confirm(msg)) return;
    try {
      await api.delete(`/products/categories/${category.id}`);
      onDelete(category.id);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete');
    }
  };

  const handleChildAdded = (newChild) => {
    setChildren(prev => [...prev, newChild]);
    setAddingChild(false);
  };

  const handleChildUpdate = (updated) => {
    setChildren(prev => prev.map(c => c.id === updated.id ? updated : c));
  };

  const handleChildDelete = (deletedId) => {
    setChildren(prev => prev.filter(c => c.id !== deletedId));
  };

  const moveChild = async (index, direction) => {
    const newChildren = [...children];
    const swapIndex = index + direction;
    if (swapIndex < 0 || swapIndex >= newChildren.length) return;
    // Swap sortOrders
    const a = newChildren[index];
    const b = newChildren[swapIndex];
    newChildren[index] = { ...b, sortOrder: a.sortOrder };
    newChildren[swapIndex] = { ...a, sortOrder: b.sortOrder };
    setChildren(newChildren);
    // Persist
    await api.put(`/products/categories/${a.id}`, { sortOrder: b.sortOrder });
    await api.put(`/products/categories/${b.id}`, { sortOrder: a.sortOrder });
  };

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      {/* Parent header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-white hover:bg-slate-50 group">
        <button onClick={() => setExpanded(e => !e)} className="text-slate-400 hover:text-slate-700 flex-shrink-0">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>

        {/* Icon */}
        {editingIcon ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              className="w-14 border border-slate-300 rounded px-2 py-0.5 text-center text-base"
              value={iconVal}
              onChange={e => setIconVal(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleIconSave(); if (e.key === 'Escape') setEditingIcon(false); }}
            />
            <button onClick={handleIconSave} className="p-1 text-emerald-600"><Check size={12} /></button>
            <button onClick={() => setEditingIcon(false)} className="p-1 text-slate-400"><X size={12} /></button>
          </div>
        ) : (
          <button
            onClick={() => setEditingIcon(true)}
            className="text-lg w-8 text-center hover:bg-slate-100 rounded"
            title="Click to change icon"
          >
            {category.icon || '📦'}
          </button>
        )}

        {/* Name */}
        {editingName ? (
          <InlineEdit value={category.name} onSave={handleNameSave} onCancel={() => setEditingName(false)} />
        ) : (
          <>
            <span className="flex-1 font-semibold text-slate-900">{category.name}</span>
            <span className="text-xs text-slate-400 mr-2">{children.length} sub-categories</span>
          </>
        )}

        {/* Actions */}
        {!editingName && !editingIcon && (
          <div className="hidden group-hover:flex items-center gap-1">
            <button onClick={onMoveUp} disabled={isFirst} className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-20 rounded hover:bg-slate-100"><ChevronUp size={14} /></button>
            <button onClick={onMoveDown} disabled={isLast} className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-20 rounded hover:bg-slate-100"><ChevronDown size={14} /></button>
            <button onClick={() => setEditingName(true)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100"><Pencil size={14} /></button>
            <button onClick={() => { setAddingChild(true); setExpanded(true); }} className="p-1.5 text-slate-400 hover:text-emerald-600 rounded hover:bg-emerald-50" title="Add sub-category"><Plus size={14} /></button>
            <button onClick={handleDelete} className="p-1.5 text-slate-400 hover:text-red-600 rounded hover:bg-red-50"><Trash2 size={14} /></button>
          </div>
        )}
      </div>

      {/* Children */}
      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/50 py-1 px-2">
          {children.length === 0 && !addingChild && (
            <p className="pl-8 py-2 text-xs text-slate-400 italic">No sub-categories yet</p>
          )}
          {children.map((child, i) => (
            <SubCategoryRow
              key={child.id}
              child={child}
              onUpdate={handleChildUpdate}
              onDelete={handleChildDelete}
              onMoveUp={() => moveChild(i, -1)}
              onMoveDown={() => moveChild(i, 1)}
              isFirst={i === 0}
              isLast={i === children.length - 1}
            />
          ))}
          {addingChild && (
            <AddChildRow
              parentId={category.id}
              onSaved={handleChildAdded}
              onCancel={() => setAddingChild(false)}
            />
          )}
          {!addingChild && (
            <button
              onClick={() => setAddingChild(true)}
              className="pl-8 py-1.5 text-xs text-slate-400 hover:text-slate-700 flex items-center gap-1 w-full hover:bg-slate-100 rounded-lg"
            >
              <Plus size={12} /> Add sub-category
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ProductTaxonomy() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [addingParent, setAddingParent] = useState(false);
  const [newParentName, setNewParentName] = useState('');
  const [newParentIcon, setNewParentIcon] = useState('');
  const [savingParent, setSavingParent] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  const showToast = (message, type = 'success') => setToast({ message, type });

  const loadTree = async () => {
    try {
      const res = await api.get('/products/categories/tree');
      setCategories(res.data || []);
    } catch (err) {
      showToast('Failed to load categories', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTree(); }, []);

  // ── Add parent category ──
  const handleAddParent = async () => {
    if (!newParentName.trim()) return;
    setSavingParent(true);
    try {
      const sortOrder = categories.length + 1;
      const res = await api.post('/products/categories', {
        name: newParentName.trim(),
        icon: newParentIcon.trim() || null,
        sortOrder,
        parentId: null,
      });
      setCategories(prev => [...prev, { ...res.data.data, children: [] }]);
      setNewParentName('');
      setNewParentIcon('');
      setAddingParent(false);
      showToast(`"${res.data.data.name}" category created`);
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to create category', 'error');
    } finally {
      setSavingParent(false);
    }
  };

  const handleUpdate = (updated) => {
    setCategories(prev => prev.map(c => c.id === updated.id ? { ...updated, children: updated.children || c.children } : c));
  };

  const handleDelete = (deletedId) => {
    setCategories(prev => prev.filter(c => c.id !== deletedId));
    showToast('Category deleted');
  };

  const moveParent = async (index, direction) => {
    const swapIndex = index + direction;
    if (swapIndex < 0 || swapIndex >= categories.length) return;
    const newCats = [...categories];
    const a = newCats[index];
    const b = newCats[swapIndex];
    newCats[index] = { ...b, sortOrder: a.sortOrder, children: b.children };
    newCats[swapIndex] = { ...a, sortOrder: b.sortOrder, children: a.children };
    setCategories(newCats);
    await api.put(`/products/categories/${a.id}`, { sortOrder: b.sortOrder });
    await api.put(`/products/categories/${b.id}`, { sortOrder: a.sortOrder });
  };

  // ── Seed Sovern House defaults ──
  const handleSeed = async (overwrite = false) => {
    if (overwrite && !window.confirm('This will delete all existing categories and replace with the Sovern House defaults. Continue?')) return;
    setSeeding(true);
    try {
      const res = await api.post('/products/categories/seed', { overwrite });
      showToast(`Seeded ${res.data.created} categories (${res.data.skipped} skipped)`);
      await loadTree();
    } catch (err) {
      showToast(err.response?.data?.message || 'Seed failed', 'error');
    } finally {
      setSeeding(false);
    }
  };

  // ── Export JSON ──
  const handleExport = async () => {
    try {
      const res = await api.get('/products/categories/export');
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'product-taxonomy.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      showToast('Export failed', 'error');
    }
  };

  // ── Import JSON ──
  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const overwrite = window.confirm('Replace existing categories with the imported taxonomy? Click Cancel to merge (add only).');
      const res = await api.post('/products/categories/import', { categories: parsed, overwrite });
      showToast(`Imported ${res.data.created} categories`);
      await loadTree();
    } catch (err) {
      showToast(err.response?.data?.message || 'Import failed — check JSON format', 'error');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  // ─── Empty state ───────────────────────────────────────────────────────────
  if (!loading && categories.length === 0) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Layers size={22} /> Product Taxonomy
          </h1>
          <p className="text-slate-500 mt-1 text-sm">Manage your product categories and sub-categories.</p>
        </div>
        <div className="border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center">
          <div className="text-5xl mb-4">📦</div>
          <h3 className="text-lg font-semibold text-slate-700 mb-2">No product categories yet</h3>
          <p className="text-slate-400 text-sm mb-6">Get started by loading the Sovern House template or creating your own.</p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => handleSeed(false)}
              disabled={seeding}
              className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-700 disabled:opacity-50"
            >
              {seeding ? 'Loading…' : '🏠 Load Sovern House Template'}
            </button>
            <button
              onClick={() => setAddingParent(true)}
              className="px-5 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50"
            >
              + Create Category
            </button>
          </div>
        </div>
        {toast && <Toast {...toast} onDismiss={() => setToast(null)} />}
      </div>
    );
  }

  // ─── Main view ─────────────────────────────────────────────────────────────
  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Layers size={22} /> Product Taxonomy
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            {categories.length} parent categories · {categories.reduce((n, c) => n + (c.children?.length || 0), 0)} sub-categories
          </p>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-50"
            title="Export taxonomy as JSON"
          >
            <Download size={13} /> Export
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
            title="Import taxonomy from JSON"
          >
            <Upload size={13} /> {importing ? 'Importing…' : 'Import'}
          </button>
          <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />
          <button
            onClick={() => {
              const hasCats = categories.length > 0;
              if (hasCats) {
                const choice = window.confirm('Replace all categories with Sovern House defaults?\n\nOK = Replace all\nCancel = Skip existing (add missing only)');
                handleSeed(choice);
              } else {
                handleSeed(false);
              }
            }}
            disabled={seeding}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
            title="Load Sovern House default taxonomy"
          >
            <RotateCcw size={13} /> {seeding ? 'Loading…' : 'Sovern Defaults'}
          </button>
          <button
            onClick={() => setAddingParent(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-medium hover:bg-slate-700"
          >
            <Plus size={13} /> Add Category
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {categories.map((cat, i) => (
            <ParentCard
              key={cat.id}
              category={cat}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onMoveUp={() => moveParent(i, -1)}
              onMoveDown={() => moveParent(i, 1)}
              isFirst={i === 0}
              isLast={i === categories.length - 1}
            />
          ))}

          {/* Add parent form */}
          {addingParent ? (
            <div className="border border-slate-300 rounded-xl p-4 bg-white">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">New Parent Category</h3>
              <div className="flex items-center gap-3">
                <input
                  className="w-14 border border-slate-200 rounded-lg px-2 py-2 text-center text-xl focus:outline-none focus:ring-2 focus:ring-slate-400"
                  placeholder="📦"
                  value={newParentIcon}
                  onChange={e => setNewParentIcon(e.target.value)}
                  maxLength={2}
                />
                <input
                  autoFocus
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                  placeholder="Category name (e.g. Flooring)"
                  value={newParentName}
                  onChange={e => setNewParentName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddParent(); if (e.key === 'Escape') setAddingParent(false); }}
                />
                <button
                  onClick={handleAddParent}
                  disabled={savingParent || !newParentName.trim()}
                  className="px-4 py-2 bg-slate-900 text-white text-sm rounded-lg disabled:opacity-40 hover:bg-slate-700"
                >
                  {savingParent ? '…' : 'Create'}
                </button>
                <button
                  onClick={() => { setAddingParent(false); setNewParentName(''); setNewParentIcon(''); }}
                  className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {toast && <Toast {...toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}
