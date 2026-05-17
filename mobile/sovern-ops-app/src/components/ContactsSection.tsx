// ─── ContactsSection (Phase 4.23 mobile parity) ───────────────────────────
//
// Mobile mirror of frontend/admin-portal/src/components/ContactsSection.jsx.
// Embedded card list for Client (Customer) and Supplier (Factory) detail
// modals: lists contacts, supports inline add / edit / delete, tags new
// rows with the parent customerId or factoryId.
//
// Usage:
//   <ContactsSection parentType="Customer" parentId={customer.id} />
//   <ContactsSection parentType="Factory"  parentId={factory.id} />
//
// Visual conventions follow ChatterSection: card-on-cream surface, forest
// CTAs, native Alert.alert for delete confirmation. No external modals.

import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Switch,
  Linking,
} from "react-native";
import { COLORS } from "../constants/config";
import {
  listContacts,
  createContact,
  updateContact,
  deleteContact,
  type Contact,
  type ContactInput,
} from "../services/api";

type ParentType = "Customer" | "Factory";

interface Props {
  parentType: ParentType;
  parentId: string;
}

const EMPTY_DRAFT: ContactInput = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  mobile: "",
  jobTitle: "",
  department: "",
  isPrimary: false,
  notes: "",
};

function trimOrNull(s?: string | null): string | null {
  if (s == null) return null;
  const t = String(s).trim();
  return t === "" ? null : t;
}

export default function ContactsSection({ parentType, parentId }: Props) {
  const parentKey: "customerId" | "factoryId" =
    parentType === "Customer" ? "customerId" : "factoryId";

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  // editing = null (read-only), "new" (adding), or a contact id (editing one)
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<ContactInput>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params = parentType === "Customer"
        ? { customerId: parentId, limit: 100 }
        : { factoryId: parentId, limit: 100 };
      const rows = await listContacts(params);
      setContacts(Array.isArray(rows) ? rows : []);
    } catch (err: any) {
      // Non-fatal: empty list, user can retry by reopening.
      console.warn("[ContactsSection/load]", err?.message ?? err);
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }, [parentType, parentId]);

  useEffect(() => {
    load();
  }, [load]);

  const startAdd = () => {
    setEditing("new");
    setDraft({ ...EMPTY_DRAFT });
  };

  const startEdit = (c: Contact) => {
    setEditing(c.id);
    setDraft({
      firstName: c.firstName ?? "",
      lastName: c.lastName ?? "",
      email: c.email ?? "",
      phone: c.phone ?? "",
      mobile: c.mobile ?? "",
      jobTitle: c.jobTitle ?? "",
      department: c.department ?? "",
      isPrimary: !!c.isPrimary,
      notes: c.notes ?? "",
    });
  };

  const cancelEdit = () => {
    setEditing(null);
    setDraft(EMPTY_DRAFT);
  };

  const handleSave = async () => {
    if (!draft.firstName.trim() || !draft.lastName.trim() || !draft.email.trim()) {
      Alert.alert("Missing required fields", "First name, last name, and email are all required.");
      return;
    }
    setSaving(true);
    try {
      const payload: ContactInput = {
        firstName: draft.firstName.trim(),
        lastName: draft.lastName.trim(),
        email: draft.email.trim(),
        phone: trimOrNull(draft.phone),
        mobile: trimOrNull(draft.mobile),
        jobTitle: trimOrNull(draft.jobTitle),
        department: trimOrNull(draft.department),
        isPrimary: !!draft.isPrimary,
        notes: trimOrNull(draft.notes),
        [parentKey]: parentId,
      };
      if (editing === "new") {
        const created = await createContact(payload);
        setContacts((prev) => [...prev, created]);
      } else if (editing) {
        const updated = await updateContact(editing, payload);
        setContacts((prev) => prev.map((c) => (c.id === editing ? updated : c)));
      }
      cancelEdit();
    } catch (err: any) {
      Alert.alert("Could not save contact", err?.message ?? "Server error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (c: Contact) => {
    const name = `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || "this contact";
    Alert.alert(
      "Delete contact",
      `Delete ${name}? This cannot be undone from the mobile app.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteContact(c.id);
              setContacts((prev) => prev.filter((x) => x.id !== c.id));
            } catch (err: any) {
              Alert.alert("Could not delete", err?.message ?? "Server error");
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>
          Contacts
          {contacts.length > 0 ? (
            <Text style={styles.countPill}>  {contacts.length}</Text>
          ) : null}
        </Text>
        {editing !== "new" ? (
          <TouchableOpacity onPress={startAdd} style={styles.addBtn} activeOpacity={0.7}>
            <Text style={styles.addBtnText}>+ Add</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <ActivityIndicator size="small" color={COLORS.forest} style={{ margin: 16 }} />
      ) : (
        <View>
          {contacts.length === 0 && editing !== "new" ? (
            <Text style={styles.empty}>No contacts yet. Tap Add to create one.</Text>
          ) : null}

          {contacts.map((c) =>
            editing === c.id ? (
              <ContactForm
                key={c.id}
                draft={draft}
                setDraft={setDraft}
                onSave={handleSave}
                onCancel={cancelEdit}
                saving={saving}
                isNew={false}
              />
            ) : (
              <ContactRow key={c.id} contact={c} onEdit={() => startEdit(c)} onDelete={() => handleDelete(c)} />
            )
          )}

          {editing === "new" ? (
            <ContactForm
              draft={draft}
              setDraft={setDraft}
              onSave={handleSave}
              onCancel={cancelEdit}
              saving={saving}
              isNew
            />
          ) : null}
        </View>
      )}
    </View>
  );
}

// ─── ContactRow ───────────────────────────────────────────────────────────

function ContactRow({
  contact,
  onEdit,
  onDelete,
}: {
  contact: Contact;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const fullName = `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim() || "(unnamed)";
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <View style={styles.rowHeader}>
          <Text style={styles.rowName}>{fullName}</Text>
          {contact.isPrimary ? (
            <View style={styles.primaryPill}>
              <Text style={styles.primaryPillText}>Primary</Text>
            </View>
          ) : null}
          {contact.jobTitle ? (
            <Text style={styles.jobTitle}> · {contact.jobTitle}</Text>
          ) : null}
        </View>

        {contact.email ? (
          <TouchableOpacity onPress={() => Linking.openURL(`mailto:${contact.email}`)}>
            <Text style={[styles.rowDetail, styles.link]}>{contact.email}</Text>
          </TouchableOpacity>
        ) : null}
        {contact.phone ? (
          <TouchableOpacity onPress={() => Linking.openURL(`tel:${contact.phone}`)}>
            <Text style={[styles.rowDetail, styles.link]}>{contact.phone}</Text>
          </TouchableOpacity>
        ) : null}
        {contact.mobile ? (
          <TouchableOpacity onPress={() => Linking.openURL(`tel:${contact.mobile}`)}>
            <Text style={[styles.rowDetail, styles.link]}>m: {contact.mobile}</Text>
          </TouchableOpacity>
        ) : null}
        {contact.department ? (
          <Text style={styles.rowDetailMuted}>{contact.department}</Text>
        ) : null}
        {contact.notes ? (
          <Text style={styles.rowNotes}>{contact.notes}</Text>
        ) : null}
      </View>

      <View style={styles.rowActions}>
        <TouchableOpacity onPress={onEdit} style={styles.iconBtn} hitSlop={8}>
          <Text style={styles.iconBtnText}>✎</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onDelete} style={styles.iconBtn} hitSlop={8}>
          <Text style={[styles.iconBtnText, { color: "#B91C1C" }]}>🗑</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── ContactForm ──────────────────────────────────────────────────────────

function ContactForm({
  draft,
  setDraft,
  onSave,
  onCancel,
  saving,
  isNew,
}: {
  draft: ContactInput;
  setDraft: (updater: (d: ContactInput) => ContactInput) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  isNew: boolean;
}) {
  const set = <K extends keyof ContactInput>(key: K) => (val: ContactInput[K]) =>
    setDraft((d) => ({ ...d, [key]: val }));

  return (
    <View style={styles.formBox}>
      <Text style={styles.formTitle}>{isNew ? "New contact" : "Edit contact"}</Text>

      <Field label="First name *" value={draft.firstName} onChange={set("firstName")} autoFocus />
      <Field label="Last name *" value={draft.lastName} onChange={set("lastName")} />
      <Field label="Email *" value={draft.email} onChange={set("email")} keyboardType="email-address" autoCapitalize="none" />
      <Field label="Phone" value={draft.phone ?? ""} onChange={set("phone")} keyboardType="phone-pad" />
      <Field label="Mobile" value={draft.mobile ?? ""} onChange={set("mobile")} keyboardType="phone-pad" />
      <Field label="Job title" value={draft.jobTitle ?? ""} onChange={set("jobTitle")} />
      <Field label="Department" value={draft.department ?? ""} onChange={set("department")} />

      <View style={styles.switchRow}>
        <Text style={styles.fieldLabel}>Primary contact</Text>
        <Switch
          value={!!draft.isPrimary}
          onValueChange={(v) => setDraft((d) => ({ ...d, isPrimary: v }))}
          trackColor={{ true: COLORS.forest, false: COLORS.border }}
          thumbColor={COLORS.white}
        />
      </View>

      <Field label="Notes" value={draft.notes ?? ""} onChange={set("notes")} multiline />

      <View style={styles.formActions}>
        <TouchableOpacity onPress={onCancel} style={styles.cancelBtn} activeOpacity={0.7}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onSave}
          disabled={saving}
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          activeOpacity={0.7}
        >
          {saving ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Text style={styles.saveBtnText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline,
  keyboardType,
  autoCapitalize,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  multiline?: boolean;
  keyboardType?: "default" | "email-address" | "phone-pad";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoFocus?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        multiline={!!multiline}
        keyboardType={keyboardType ?? "default"}
        autoCapitalize={autoCapitalize ?? "sentences"}
        autoFocus={!!autoFocus}
        style={[styles.input, multiline && styles.inputMulti]}
        placeholderTextColor={COLORS.muted}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.ink,
  },
  countPill: {
    fontSize: 12,
    fontWeight: "500",
    color: COLORS.muted,
  },
  addBtn: {
    backgroundColor: COLORS.forest,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addBtnText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: "600",
  },
  empty: {
    fontSize: 13,
    color: COLORS.muted,
    fontStyle: "italic",
    paddingVertical: 12,
    textAlign: "center",
  },

  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 8,
  },
  rowHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  rowName: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.ink,
  },
  jobTitle: {
    fontSize: 12,
    color: COLORS.muted,
  },
  primaryPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: "#FEF3C7",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#FCD34D",
  },
  primaryPillText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#92400E",
  },
  rowDetail: {
    fontSize: 13,
    color: COLORS.ink,
    marginTop: 2,
  },
  rowDetailMuted: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 2,
  },
  link: {
    color: COLORS.forest,
    textDecorationLine: "underline",
  },
  rowNotes: {
    fontSize: 12,
    color: COLORS.muted,
    fontStyle: "italic",
    marginTop: 6,
  },
  rowActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  iconBtn: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 6,
  },
  iconBtnText: {
    fontSize: 16,
    color: COLORS.muted,
  },

  formBox: {
    marginTop: 10,
    padding: 12,
    backgroundColor: COLORS.cream,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.forest + "40",
  },
  formTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.ink,
    marginBottom: 10,
  },
  field: {
    marginBottom: 10,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.ink,
    marginBottom: 4,
  },
  input: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: COLORS.ink,
  },
  inputMulti: {
    minHeight: 60,
    textAlignVertical: "top",
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  formActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 6,
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  cancelBtnText: {
    fontSize: 13,
    color: COLORS.muted,
    fontWeight: "600",
  },
  saveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: COLORS.ink,
    minWidth: 80,
    alignItems: "center",
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: "700",
  },
});
