import { useCallback, useEffect, useState, type FormEvent } from "react";
import { MessageSquare, Pencil, Plus, Trash2 } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import {
  Badge, Button, Card, ConfirmDialog, EmptyState, Field, Input, Modal, PageHeader,
  Pagination, SearchInput, Select, Spinner, Textarea, toast,
} from "../components/ui";
import { PRIORITY, TASK_STATUS, statusOptions } from "../lib/constants";
import { formatDate, formatDateTime, isOverdue, initials } from "../lib/format";
import type { Task, Project, User } from "../lib/types";

const EMPTY_TASK = { project_id: "", title: "", description: "", assigned_to: "", status: "todo", priority: "medium", start_date: "", due_date: "", progress: "0" };

interface Comment {
  id: number;
  comment: string;
  user_name: string;
  created_at: string;
}

export default function Tasks() {
  const { user } = useAuth();
  const [items, setItems] = useState<Task[]>([]);
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, total: 0, per_page: 20 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [form, setForm] = useState(EMPTY_TASK);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Task | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [viewing, setViewing] = useState<Task | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [commentsLoading, setCommentsLoading] = useState(false);

  const isTeamMember = user?.role === "team_member";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), per_page: "15" });
      if (search) params.set("search", search);
      if (status) params.set("status", status);
      if (priority) params.set("priority", priority);
      if (projectFilter) params.set("project_id", projectFilter);
      const res = await api<any[]>(`/tasks?${params.toString()}`);
      setItems(res.data);
      setPagination(res.pagination);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "تعذر تحميل المهام.", "error");
    } finally {
      setLoading(false);
    }
  }, [page, search, status, priority, projectFilter]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    api<any[]>("/projects?per_page=100").then((r) => setProjects(r.data)).catch(() => {});
    api<User[]>("/users/options").then((r) => setUsers(r.data)).catch(() => {});
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_TASK);
    setModalOpen(true);
  }

  function openEdit(t: Task) {
    setEditing(t);
    setForm({
      project_id: String(t.project_id),
      title: t.title,
      description: t.description || "",
      assigned_to: t.assigned_to ? String(t.assigned_to) : "",
      status: t.status,
      priority: t.priority,
      start_date: t.start_date || "",
      due_date: t.due_date || "",
      progress: String(t.progress ?? 0),
    });
    setModalOpen(true);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await api(`/tasks/${editing.id}`, { method: "PUT", body: form });
        toast("تم تحديث المهمة بنجاح.");
      } else {
        await api("/tasks", { method: "POST", body: form });
        toast("تم إنشاء المهمة بنجاح.");
      }
      setModalOpen(false);
      load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "تعذر حفظ المهمة.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(t: Task, newStatus: string) {
    try {
      await api(`/tasks/${t.id}`, { method: "PUT", body: { status: newStatus } });
      toast("تم تحديث الحالة.");
      load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "تعذر تحديث الحالة.", "error");
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleteLoading(true);
    try {
      await api(`/tasks/${toDelete.id}`, { method: "DELETE" });
      toast("تم حذف المهمة بنجاح.");
      setToDelete(null);
      load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "تعذر حذف المهمة.", "error");
    } finally {
      setDeleteLoading(false);
    }
  }

  async function openComments(t: Task) {
    setViewing(t);
    setComments([]);
    setNewComment("");
    setCommentsLoading(true);
    try {
      const res = await api<Comment[]>(`/tasks/${t.id}/comments`);
      setComments(res.data);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "تعذر تحميل التعليقات.", "error");
    } finally {
      setCommentsLoading(false);
    }
  }

  async function addComment() {
    if (!viewing || !newComment.trim()) return;
    try {
      await api(`/tasks/${viewing.id}/comments`, { method: "POST", body: { comment: newComment } });
      setNewComment("");
      const res = await api<Comment[]>(`/tasks/${viewing.id}/comments`);
      setComments(res.data);
      toast("تمت إضافة التعليق.");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "تعذر إضافة التعليق.", "error");
    }
  }

  return (
    <div>
      <PageHeader
        title="المهام"
        subtitle={isTeamMember ? "المهام المخصصة لك" : `إجمالي ${pagination.total} مهمة`}
        actions={!isTeamMember && (
          <Button onClick={openCreate}><Plus className="h-4 w-4" /> مهمة جديدة</Button>
        )}
      />

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-4">
          <SearchInput value={search} onChange={setSearch} placeholder="ابحث في المهام..." className="w-full sm:w-56" />
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-full sm:w-40">
            <option value="">كل الحالات</option>
            {statusOptions(TASK_STATUS).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
          <Select value={priority} onChange={(e) => { setPriority(e.target.value); setPage(1); }} className="w-full sm:w-40">
            <option value="">كل الأولويات</option>
            {statusOptions(PRIORITY).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
          <Select value={projectFilter} onChange={(e) => { setProjectFilter(e.target.value); setPage(1); }} className="w-full sm:w-48">
            <option value="">كل المشاريع</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </div>

        {loading ? (
          <div className="flex h-48 items-center justify-center"><Spinner className="h-7 w-7 text-indigo-600" /></div>
        ) : items.length === 0 ? (
          <EmptyState title="لا توجد مهام" description="لم يتم العثور على مهام مطابقة." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs text-slate-500">
                    <th className="px-5 py-3 font-semibold">المهمة</th>
                    <th className="px-3 py-3 font-semibold">المشروع</th>
                    <th className="px-3 py-3 font-semibold">المسؤول</th>
                    <th className="px-3 py-3 font-semibold">الأولوية</th>
                    <th className="px-3 py-3 font-semibold">الحالة</th>
                    <th className="px-3 py-3 font-semibold">التسليم</th>
                    <th className="px-5 py-3 font-semibold">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {items.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800">{t.title}</span>
                          {isOverdue(t) && <Badge className="bg-rose-50 text-rose-700 border-rose-200">متأخرة</Badge>}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-500">{t.project_name}</td>
                      <td className="px-3 py-3 text-slate-600">{t.assignee_name || "—"}</td>
                      <td className="px-3 py-3"><Badge className={PRIORITY[t.priority]?.color}>{PRIORITY[t.priority]?.label}</Badge></td>
                      <td className="px-3 py-3">
                        <Select value={t.status} onChange={(e) => updateStatus(t, e.target.value)} className="w-36 py-1.5 text-xs">
                          {statusOptions(TASK_STATUS).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </Select>
                      </td>
                      <td className="px-3 py-3 text-slate-500">{formatDate(t.due_date)}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openComments(t)} className="rounded-md p-1.5 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600" aria-label="التعليقات">
                            <MessageSquare className="h-4 w-4" />
                          </button>
                          {!isTeamMember && (
                            <button onClick={() => openEdit(t)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="تعديل">
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}
                          {!isTeamMember && (
                            <button onClick={() => setToDelete(t)} className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="حذف">
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
            <Pagination page={pagination.current_page} lastPage={pagination.last_page} total={pagination.total} perPage={pagination.per_page} onPage={setPage} />
          </>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "تعديل المهمة" : "مهمة جديدة"} wide
        footer={<><Button variant="secondary" onClick={() => setModalOpen(false)}>إلغاء</Button><Button onClick={save} loading={saving}>حفظ</Button></>}>
        <form onSubmit={save} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="المشروع *">
            <Select value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })} required disabled={!!editing}>
              <option value="">— اختر المشروع —</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
          <Field label="عنوان المهمة *"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></Field>
          <Field label="المسؤول"><Select value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}><option value="">— بدون —</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></Field>
          <Field label="الأولوية"><Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>{statusOptions(PRIORITY).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></Field>
          <Field label="الحالة"><Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{statusOptions(TASK_STATUS).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></Field>
          <Field label="نسبة الإنجاز"><Input type="number" min="0" max="100" value={form.progress} onChange={(e) => setForm({ ...form, progress: e.target.value })} /></Field>
          <Field label="تاريخ البداية"><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></Field>
          <Field label="تاريخ التسليم"><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></Field>
          <div className="sm:col-span-2"><Field label="الوصف"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field></div>
        </form>
      </Modal>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing?.title || "تفاصيل المهمة"} wide>
        {viewing && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <div><div className="text-xs text-slate-400">المشروع</div><div className="font-bold text-slate-700">{viewing.project_name}</div></div>
              <div><div className="text-xs text-slate-400">المسؤول</div><div className="font-bold text-slate-700">{viewing.assignee_name || "—"}</div></div>
              <div><div className="text-xs text-slate-400">الحالة</div><div className="font-bold text-slate-700">{TASK_STATUS[viewing.status]?.label}</div></div>
              <div><div className="text-xs text-slate-400">الأولوية</div><div className="font-bold text-slate-700">{PRIORITY[viewing.priority]?.label}</div></div>
              <div><div className="text-xs text-slate-400">التسليم</div><div className="font-bold text-slate-700">{formatDate(viewing.due_date)}</div></div>
              <div><div className="text-xs text-slate-400">التقدم</div><div className="font-bold text-slate-700">{viewing.progress}%</div></div>
            </div>
            {viewing.description && <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{viewing.description}</p>}

            <div>
              <h4 className="mb-2 text-sm font-bold text-slate-700">التعليقات ({comments.length})</h4>
              {commentsLoading ? (
                <div className="flex justify-center py-4"><Spinner className="h-5 w-5 text-indigo-600" /></div>
              ) : comments.length === 0 ? (
                <p className="py-3 text-center text-sm text-slate-400">لا توجد تعليقات بعد.</p>
              ) : (
                <ul className="space-y-2">
                  {comments.map((c) => (
                    <li key={c.id} className="flex gap-3 rounded-lg border border-slate-100 p-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                        {initials(c.user_name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-700">{c.user_name}</span>
                          <span className="text-[11px] text-slate-400">{formatDateTime(c.created_at)}</span>
                        </div>
                        <p className="mt-1 text-sm text-slate-600">{c.comment}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3 flex gap-2">
                <Input value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="اكتب تعليقاً..." onKeyDown={(e) => e.key === "Enter" && addComment()} />
                <Button onClick={addComment}>إضافة</Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!toDelete} onClose={() => setToDelete(null)} onConfirm={confirmDelete} loading={deleteLoading}
        title="حذف المهمة" message={`هل أنت متأكد من حذف المهمة "${toDelete?.title}"؟`} />
    </div>
  );
}
