// ─── Product Taxonomy Screen (Phase 4.20 — mobile parity) ──────────────────
// Mirrors desktop Settings/ProductTaxonomy.jsx scope: view tree, add parent,
// add sub-category at any depth, inline-edit name, delete, archive/restore,
// toggle "show archived". Skipped vs desktop: drag reorder, seed-defaults,
// JSON import/export (heavy on mobile).
//
// Phase 4.20.1: tree is recursive — clicking a sub-category reveals its
// children, which can in turn be expanded.
//
// Linked from app/(tabs)/settings.tsx via NavRow → router.push('/product-taxonomy').

import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert,
} from 'react-native';
import { useNavigation } from 'expo-router';
import {
  getCategoryTree, createCategory, updateCategory,
  deleteCategoryNode, archiveCategoryNode, restoreCategoryNode,
  type ProductCategoryNode,
} from '../src/services/api';
import { COLORS } from '../src/constants/config';

export default function ProductTaxonomyScreen() {
  const navigation = useNavigation();
  const [tree, setTree] = useState<ProductCategoryNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [addingParent, setAddingParent] = useState(false);
  const [newParentName, setNewParentName] = useState('');

  useEffect(() => {
    navigation.setOptions({ title: 'Product Taxonomy' });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getCategoryTree(showArchived);
      setTree(data || []);
    } catch (err: any) {
      Alert.alert('Load failed', err?.message || 'Could not load taxonomy');
    } finally {
      setLoading(false);
    }
  }, [showArchived]);

  useEffect(() => { load(); }, [load]);

  const handleAddParent = async () => {
    const name = newParentName.trim();
    if (!name) return;
    try {
      await createCategory({ name, parentId: null, sortOrder: tree.length + 1 });
      setNewParentName('');
      setAddingParent(false);
      await load();
    } catch (err: any) {
      Alert.alert('Save failed', err?.message || 'Could not create category');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.forest} />
      </View>
    );
  }

  const totalDescendants = (n: ProductCategoryNode): number =>
    (n.children?.length || 0) + (n.children || []).reduce((s, c) => s + totalDescendants(c), 0);
  const subCount = tree.reduce((n, c) => n + totalDescendants(c), 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.headerBlock}>
        <Text style={styles.h1}>Product Taxonomy</Text>
        <Text style={styles.subtitle}>
          {tree.length} parent {tree.length === 1 ? 'category' : 'categories'} ·{' '}
          {subCount} nested sub-categor{subCount === 1 ? 'y' : 'ies'}
        </Text>
      </View>

      <View style={styles.toolbar}>
        <TouchableOpacity
          style={[styles.toggleBtn, showArchived && styles.toggleBtnActive]}
          onPress={() => setShowArchived(v => !v)}
        >
          <Text style={[styles.toggleBtnText, showArchived && styles.toggleBtnTextActive]}>
            {showArchived ? 'Hiding archived ✓' : 'Show archived'}
          </Text>
        </TouchableOpacity>
      </View>

      {tree.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>📦</Text>
          <Text style={styles.emptyTitle}>No categories yet</Text>
          <Text style={styles.emptySubtitle}>
            Add your first parent category below. For the full Sovern House template, use desktop.
          </Text>
        </View>
      ) : (
        <View style={styles.treeBlock}>
          {tree.map(parent => (
            <CategoryNode key={parent.id} node={parent} depth={0} onChanged={load} />
          ))}
        </View>
      )}

      {addingParent ? (
        <View style={styles.addRow}>
          <TextInput
            style={styles.input}
            value={newParentName}
            onChangeText={setNewParentName}
            placeholder="Parent category name…"
            autoFocus
            onSubmitEditing={handleAddParent}
            returnKeyType="done"
          />
          <TouchableOpacity onPress={handleAddParent} style={styles.saveBtn}>
            <Text style={styles.saveBtnText}>Save</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setAddingParent(false); setNewParentName(''); }} style={styles.cancelBtn}>
            <Text style={styles.cancelBtnText}>✕</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.addParentBtn} onPress={() => setAddingParent(true)}>
          <Text style={styles.addParentBtnText}>＋ Add parent category</Text>
        </TouchableOpacity>
      )}

      <View style={styles.footnote}>
        <Text style={styles.footnoteText}>
          JSON import/export, reorder, and seed-defaults live on the desktop ERP. Use{' '}
          <Text style={styles.footnoteCode}>/settings/product-taxonomy</Text> in Brave Browser.
        </Text>
      </View>
    </ScrollView>
  );
}

// ─── Recursive category node ──────────────────────────────────────────────
// Depth 0 = root (parent card), depth >=1 = sub-category row. Each node owns
// its expand/edit/add-child state and reloads via onChanged when the tree
// shape changes server-side.

function CategoryNode({ node, depth, onChanged }: {
  node: ProductCategoryNode;
  depth: number;
  onChanged: () => Promise<void> | void;
}) {
  const children = Array.isArray(node.children) ? node.children : [];
  const hasChildren = children.length > 0;
  const isArchived = !!node.isArchived;
  const isRoot = depth === 0;

  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(node.name);
  const [addingChild, setAddingChild] = useState(false);
  const [childName, setChildName] = useState('');

  const saveRename = async () => {
    const t = editName.trim();
    if (!t) { setEditing(false); return; }
    try {
      await updateCategory(node.id, { name: t });
      setEditing(false);
      await onChanged();
    } catch (err: any) {
      Alert.alert('Save failed', err?.message || 'Could not rename');
    }
  };

  const saveAddChild = async () => {
    const t = childName.trim();
    if (!t) return;
    try {
      await createCategory({ name: t, parentId: node.id });
      setChildName('');
      setAddingChild(false);
      await onChanged();
    } catch (err: any) {
      Alert.alert('Save failed', err?.message || 'Could not create sub-category');
    }
  };

  const confirmDelete = () => {
    const msg = hasChildren
      ? `Delete "${node.name}" and its ${children.length} nested sub-categor${children.length === 1 ? 'y' : 'ies'}?`
      : `Delete "${node.name}"?`;
    Alert.alert(msg, 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteCategoryNode(node.id);
            await onChanged();
          } catch (err: any) {
            Alert.alert('Delete failed', err?.message || 'Could not delete');
          }
        },
      },
    ]);
  };

  const toggleArchive = async () => {
    try {
      if (isArchived) await restoreCategoryNode(node.id);
      else await archiveCategoryNode(node.id);
      await onChanged();
    } catch (err: any) {
      Alert.alert('Failed', err?.message || (isArchived ? 'Could not restore' : 'Could not archive'));
    }
  };

  // Root cards are full panels; deeper levels are rows with progressive indent.
  const rowPad = { paddingLeft: 12 + depth * 14 };

  if (isRoot) {
    return (
      <View style={[styles.parentBlock, isArchived && styles.archivedBlock]}>
        <CategoryRowHeader
          node={node}
          editing={editing}
          editName={editName}
          setEditName={setEditName}
          onSaveRename={saveRename}
          onCancelRename={() => { setEditing(false); setEditName(node.name); }}
          onStartEdit={() => setEditing(true)}
          onToggleExpand={() => hasChildren && setExpanded(e => !e)}
          onAddChild={() => { setAddingChild(true); setExpanded(true); }}
          onToggleArchive={toggleArchive}
          onDelete={confirmDelete}
          expanded={expanded}
          hasChildren={hasChildren}
          isArchived={isArchived}
          depth={0}
          showChildCount={children.length}
          rowPad={{ paddingLeft: 12 }}
          isRoot
        />

        {expanded && (children.length > 0 || addingChild) && (
          <View style={styles.childrenBlock}>
            {children.map(grand => (
              <CategoryNode key={grand.id} node={grand} depth={depth + 1} onChanged={onChanged} />
            ))}
            {addingChild && (
              <AddChildInline
                value={childName}
                setValue={setChildName}
                onSave={saveAddChild}
                onCancel={() => { setAddingChild(false); setChildName(''); }}
                rowPad={{ paddingLeft: 12 + (depth + 1) * 14 }}
              />
            )}
          </View>
        )}
      </View>
    );
  }

  return (
    <View>
      <CategoryRowHeader
        node={node}
        editing={editing}
        editName={editName}
        setEditName={setEditName}
        onSaveRename={saveRename}
        onCancelRename={() => { setEditing(false); setEditName(node.name); }}
        onStartEdit={() => setEditing(true)}
        onToggleExpand={() => hasChildren && setExpanded(e => !e)}
        onAddChild={() => { setAddingChild(true); setExpanded(true); }}
        onToggleArchive={toggleArchive}
        onDelete={confirmDelete}
        expanded={expanded}
        hasChildren={hasChildren}
        isArchived={isArchived}
        depth={depth}
        showChildCount={children.length}
        rowPad={rowPad}
      />

      {expanded && hasChildren && (
        <View>
          {children.map(grand => (
            <CategoryNode key={grand.id} node={grand} depth={depth + 1} onChanged={onChanged} />
          ))}
        </View>
      )}

      {expanded && addingChild && (
        <AddChildInline
          value={childName}
          setValue={setChildName}
          onSave={saveAddChild}
          onCancel={() => { setAddingChild(false); setChildName(''); }}
          rowPad={{ paddingLeft: 12 + (depth + 1) * 14 }}
        />
      )}
    </View>
  );
}

function CategoryRowHeader({
  node, editing, editName, setEditName, onSaveRename, onCancelRename,
  onStartEdit, onToggleExpand, onAddChild, onToggleArchive, onDelete,
  expanded, hasChildren, isArchived, depth, showChildCount, rowPad, isRoot,
}: any) {
  return (
    <View style={[styles.row, isRoot && styles.rootRow, rowPad]}>
      <TouchableOpacity onPress={onToggleExpand} style={styles.expandBtn} disabled={!hasChildren}>
        <Text style={[styles.expandChev, !hasChildren && styles.expandChevMuted]}>
          {hasChildren ? (expanded ? '▾' : '▸') : '·'}
        </Text>
      </TouchableOpacity>

      {isRoot && node.icon ? <Text style={styles.parentIcon}>{node.icon}</Text> : null}

      {editing ? (
        <>
          <TextInput
            style={styles.editInput}
            value={editName}
            onChangeText={setEditName}
            autoFocus
            onSubmitEditing={onSaveRename}
            returnKeyType="done"
          />
          <TouchableOpacity onPress={onSaveRename} style={styles.iconBtn}>
            <Text style={styles.iconBtnTextOk}>✓</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onCancelRename} style={styles.iconBtn}>
            <Text style={styles.iconBtnTextMuted}>✕</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <View style={styles.nameBlock}>
            <Text
              style={[isRoot ? styles.parentName : styles.childName, isArchived && styles.archivedText]}
              numberOfLines={1}
            >
              {node.name}
            </Text>
            {isArchived ? <Text style={styles.archivedPill}>archived</Text> : null}
            {showChildCount > 0 ? <Text style={styles.childCount}>{showChildCount}</Text> : null}
          </View>
          <View style={styles.actionRow}>
            <TouchableOpacity onPress={onStartEdit} style={styles.iconBtn}>
              <Text style={styles.iconBtnTextMuted}>✎</Text>
            </TouchableOpacity>
            {!isArchived && (
              <TouchableOpacity onPress={onAddChild} style={styles.iconBtn}>
                <Text style={styles.iconBtnTextAdd}>＋</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onToggleArchive} style={styles.iconBtn}>
              <Text style={isArchived ? styles.iconBtnTextOk : styles.iconBtnTextMuted}>
                {isArchived ? '↺' : '⊘'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onDelete} style={styles.iconBtn}>
              <Text style={styles.iconBtnTextDanger}>🗑</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

function AddChildInline({ value, setValue, onSave, onCancel, rowPad }: any) {
  return (
    <View style={[styles.row, rowPad]}>
      <Text style={styles.expandChev}>＋</Text>
      <TextInput
        style={styles.editInput}
        value={value}
        onChangeText={setValue}
        placeholder="Sub-category name…"
        autoFocus
        onSubmitEditing={onSave}
        returnKeyType="done"
      />
      <TouchableOpacity onPress={onSave} style={styles.iconBtn}>
        <Text style={styles.iconBtnTextOk}>✓</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onCancel} style={styles.iconBtn}>
        <Text style={styles.iconBtnTextMuted}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  contentContainer: { padding: 16, paddingBottom: 48 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.cream },

  headerBlock: { marginBottom: 12 },
  h1: { fontSize: 22, fontWeight: '800', color: COLORS.ink },
  subtitle: { fontSize: 13, color: COLORS.muted, marginTop: 2 },

  toolbar: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  toggleBtn: {
    paddingVertical: 8, paddingHorizontal: 14,
    borderRadius: 18, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  toggleBtnActive: { borderColor: COLORS.forest, backgroundColor: '#EFF6EE' },
  toggleBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.ink },
  toggleBtnTextActive: { color: COLORS.forest },

  emptyState: { padding: 32, alignItems: 'center', backgroundColor: COLORS.white, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  emptyEmoji: { fontSize: 40, marginBottom: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.ink, marginBottom: 4 },
  emptySubtitle: { fontSize: 13, color: COLORS.muted, textAlign: 'center', lineHeight: 18 },

  treeBlock: { gap: 8, marginBottom: 12 },
  parentBlock: { backgroundColor: COLORS.white, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  archivedBlock: { backgroundColor: '#F5F5F4', borderColor: '#D6D3D1' },

  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingRight: 8, gap: 6 },
  rootRow: { paddingVertical: 12 },
  expandBtn: { width: 22, alignItems: 'center' },
  expandChev: { fontSize: 14, color: COLORS.muted, fontWeight: '700' },
  expandChevMuted: { color: '#CBD5E1' },
  parentIcon: { fontSize: 18 },

  nameBlock: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  parentName: { fontSize: 15, fontWeight: '700', color: COLORS.ink, flexShrink: 1 },
  childName: { fontSize: 14, color: COLORS.ink, flexShrink: 1 },
  archivedText: { color: '#9CA3AF', textDecorationLine: 'line-through' },
  archivedPill: {
    fontSize: 10, fontWeight: '700', color: '#92400E',
    backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 9, overflow: 'hidden',
  },
  childCount: {
    fontSize: 11, fontWeight: '700', color: COLORS.muted,
    backgroundColor: '#F5F0E8', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 9, overflow: 'hidden',
  },

  actionRow: { flexDirection: 'row', gap: 2 },
  iconBtn: { padding: 6, minWidth: 28, alignItems: 'center' },
  iconBtnTextMuted: { fontSize: 15, color: COLORS.muted },
  iconBtnTextAdd: { fontSize: 18, color: COLORS.forest, fontWeight: '700', lineHeight: 18 },
  iconBtnTextOk: { fontSize: 16, color: COLORS.success, fontWeight: '700' },
  iconBtnTextDanger: { fontSize: 15, color: COLORS.error },

  childrenBlock: { paddingTop: 2, paddingBottom: 6, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: '#FAFAF7' },

  addParentBtn: {
    backgroundColor: COLORS.white, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border,
    paddingVertical: 16, alignItems: 'center',
  },
  addParentBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.forest },

  addRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.white, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  input: { flex: 1, fontSize: 14, color: COLORS.ink, paddingVertical: 6 },
  editInput: {
    flex: 1, fontSize: 14, color: COLORS.ink,
    paddingVertical: 4, paddingHorizontal: 6,
    backgroundColor: COLORS.white, borderRadius: 6, borderWidth: 1, borderColor: COLORS.border,
  },
  saveBtn: { paddingVertical: 6, paddingHorizontal: 14, backgroundColor: COLORS.ink, borderRadius: 8 },
  saveBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 13 },
  cancelBtn: { paddingVertical: 6, paddingHorizontal: 10 },
  cancelBtnText: { color: COLORS.muted, fontSize: 18 },

  footnote: { marginTop: 24, paddingHorizontal: 4 },
  footnoteText: { fontSize: 11, color: COLORS.muted, lineHeight: 16 },
  footnoteCode: { fontFamily: 'Courier', color: COLORS.ink },
});
