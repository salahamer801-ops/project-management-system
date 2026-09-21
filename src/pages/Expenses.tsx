import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { api, ApiError } from "../lib/api";
import {
  Badge, Button, Card, ConfirmDialog, EmptyState, Field, Input, Modal, PageHeader,
  Pagination, SearchInput, Select, Spinner, Textarea, toast,
} from "../components/ui";
import { EXPENSE_CATEGORIES } from "../lib/constants";
import { formatDate, money } from "../lib/format";
import type { Expense, Project } from "../lib/types";
import { useAuth } from "../lib/auth";

const EMPTY = { project_id: "", title: "", description: "", amount: "", category: "", expense_date: "" };

export default function Expenses() {
  const { user } = useAuth();
  const [items, setItems] = useState<Expense[]>([]);
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, total: 0, per_page: 20 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Expense | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const isManager = user?.role !== "team_member";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), per_page: "15" });
      if (search) params.set("search", search);
      if (projectFilter) params.set("project_id", projectFilter);
      if (category) params.set("category", category);
      const res = await api<any[]>(`/expenses?${params.toString()}`);
      setItems(res.data);
      setPagination(res.pagination);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "تعذر تحميل المصروفات.", "error");
    } finally {
      setLoading(false);
    }
  }, [page, search, projectFilter, category]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    api<any[]>("/projects?per_page=100").then((r) => setProjects(r.data)).catch(() => {});
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setModalOpen(true);
  }
  function openEdit(e: Expense) {
    setEditing(e);
    setForm({ project_id: String(e.project_id), title: e.title, description: e.description || "", amount: String(e.amount), category: e.category || "", expense_date: e.expense_date || "" });
    setModalOpen(true);
  }

  async function save(ev: FormEvent) {
    ev.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await api(`/expenses/${editing.id}`, { method: "PUT", body: form });
        toast("تم تحديث المصروف بنجاح.");
      } else {
        await api(`/expenses/projects/${form.project_id}`, { method: "POST", body: form });
        toast("تمت إضافة المصروف بنجاح.");
      }
      setModalOpen(false);
      load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "تعذر حفظ المصروف.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleteLoading(true);
    try {
      await api(`/expenses/${toDelete.id}`, { method: "DELETE" });
      toast("تم حذف المصروف بنجاح.");
      setToDelete(null);
      load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "تعذر حذف المصروف.", "error");
    } finally {
      setDeleteLoading(false);
    }
  }

  const total = items.reduce((s, e) => s + (e.amount || 0), 0);

  return (
    <div>
      <PageHeader
        title="المصروفات"
        subtitle={`إجمالي الصفحة الحالية: ${money(total)}`}
        actions={isManager && <Button onClick={openCreate}><Plus className="h-4 w-4" /> إضافة مصروف</Button>}
      />

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-4">
          <SearchInput value={search} onChange={setSearch} placeholder="ابحث في المصروفات..." className="w-full sm:w-56" />
          <Select value={projectFilter} onChange={(e) => { setProjectFilter(e.target.value); setPage(1); }} className="w-full sm:w-48">
            <option value="">كل المشاريع</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          <Select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} className="w-full sm:w-40">
            <option value="">كل التصنيفات</option>
            {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </div>

        {loading ? (
          <div className="flex h-48 items-center justify-center"><Spinner className="h-7 w-7 text-indigo-600" /></div>
        ) : items.length === 0 ? (
          <EmptyState title="لا توجد مصروفات" description="لم يتم العثور على مصروفات مطابقة." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs text-slate-500">
                    <th className="px-5 py-3 font-semibold">المصروف</th>
                    <th className="px-3 py-3 font-semibold">المشروع</th>
                    <th className="px-3 py-3 font-semibold">التصنيف</th>
                    <th className="px-3 py-3 font-semibold">التاريخ</th>
                    <th className="px-3 py-3 font-semibold">بواسطة</th>
                    <th className="px-3 py-3 font-semibold">القيمة</th>
                    <th className="px-5 py-3 font-semibold">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {items.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3 font-bold text-slate-800">{e.title}</td>
                      <td className="px-3 py-3 text-slate-500">{e.project_name}</td>
                      <td className="px-3 py-3"><Badge className="bg-amber-50 text-amber-700 border-amber-200">{e.category || "بدون"}</Badge></td>
                      <td className="px-3 py-3 text-slate-500">{formatDate(e.expense_date)}</td>
                      <td className="px-3 py-3 text-slate-500">{e.creator_name || "—"}</td>
                      <td className="px-3 py-3 font-bold text-slate-700">{money(e.amount)}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1">
                          {isManager && (
                            <button onClick={() => openEdit(e)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="تعديل"><Pencil className="h-4 w-4" /></button>
                          )}
                          {isManager && (
                            <button onClick={() => setToDelete(e)} className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="حذف"><Trash2 className="h-4 w-4" /></button>
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "تعديل المصروف" : "إضافة مصروف"}
        footer={<><Button variant="secondary" onClick={() => setModalOpen(false)}>إلغاء</Button><Button onClick={save} loading={saving}>حفظ</Button></>}>
        <form onSubmit={save} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="المشروع *">
            <Select value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })} required disabled={!!editing}>
              <option value="">— اختر المشروع —</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
          <Field label="العنوان *"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></Field>
          <Field label="القيمة *"><Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></Field>
          <Field label="التصنيف"><Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}><option value="">— اختر —</option>{EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</Select></Field>
          <div className="sm:col-span-2"><Field label="الوصف"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field></div>
          <Field label="التاريخ"><Input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} /></Field>
        </form>
      </Modal>

      <ConfirmDialog open={!!toDelete} onClose={() => setToDelete(null)} onConfirm={confirmDelete} loading={deleteLoading}
        title="حذف المصروف" message={`هل أنت متأكد من حذف المصروف "${toDelete?.title}"؟`} />
    </div>
  );
}
