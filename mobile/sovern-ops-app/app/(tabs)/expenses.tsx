import React, { useState, useEffect } from 'react'
import {
  View,
  FlatList,
  TouchableOpacity,
  Text,
  TextInput,
  Modal,
  ScrollView,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ActionSheetIOS,
  Linking,
} from 'react-native'
import { Picker } from '@react-native-picker/picker'
import { useRouter } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import { COLORS } from '../../src/constants/config'
import {
  listExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  listExpenseOffices,
  createExpenseSubmission,
  generateSubmissionReport,
  ExpenseRow,
  ReimbursementOfficeRow,
} from '../../src/services/api'

const EXPENSE_CATEGORIES = [
  'Travel',
  'Hotel',
  'Meal allowance',
  'Flight',
  'Taxi',
  'Visa',
  'Office',
  'Bonus',
  'Salary',
  'Rent',
  'Ticket',
  'Labour cost',
  'Other',
]

const CURRENCIES = ['USD', 'TWD', 'CNY', 'RMB', 'THB', 'VND', 'CAD', 'HKD', 'EUR', 'GBP']

const STATUS_COLORS: Record<string, string> = {
  draft: COLORS.ink + '40',
  submitted: '#3b82f6',
  paid: COLORS.forest,
  rejected: '#ef4444',
  not_claimable: '#9ca3af',
}

function getStatusColor(status: string) {
  return STATUS_COLORS[status] || COLORS.ink + '40'
}

function formatCurrency(amount: number, currency: string) {
  return `${currency} ${amount.toFixed(2)}`
}

function todayString() {
  const d = new Date()
  return d.toISOString().split('T')[0]
}

function ExpenseRowComponent({ expense, onPress }: { expense: ExpenseRow; onPress: () => void }) {
  const styles = useStyles()
  return (
    <TouchableOpacity style={styles.row} onPress={onPress}>
      <View style={styles.rowContent}>
        <View style={styles.rowPrimary}>
          <Text style={styles.rowDate}>{expense.entryDate}</Text>
          <Text style={styles.rowCategory}>{expense.category}</Text>
        </View>
        <View style={styles.rowAmount}>
          <Text style={styles.rowAmountText}>
            {formatCurrency(expense.originalAmount, expense.originalCurrency)}
          </Text>
          {expense.usdAmount ? (
            <Text style={styles.rowUsd}>≈ ${expense.usdAmount.toFixed(2)}</Text>
          ) : null}
        </View>
        <View style={styles.rowStatus}>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(expense.submissionStatus) },
            ]}
          >
            <Text style={styles.statusText}>{expense.submissionStatus}</Text>
          </View>
        </View>
      </View>
      {expense.description ? (
        <Text style={styles.rowDescription} numberOfLines={1}>
          {expense.description}
        </Text>
      ) : null}
    </TouchableOpacity>
  )
}

function ExpenseDetailModal({
  expense,
  onClose,
  onEdit,
  onDeleted,
}: {
  expense: ExpenseRow
  onClose: () => void
  onEdit: (exp: ExpenseRow) => void
  onDeleted: (id: string) => void
}) {
  const styles = useStyles()
  const [deleting, setDeleting] = useState(false)

  const canDelete =
    expense.submissionStatus === 'draft' ||
    expense.submissionStatus === 'rejected' ||
    expense.submissionStatus === 'not_claimable'

  function handleDelete() {
    setDeleting(true)
    deleteExpense(expense.id)
      .then(() => {
        onDeleted(expense.id)
        onClose()
      })
      .catch((err) => {
        console.error('delete error:', err)
        setDeleting(false)
      })
  }

  function row(label: string, value?: string | number | null, highlight?: boolean) {
    if (value == null || value === '') return null
    return (
      <View style={styles.detailRow} key={label}>
        <Text style={[styles.detailLabel, highlight && { color: COLORS.forest }]}>
          {label}
        </Text>
        <Text style={styles.detailValue}>{String(value)}</Text>
      </View>
    )
  }

  return (
    <Modal visible animationType="slide">
      <View style={styles.detailContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{expense.category}</Text>
          <View style={styles.detailHeaderActions}>
            {canDelete ? (
              <TouchableOpacity onPress={handleDelete} disabled={deleting}>
                <Text style={styles.deleteButton}>{deleting ? '…' : '🗑'}</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.detailScroll}>
          <View
            style={[
              styles.statusBadgeLarge,
              { backgroundColor: getStatusColor(expense.submissionStatus) },
            ]}
          >
            <Text style={styles.statusTextLarge}>{expense.submissionStatus}</Text>
          </View>

          {row('Date', expense.entryDate)}
          {row('Description', expense.description)}
          {row(
            'Amount',
            formatCurrency(expense.originalAmount, expense.originalCurrency),
            true,
          )}
          {row('USD Equivalent', expense.usdAmount ? `$${expense.usdAmount.toFixed(2)}` : null)}
          {row('Notes', expense.notes)}
          {row('Paid At', expense.paidAt)}
        </ScrollView>
      </View>
    </Modal>
  )
}

function ExpenseCreateModal({
  onClose,
  onSaved,
  editingExpense,
}: {
  onClose: () => void
  onSaved: (expense: ExpenseRow) => void
  editingExpense?: ExpenseRow
}) {
  const styles = useStyles()
  const [saving, setSaving] = useState(false)

  const [entryDate, setEntryDate] = useState(editingExpense?.entryDate || todayString())
  const [category, setCategory] = useState(editingExpense?.category || 'Travel')
  const [description, setDescription] = useState(editingExpense?.description || '')
  const [currency, setCurrency] = useState(editingExpense?.originalCurrency || 'USD')
  const [amount, setAmount] = useState(
    editingExpense ? String(editingExpense.originalAmount) : '',
  )
  const [notes, setNotes] = useState(editingExpense?.notes || '')

  function handleSave() {
    if (!amount || parseFloat(amount) <= 0) {
      alert('Please enter a valid amount')
      return
    }

    setSaving(true)
    const body: Partial<ExpenseRow> = {
      entryDate,
      category,
      description,
      originalCurrency: currency,
      originalAmount: parseFloat(amount),
      submissionStatus: 'draft',
      notes,
    }

    const promise = editingExpense ? updateExpense(editingExpense.id, body) : createExpense(body)

    promise
      .then((res) => {
        if (res.success) {
          onSaved(res.data)
          onClose()
        } else {
          alert('Failed to save expense')
        }
      })
      .catch((err) => {
        console.error('save error:', err)
        alert('Error: ' + err.message)
      })
      .finally(() => setSaving(false))
  }

  return (
    <Modal visible animationType="slide">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.detailContainer}
      >
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>
            {editingExpense ? 'Edit Expense' : 'New Expense'}
          </Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeButton}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.createFormScroll}>
          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Date</Text>
            <TextInput
              style={styles.formInput}
              value={entryDate}
              onChangeText={setEntryDate}
              placeholder="YYYY-MM-DD"
            />
          </View>

          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Category</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={category}
                onValueChange={setCategory}
                style={styles.picker}
              >
                {EXPENSE_CATEGORIES.map((cat) => (
                  <Picker.Item key={cat} label={cat} value={cat} />
                ))}
              </Picker>
            </View>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Description</Text>
            <TextInput
              style={styles.formInput}
              value={description}
              onChangeText={setDescription}
              placeholder="What was this for?"
            />
          </View>

          <View style={styles.formRow}>
            <View style={[styles.formSection, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.formLabel}>Currency</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={currency}
                  onValueChange={setCurrency}
                  style={styles.picker}
                >
                  {CURRENCIES.map((ccy) => (
                    <Picker.Item key={ccy} label={ccy} value={ccy} />
                  ))}
                </Picker>
              </View>
            </View>

            <View style={[styles.formSection, { flex: 1 }]}>
              <Text style={styles.formLabel}>Amount</Text>
              <TextInput
                style={styles.formInput}
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Notes</Text>
            <TextInput
              style={[styles.formInput, styles.formTextarea]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Any additional notes"
              multiline
              numberOfLines={3}
            />
          </View>

          <TouchableOpacity
            style={[styles.saveButton, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={COLORS.cream} />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

export default function ExpensesScreen() {
  const styles = useStyles()
  const [expenses, setExpenses] = useState<ExpenseRow[]>([])
  const [filtered, setFiltered] = useState<ExpenseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [paidFilter, setPaidFilter] = useState<boolean | null>(false) // default to unpaid only

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [editingExpense, setEditingExpense] = useState<ExpenseRow | undefined>()

  // Load expenses
  async function load(isRefresh = false) {
    try {
      if (!isRefresh) setLoading(true)
      else setRefreshing(true)

      const res = await listExpenses({ limit: 200 })
      if (res.success) {
        setExpenses(res.data)
      }
    } catch (err) {
      console.error('load error:', err)
    } finally {
      if (!isRefresh) setLoading(false)
      else setRefreshing(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  // Filter on search/status/paid changes
  useEffect(() => {
    let result = expenses

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (e) =>
          e.description?.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q) ||
          e.originalCurrency.includes(q.toUpperCase()),
      )
    }

    if (statusFilter) {
      result = result.filter((e) => e.submissionStatus === statusFilter)
    }

    if (paidFilter !== null) {
      result = result.filter((e) => {
        const isPaid = e.paidAt != null
        return paidFilter ? isPaid : !isPaid
      })
    }

    setFiltered(result)
  }, [search, statusFilter, paidFilter, expenses])

  // Compute per-currency totals
  const totals: Record<string, number> = {}
  filtered.forEach((e) => {
    if (!totals[e.originalCurrency]) totals[e.originalCurrency] = 0
    totals[e.originalCurrency] += e.originalAmount
  })

  const selectedExpense = expenses.find((e) => e.id === selectedId)

  function handleEdit(expense: ExpenseRow) {
    setEditingExpense(expense)
    setShowCreate(true)
    setSelectedId(null)
  }

  function handleSaved(expense: ExpenseRow) {
    setExpenses((prev) => {
      const idx = prev.findIndex((e) => e.id === expense.id)
      if (idx >= 0) {
        prev[idx] = expense
        return [...prev]
      } else {
        return [expense, ...prev]
      }
    })
    setEditingExpense(undefined)
    setShowCreate(false)
  }

  function handleDeleted(id: string) {
    setExpenses((prev) => prev.filter((e) => e.id !== id))
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={COLORS.forest} size="large" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Expenses</Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => {
            setEditingExpense(undefined)
            setShowCreate(true)
          }}
        >
          <Text style={styles.primaryButtonText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {/* Filter strip */}
      <View style={styles.filterStrip}>
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterChip, !statusFilter && { backgroundColor: COLORS.forest }]}
            onPress={() => setStatusFilter(null)}
          >
            <Text style={styles.filterChipText}>All</Text>
          </TouchableOpacity>
          {['draft', 'submitted', 'paid', 'rejected'].map((status) => (
            <TouchableOpacity
              key={status}
              style={[styles.filterChip, statusFilter === status && { backgroundColor: COLORS.forest }]}
              onPress={() => setStatusFilter(statusFilter === status ? null : status)}
            >
              <Text style={styles.filterChipText}>{status}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterChip, paidFilter === null && { backgroundColor: COLORS.forest }]}
            onPress={() => setPaidFilter(null)}
          >
            <Text style={styles.filterChipText}>Any</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, paidFilter === false && { backgroundColor: COLORS.forest }]}
            onPress={() => setPaidFilter(paidFilter === false ? null : false)}
          >
            <Text style={styles.filterChipText}>Unpaid</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, paidFilter === true && { backgroundColor: COLORS.forest }]}
            onPress={() => setPaidFilter(paidFilter === true ? null : true)}
          >
            <Text style={styles.filterChipText}>Paid</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Totals */}
      {filtered.length > 0 ? (
        <View style={styles.totalsRow}>
          {Object.entries(totals).map(([ccy, total]) => (
            <View key={ccy} style={styles.totalItem}>
              <Text style={styles.totalLabel}>{ccy}</Text>
              <Text style={styles.totalValue}>{total.toFixed(2)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ExpenseRowComponent expense={item} onPress={() => setSelectedId(item.id)} />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.forest} />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No expenses yet</Text>
          </View>
        }
        contentContainerStyle={filtered.length === 0 ? styles.emptyFlex : undefined}
      />

      {/* Detail Modal */}
      {selectedExpense ? (
        <ExpenseDetailModal
          expense={selectedExpense}
          onClose={() => setSelectedId(null)}
          onEdit={handleEdit}
          onDeleted={handleDeleted}
        />
      ) : null}

      {/* Create Modal */}
      {showCreate ? (
        <ExpenseCreateModal
          onClose={() => {
            setShowCreate(false)
            setEditingExpense(undefined)
          }}
          onSaved={handleSaved}
          editingExpense={editingExpense}
        />
      ) : null}
    </View>
  )
}

function useStyles() {
  return {
    container: {
      flex: 1,
      backgroundColor: COLORS.cream,
    },
    headerBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.ink + '10',
      paddingTop: Platform.OS === 'ios' ? 48 : 12,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: '600',
      color: COLORS.ink,
    },
    primaryButton: {
      backgroundColor: COLORS.forest,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 0,
    },
    primaryButtonText: {
      color: COLORS.cream,
      fontSize: 14,
      fontWeight: '600',
    },
    filterStrip: {
      backgroundColor: COLORS.cream,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.ink + '10',
    },
    filterRow: {
      flexDirection: 'row',
      marginBottom: 8,
      gap: 6,
    },
    filterChip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 4,
      backgroundColor: COLORS.ink + '05',
      borderWidth: 1,
      borderColor: COLORS.ink + '10',
    },
    filterChipText: {
      fontSize: 12,
      color: COLORS.ink,
    },
    totalsRow: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingVertical: 8,
      gap: 16,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.ink + '10',
    },
    totalItem: {
      flex: 1,
    },
    totalLabel: {
      fontSize: 11,
      color: COLORS.ink + '70',
      marginBottom: 2,
    },
    totalValue: {
      fontSize: 14,
      fontWeight: '600',
      color: COLORS.forest,
    },
    row: {
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    rowContent: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 4,
    },
    rowPrimary: {
      flex: 1,
    },
    rowDate: {
      fontSize: 12,
      color: COLORS.ink + '70',
      marginBottom: 2,
    },
    rowCategory: {
      fontSize: 14,
      fontWeight: '600',
      color: COLORS.ink,
    },
    rowAmount: {
      alignItems: 'flex-end',
      marginHorizontal: 8,
    },
    rowAmountText: {
      fontSize: 13,
      fontWeight: '600',
      color: COLORS.ink,
    },
    rowUsd: {
      fontSize: 11,
      color: COLORS.ink + '60',
    },
    rowStatus: {
      marginLeft: 8,
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 3,
    },
    statusText: {
      fontSize: 11,
      fontWeight: '600',
      color: COLORS.cream,
    },
    rowDescription: {
      fontSize: 12,
      color: COLORS.ink + '60',
    },
    separator: {
      height: 1,
      backgroundColor: COLORS.ink + '10',
      marginHorizontal: 16,
    },
    emptyState: {
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 40,
    },
    emptyStateText: {
      fontSize: 14,
      color: COLORS.ink + '60',
    },
    emptyFlex: {
      flexGrow: 1,
      justifyContent: 'center',
    },
    detailContainer: {
      flex: 1,
      backgroundColor: COLORS.cream,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: COLORS.forest,
      paddingHorizontal: 16,
      paddingVertical: 12,
      paddingTop: Platform.OS === 'ios' ? 48 : 12,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: COLORS.cream,
    },
    detailHeaderActions: {
      flexDirection: 'row',
      gap: 12,
    },
    deleteButton: {
      fontSize: 20,
    },
    closeButton: {
      fontSize: 20,
      color: COLORS.cream,
    },
    detailScroll: {
      paddingHorizontal: 16,
      paddingVertical: 16,
    },
    statusBadgeLarge: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 4,
      marginBottom: 16,
      alignSelf: 'flex-start',
    },
    statusTextLarge: {
      fontSize: 13,
      fontWeight: '600',
      color: COLORS.cream,
    },
    detailRow: {
      borderBottomWidth: 1,
      borderBottomColor: COLORS.ink + '10',
      paddingVertical: 12,
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    detailLabel: {
      fontSize: 12,
      color: COLORS.ink + '70',
      fontWeight: '500',
      flex: 1,
    },
    detailValue: {
      fontSize: 13,
      color: COLORS.ink,
      fontWeight: '500',
      flex: 1,
      textAlign: 'right',
    },
    createFormScroll: {
      paddingHorizontal: 16,
      paddingVertical: 16,
    },
    formSection: {
      marginBottom: 16,
    },
    formRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 16,
    },
    formLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: COLORS.ink,
      marginBottom: 6,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    formInput: {
      borderWidth: 1,
      borderColor: COLORS.ink + '20',
      backgroundColor: COLORS.cream,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 13,
      color: COLORS.ink,
      borderRadius: 0,
    },
    formTextarea: {
      minHeight: 80,
      textAlignVertical: 'top',
    },
    pickerContainer: {
      borderWidth: 1,
      borderColor: COLORS.ink + '20',
      borderRadius: 0,
      overflow: 'hidden',
    },
    picker: {
      height: 140,
    },
    saveButton: {
      backgroundColor: COLORS.forest,
      paddingVertical: 12,
      borderRadius: 0,
      marginTop: 8,
      alignItems: 'center',
    },
    saveButtonText: {
      color: COLORS.cream,
      fontSize: 14,
      fontWeight: '600',
    },
  }
}
