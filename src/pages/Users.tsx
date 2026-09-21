import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { api, ApiError } from "../lib/api";
import {
  Badge, Button, Card, ConfirmDialog, EmptyState, Field, Input, Modal, PageHeader,
  Pagination, SearchInput, Select, Spinner, toast,
} from "../components/ui";
import { ROLE_COLORS, ROLES } from "../lib/constants";
import { formatDateTime, initials } from "../lib/format";
import type { User } from "../lib/types";
import { useAuth } from "../lib/auth";

const EMPTY = { name: "", email: "", phone: "", role: "team_member", password: "", status: "active" };

export default function Users() {
  const { user: me } = useAuth();
  const [items, setItems] = useState<User[]>([]);
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, total: 0, per_page: 20 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<User | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), per_page: "15" });
      if (search) params.set("search", search);
      if (role) params.set("role", role);
      if (status) params.set("status", status);
      const res = await api<any[]>(`/users?${params.toString()}`);
      setItems(res.data);
      setPagination(res.pagination);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "تعذر تحميل المستخدمين.", "error");
    } finally {
      setLoading(false);
    }
  }, [page, search, role, status]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setModalOpen(true);
  }
  function openEdit(u: User) {
    setEditing(u);
    setForm({ name: u.name, email: u.email, phone: u.phone || "", role: u.role, password: "", status: u.status });
    setModalOpen(true);
  }

  async function save(ev: FormEvent) {
    ev.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await api(`/users/${editing.id}`, { method: "PUT", body: form });
        toast("تم تحديث المستخدم بنجاح.");
      } else {
        await api("/users", { method: "POST", body: form });
        toast("تم إنشاء المستخدم بنجاح.");
      }
      setModalOpen(false);
      load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "تعذر حفظ المستخدم.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleteLoading(true);
    try {
      await api(`/users/${toDelete.id}`, { method: "DELETE" });
      toast("تم تعطيل المستخدم بنجاح.");
      setToDelete(null);
      load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "تعذر تعطيل المستخدم.", "error");
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div>
      <PageHeader title="المستخدمون" subtitle={`إجمالي ${pagination.total} مستخدم`}
        actions={<Button onClick={openCreate}><Plus className="h-4 w-4" /> مستخدم جديد</Button>} />

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-4">
          <SearchInput value={search} onChange={setSearch} placeholder="ابحث بالاسم أو البريد..." className="w-full sm:w-64" />
          <Select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} className="w-full sm:w-44">
            <option value="">كل الأدوار</option>
            {Object.entries(ROLES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-full sm:w-40">
            <option value="">كل الحالات</option>
            <option value="active">نشط</option>
            <option value="disabled">معطل</option>
          </Select>
        </div>

        {loading ? (
          <div className="flex h-48 items-center justify-center"><Spinner className="h-7 w-7 text-indigo-600" /></div>
        ) : items.length === 0 ? (
          <EmptyState title="لا يوجد مستخدمون" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs text-slate-500">
                    <th className="px-5 py-3 font-semibold">المستخدم</th>
                    <th className="px-3 py-3 font-semibold">الدور</th>
                    <th className="px-3 py-3 font-semibold">الحالة</th>
                    <th className="px-3 py-3 font-semibold">آخر دخول</th>
                    <th className="px-5 py-3 font-semibold">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {items.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">{initials(u.name)}</div>
                          <div>
                            <div className="font-bold text-slate-800">{u.name}</div>
                            <div className="text-xs text-slate-400" dir="ltr">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3"><Badge className={ROLE_COLORS[u.role] || "bg-slate-100 text-slate-600 border-slate-200"}>{ROLES[u.role] || u.role}</Badge></td>
                      <td className="px-3 py-3">
                        <Badge className={u.status === "active" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"}>
                          {u.status === "active" ? "نشط" : "معطل"}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-slate-500">{formatDateTime(u.last_login_at)}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEdit(u)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="تعديل"><Pencil className="h-4 w-4" /></button>
                          {u.id !== me?.id && (
                            <button onClick={() => setToDelete(u)} className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="تعطيل"><Trash2 className="h-4 w-4" /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={pagination.current_page} lastPage={pagination.last_page} total={pagination.total} perPage={pagination.per_page} onPage={setPage} />
          </>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "تعديل المستخدم" : "مستخدم جديد"}
        footer={<><Button variant="secondary" onClick={() => setModalOpen(false)}>إلغاء</Button><Button onClick={save} loading={saving}>حفظ</Button></>}>
        <form onSubmit={save} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="الاسم *"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
          <Field label="البريد الإلكتروني *"><Input type="email" dir="ltr" className="text-right" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></Field>
          <Field label="الهاتف"><Input dir="ltr" className="text-right" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="الدور">
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {Object.entries(ROLES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
          <Field label="الحالة">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="active">نشط</option>
              <option value="disabled">معطل</option>
            </Select>
          </Field>
          <Field label={editing ? "كلمة مرور جديدة (اختياري)" : "كلمة المرور *"} hint={editing ? "اتركها فارغة لعدم تغييرها" : "6 أحرف على الأقل"}>
            <Input type="password" dir="ltr" className="text-right" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editing} />
          </Field>
        </form>
      </Modal>

      <ConfirmDialog open={!!toDelete} onClose={() => setToDelete(null)} onConfirm={confirmDelete} loading={deleteLoading}
        title="تعطيل المستخدم" message={`هل أنت متأكد من تعطيل حساب "${toDelete?.name}"؟ لن يتمكن من تسجيل الدخول بعد الآن.`} />
    </div>
  );
}
