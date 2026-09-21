import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Plus, Pencil, Trash2, Eye } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import {
  Badge, Button, Card, ConfirmDialog, Dot, EmptyState, Field, Input, Modal,
  PageHeader, Pagination, SearchInput, Select, Spinner, toast,
} from "../components/ui";
import { PROJECT_STATUS, PRIORITY, statusOptions } from "../lib/constants";
import { formatDate, money } from "../lib/format";
import type { Project, User } from "../lib/types";

const EMPTY_FORM = {
  name: "",
  code: "",
  description: "",
  manager_id: "",
  status: "planned",
  priority: "medium",
  start_date: "",
  end_date: "",
  budget: "",
};

export default function Projects() {
  const { user } = useAuth();
  const [items, setItems] = useState<Project[]>([]);
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, total: 0, per_page: 20 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [sort, setSort] = useState("created_at");
  const dir = "desc";
  const [loading, setLoading] = useState(true);

  const [users, setUsers] = useState<User[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Project | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const canCreate = ["system_admin", "project_manager"].includes(user?.role || "");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        per_page: "12",
        sort,
        dir,
      });
      if (search) params.set("search", search);
      if (status) params.set("status", status);
      if (priority) params.set("priority", priority);
      const res = await api<any[]>(`/projects?${params.toString()}`);
      setItems(res.data);
      setPagination(res.pagination);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "تعذر تحميل المشاريع.", "error");
    } finally {
      setLoading(false);
    }
  }, [page, search, status, priority, sort, dir]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    api<User[]>("/users/options").then((r) => setUsers(r.data)).catch(() => {});
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(p: Project) {
    setEditing(p);
    setForm({
      name: p.name,
      code: p.code || "",
      description: p.description || "",
      manager_id: p.manager_id ? String(p.manager_id) : "",
      status: p.status,
      priority: p.priority,
      start_date: p.start_date || "",
      end_date: p.end_date || "",
      budget: p.budget != null ? String(p.budget) : "",
    });
    setModalOpen(true);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await api(`/projects/${editing.id}`, { method: "PUT", body: form });
        toast("تم تحديث المشروع بنجاح.");
      } else {
        await api("/projects", { method: "POST", body: form });
        toast("تم إنشاء المشروع بنجاح.");
      }
      setModalOpen(false);
      load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "تعذر حفظ المشروع.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      await api(`/projects/${deleting.id}`, { method: "DELETE" });
      toast("تم حذف المشروع بنجاح.");
      setDeleting(null);
      load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "تعذر حذف المشروع.", "error");
    } finally {
      setDeleteLoading(false);
    }
  }

  const canEdit = (p: Project) =>
    ["system_admin"].includes(user?.role || "") || p.manager_id === user?.id || p.created_by === user?.id;
  const canDelete = canEdit;

  return (
    <div>
      <PageHeader
        title="المشاريع"
        subtitle={`إجمالي ${pagination.total} مشروع`}
        actions={
          canCreate && (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> مشروع جديد
            </Button>
          )
        }
      />

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-4">
          <SearchInput value={search} onChange={setSearch} placeholder="ابحث بالاسم أو الكود..." className="w-full sm:w-64" />
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-full sm:w-40">
            <option value="">كل الحالات</option>
            {statusOptions(PROJECT_STATUS).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
          <Select value={priority} onChange={(e) => { setPriority(e.target.value); setPage(1); }} className="w-full sm:w-40">
            <option value="">كل الأولويات</option>
            {statusOptions(PRIORITY).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value)} className="w-full sm:w-40">
            <option value="created_at">الأحدث</option>
            <option value="name">الاسم</option>
            <option value="status">الحالة</option>
            <option value="priority">الأولوية</option>
            <option value="budget">الميزانية</option>
          </Select>
        </div>

        {loading ? (
          <div className="flex h-48 items-center justify-center"><Spinner className="h-7 w-7 text-indigo-600" /></div>
        ) : items.length === 0 ? (
          <EmptyState title="لا توجد مشاريع" description="ابدأ بإنشاء مشروع جديد." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs text-slate-500">
                    <th className="px-5 py-3 font-semibold">المشروع</th>
                    <th className="px-3 py-3 font-semibold">المدير</th>
                    <th className="px-3 py-3 font-semibold">الحالة</th>
                    <th className="px-3 py-3 font-semibold">الأولوية</th>
                    <th className="px-3 py-3 font-semibold">التقدم</th>
                    <th className="px-3 py-3 font-semibold">الميزانية</th>
                    <th className="px-3 py-3 font-semibold">النهاية</th>
                    <th className="px-5 py-3 font-semibold">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {items.map((p) => (
                    <tr key={p.id} className="group hover:bg-slate-50/70">
                      <td className="px-5 py-3">
                        <Link to={`/projects/${p.id}`} className="block">
                          <div className="font-bold text-slate-800">{p.name}</div>
                          <div className="text-xs text-slate-400" dir="ltr">{p.code || "—"}</div>
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-slate-600">{p.manager_name || "—"}</td>
                      <td className="px-3 py-3">
                        <Badge className={PROJECT_STATUS[p.status]?.color}>
                          <Dot className={PROJECT_STATUS[p.status]?.dot} />
                          {PROJECT_STATUS[p.status]?.label}
                        </Badge>
                      </td>
                      <td className="px-3 py-3">
                        <Badge className={PRIORITY[p.priority]?.color}>{PRIORITY[p.priority]?.label}</Badge>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-indigo-500" style={{ width: `${p.progress}%` }} />
                          </div>
                          <span className="text-xs font-bold text-slate-600">{p.progress}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 font-semibold text-slate-700">{money(p.budget)}</td>
                      <td className="px-3 py-3 text-slate-500">{formatDate(p.end_date)}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1">
                          <Link to={`/projects/${p.id}`} className="rounded-md p-1.5 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600" aria-label="عرض">
                            <Eye className="h-4 w-4" />
                          </Link>
                          {canEdit(p) && (
                            <button onClick={() => openEdit(p)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="تعديل">
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}
                          {canDelete(p) && (
                            <button onClick={() => setDeleting(p)} className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="حذف">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={pagination.current_page}
              lastPage={pagination.last_page}
              total={pagination.total}
              perPage={pagination.per_page}
              onPage={setPage}
            />
          </>
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "تعديل المشروع" : "مشروع جديد"}
        wide
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>إلغاء</Button>
            <Button onClick={save} loading={saving}>حفظ</Button>
          </>
        }
      >
        <form onSubmit={save} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="اسم المشروع *">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </Field>
          </div>
          <Field label="كود المشروع">
            <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          </Field>
          <Field label="المدير">
            <Select value={form.manager_id} onChange={(e) => setForm({ ...form, manager_id: e.target.value })}>
              <option value="">— اختر المدير —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="الوصف">
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
          </div>
          <Field label="الحالة">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {statusOptions(PROJECT_STATUS).map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="الأولوية">
            <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              {statusOptions(PRIORITY).map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="تاريخ البداية">
            <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
          </Field>
          <Field label="تاريخ النهاية">
            <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
          </Field>
          <Field label="الميزانية">
            <Input type="number" min="0" step="0.01" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} />
          </Field>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        loading={deleteLoading}
        title="حذف المشروع"
        message={`هل أنت متأكد من حذف المشروع "${deleting?.name}"؟ سيتم حذف جميع المهام والمصروفات والاجتماعات المرتبطة به.`}
      />
    </div>
  );
}
