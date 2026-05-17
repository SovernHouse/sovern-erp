// ─── Product Taxonomy Screen (Phase 4.20 — mobile parity) ──────────────────
// Mirrors desktop Settings/ProductTaxonomy.jsx scope: view tree, add parent,
// add sub-category, inline-edit name, delete, archive/restore, toggle
// "show archived". Skipped vs desktop: drag reorder (uses up/down here),
// seed-defaults, JSON import/export (desktop-only, niche on mobile).
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
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [addingParent, setAddingParent] = useState(false);
  const [newParentName, setNewParentName] = useState('');
  const [addingChildFor, setAddingChildFor] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);

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

  const toggleExpanded = (id: string) =>
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

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

  const handleAddChild = async (parentId: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await createCategory({ name: trimmed, parentId });
      setAddingChildFor(null);
      setExpanded(prev => ({ ...prev, [parentId]: true }));
      await load();
    } catch (err: any) {
      Alert.alert('Save failed', err?.message || 'Could not create sub-category');
    }
  };

  const handleRename = async (id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) { setEditing(null); return; }
    try {
      await updateCategory(id, { name: trimmed });
      setEditing(null);
      await load();
    } catch (err: any) {
      Alert.alert('Save failed', err?.message || 'Could not rename');
    }
  };

  const confirmDelete = (id: string, name: string) => {
    Alert.alert(
      `Delete "${name}"?`,
      'This permanently removes the category. Sub-categories are deleted too.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCategoryNode(id);
              await load();
            } catch (err: any) {
              Alert.alert('Delete failed', err?.message || 'Could not delete');
            }
          },
        },
      ],
    );
  };

  const handleArchive = async (id: string, name: string) => {
    try {
      await archiveCategoryNode(id);
      await load();
    } catch (err: any) {
      Alert.alert('Archive failed', err?.message || `Could not archive "${name}"`);
    }
  };

  const handleRestore = async (id: string, name: string) => {
    try {
      await restoreCategoryNode(id);
      await load();
    } catch (err: any) {
      Alert.alert('Restore failed', err?.message || `Could not restore "${name}"`);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.forest} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.headerBlock}>
        <Text style={styles.h1}>Product Taxonomy</Text>
        <Text style={styles.subtitle}>
          {tree.length} parent {tree.length === 1 ? 'category' : 'categories'} ·{' '}
          {tree.reduce((n, c) => n + (c.children?.length || 0), 0)} sub-categories
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
            <ParentRow
              key={parent.id}
              parent={parent}
              isExpanded={!!expanded[parent.id]}
              isEditing={editing?.id === parent.id}
              isAddingChild={addingChildFor === parent.id}
              editingName={editing?.id === parent.id ? editing.name : ''}
              onToggleExpand={() => toggleExpanded(parent.id)}
              onStartEdit={() => setEditing({ id: parent.id, name: parent.name })}
              onChangeEditName={(t) => setEditing({ id: parent.id, name: t })}
              onSaveEdit={() => handleRename(parent.id, editing?.name || '')}
              onCancelEdit={() => setEditing(null)}
              onStartAddChild={() => {
                setAddingChildFor(parent.id);
                setExpanded(prev => ({ ...prev, [parent.id]: true }));
              }}
              onSaveChild={(name) => handleAddChild(parent.id, name)}
              onCancelAddChild={() => setAddingChildFor(null)}
              onDelete={() => confirmDelete(parent.id, parent.name)}
              onArchive={() => handleArchive(parent.id, parent.name)}
              onRestore={() => handleRestore(parent.id, parent.name)}
              onChildRename={(childId, name) => handleRename(childId, name)}
              onChildDelete={(childId, name) => confirmDelete(childId, name)}
              onChildArchive={(childId, name) => handleArchive(childId, name)}
              onChildRestore={(childId, name) => handleRestore(childId, name)}
              editingChildId={editing?.id !== parent.id ? editing?.id ?? null : null}
              editingChildName={editing?.id !== parent.id ? editing?.name ?? '' : ''}
              onChildStartEdit={(childId, name) => setEditing({ id: childId, name })}
              onChildChangeEditName={(t) => editing && setEditing({ ...editing, name: t })}
              onChildCancelEdit={() => setEditing(null)}
            />
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

// ─── Parent row + child rows ──────────────────────────────────────────────

type ParentRowProps = {
  parent: ProductCategoryNode;
  isExpanded: boolean;
  isEditing: boolean;
  isAddingChild: boolean;
  editingName: string;
  onToggleExpand: () => void;
  onStartEdit: () => void;
  onChangeEditName: (t: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onStartAddChild: () => void;
  onSaveChild: (name: string) => void;
  onCancelAddChild: () => void;
  onDelete: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onChildRename: (id: string, name: string) => void;
  onChildDelete: (id: string, name: string) => void;
  onChildArchive: (id: string, name: string) => void;
  onChildRestore: (id: string, name: string) => void;
  editingChildId: string | null;
  editingChildName: string;
  onChildStartEdit: (id: string, name: string) => void;
  onChildChangeEditName: (t: string) => void;
  onChildCancelEdit: () => void;
};

function ParentRow({
  parent, isExpanded, isEditing, isAddingChild, editingName,
  onToggleExpand, onStartEdit, onChangeEditName, onSaveEdit, onCancelEdit,
  onStartAddChild, onSaveChild, onCancelAddChild,
  onDelete, onArchive, onRestore,
  onChildDelete, onChildArchive, onChildRestore,
  editingChildId, editingChildName,
  onChildStartEdit, onChildChangeEditName, onChildCancelEdit,
}: ParentRowProps) {
  const [childInputName, setChildInputName] = useState('');
  const isArchived = !!parent.isArchived;
  const childCount = parent.children?.length || 0;

  return (
    <View style={[styles.parentBlock, isArchived && styles.archivedBlock]}>
      <View style={styles.parentRow}>
        <TouchableOpacity onPress={onToggleExpand} style={styles.expandBtn}>
          <Text style={styles.expandChev}>
            {childCount > 0 ? (isExpanded ? '▾' : '▸') : '·'}
          </Text>
        </TouchableOpacity>

        {parent.icon ? <Text style={styles.parentIcon}>{parent.icon}</Text> : null}

        {isEditing ? (
          <>
            <TextInput
              style={styles.editInput}
              value={editingName}
              onChangeText={onChangeEditName}
              autoFocus
              onSubmitEditing={onSaveEdit}
              returnKeyType="done"
            />
            <TouchableOpacity onPress={onSaveEdit} style={styles.iconBtn}>
              <Text style={styles.iconBtnTextOk}>✓</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onCancelEdit} style={styles.iconBtn}>
              <Text style={styles.iconBtnTextMuted}>✕</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.parentNameBlock}>
              <Text style={[styles.parentName, isArchived && styles.archivedText]} numberOfLines={1}>
                {parent.name}
              </Text>
              {isArchived ? <Text style={styles.archivedPill}>archived</Text> : null}
              {childCount > 0 ? <Text style={styles.childCount}>{childCount}</Text> : null}
            </View>
            <View style={styles.actionRow}>
              <TouchableOpacity onPress={onStartEdit} style={styles.iconBtn}>
                <Text style={styles.iconBtnTextMuted}>✎</Text>
              </TouchableOpacity>
              {isArchived ? (
                <TouchableOpacity onPress={onRestore} style={styles.iconBtn}>
                  <Text style={styles.iconBtnTextOk}>↺</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={onArchive} style={styles.iconBtn}>
                  <Text style={styles.iconBtnTextMuted}>⊘</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onDelete} style={styles.iconBtn}>
                <Text style={styles.iconBtnTextDanger}>🗑</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {isExpanded && (
        <View style={styles.childrenBlock}>
          {(parent.children || []).map(child => {
            const isChildEditing = editingChildId === child.id;
            const childArchived = !!child.isArchived;
            return (
              <View key={child.id} style={[styles.childRow, childArchived && styles.archivedRow]}>
                <Text style={styles.childBullet}>└</Text>
                {isChildEditing ? (
                  <>
                    <TextInput
                      style={styles.editInput}
                      value={editingChildName}
                      onChangeText={onChildChangeEditName}
                      autoFocus
                      onSubmitEditing={() => editingChildId && onChildRename(editingChildId, editingChildName)}
                      returnKeyType="done"
                    />
                    <TouchableOpacity
                      onPress={() => editingChildId && onChildRename(editingChildId, editingChildName)}
                      style={styles.iconBtn}
                    >
                      <Text style={styles.iconBtnTextOk}>✓</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={onChildCancelEdit} style={styles.iconBtn}>
                      <Text style={styles.iconBtnTextMuted}>✕</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <Text style={[styles.childName, childArchived && styles.archivedText]} numberOfLines={1}>
                      {child.name}
                    </Text>
                    {childArchived ? <Text style={styles.archivedPill}>archived</Text> : null}
                    <View style={styles.actionRow}>
                      <TouchableOpacity onPress={() => onChildStartEdit(child.id, child.name)} style={styles.iconBtn}>
                        <Text style={styles.iconBtnTextMuted}>✎</Text>
                      </TouchableOpacity>
                      {childArchived ? (
                        <TouchableOpacity onPress={() => onChildRestore(child.id, child.name)} style={styles.iconBtn}>
                          <Text style={styles.iconBtnTextOk}>↺</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity onPress={() => onChildArchive(child.id, child.name)} style={styles.iconBtn}>
                          <Text style={styles.iconBtnTextMuted}>⊘</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity onPress={() => onChildDelete(child.id, child.name)} style={styles.iconBtn}>
                        <Text style={styles.iconBtnTextDanger}>🗑</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            );
          })}

          {isAddingChild ? (
            <View style={styles.childRow}>
              <Text style={styles.childBullet}>└</Text>
              <TextInput
                style={styles.editInput}
                value={childInputName}
                onChangeText={setChildInputName}
                placeholder="Sub-category name…"
                autoFocus
                onSubmitEditing={() => { onSaveChild(childInputName); setChildInputName(''); }}
                returnKeyType="done"
              />
              <TouchableOpacity
                onPress={() => { onSaveChild(childInputName); setChildInputName(''); }}
                style={styles.iconBtn}
              >
                <Text style={styles.iconBtnTextOk}>✓</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { onCancelAddChild(); setChildInputName(''); }} style={styles.iconBtn}>
                <Text style={styles.iconBtnTextMuted}>✕</Text>
              </TouchableOpacity>
            </View>
          ) : (
            !isArchived && (
              <TouchableOpacity style={styles.addChildBtn} onPress={onStartAddChild}>
                <Text style={styles.addChildBtnText}>＋ Add sub-category</Text>
              </TouchableOpacity>
            )
          )}
        </View>
      )}
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

  parentRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12, gap: 8 },
  expandBtn: { width: 24, alignItems: 'center' },
  expandChev: { fontSize: 14, color: COLORS.muted, fontWeight: '700' },
  parentIcon: { fontSize: 18 },
  parentNameBlock: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  parentName: { fontSize: 15, fontWeight: '700', color: COLORS.ink, flexShrink: 1 },
  childCount: {
    fontSize: 11, fontWeight: '700', color: COLORS.muted,
    backgroundColor: '#F5F0E8', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 9, overflow: 'hidden',
  },
  archivedText: { color: '#9CA3AF', textDecorationLine: 'line-through' },
  archivedPill: {
    fontSize: 10, fontWeight: '700', color: '#92400E',
    backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 9, overflow: 'hidden',
  },

  actionRow: { flexDirection: 'row', gap: 2 },
  iconBtn: { padding: 6, minWidth: 30, alignItems: 'center' },
  iconBtnTextMuted: { fontSize: 16, color: COLORS.muted },
  iconBtnTextOk: { fontSize: 16, color: COLORS.success, fontWeight: '700' },
  iconBtnTextDanger: { fontSize: 16, color: COLORS.error },

  childrenBlock: { paddingTop: 4, paddingBottom: 8, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: '#FAFAF7' },
  childRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, gap: 6 },
  archivedRow: { opacity: 0.6 },
  childBullet: { fontSize: 14, color: '#CBD5E1', width: 14 },
  childName: { flex: 1, fontSize: 14, color: COLORS.ink },

  addChildBtn: { paddingHorizontal: 16, paddingVertical: 8, marginTop: 4 },
  addChildBtnText: { fontSize: 13, color: COLORS.forest, fontWeight: '700' },

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

  footnote: {
    marginTop: 24, paddingHorizontal: 4,
  },
  footnoteText: { fontSize: 11, color: COLORS.muted, lineHeight: 16 },
  footnoteCode: { fontFamily: 'Courier', color: COLORS.ink },
});
