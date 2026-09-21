import { useCallback, useEffect, useState, type FormEvent } from "react";
import { CalendarClock, Pencil, Plus, Trash2 } from "lucide-react";
import { api, ApiError } from "../lib/api";
import {
  Badge, Button, Card, ConfirmDialog, EmptyState, Field, Input, Modal, PageHeader,
  Pagination, SearchInput, Select, Spinner, Textarea, toast,
} from "../components/ui";
import { formatDate, timeOnly } from "../lib/format";
import type { Meeting, Project } from "../lib/types";
import { useAuth } from "../lib/auth";

const EMPTY = { project_id: "", title: "", description: "", meeting_date: "", start_time: "", end_time: "", location: "", meeting_url: "" };

export default function Meetings() {
  const { user } = useAuth();
  const [items, setItems] = useState<Meeting[]>([]);
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, total: 0, per_page: 20 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [upcoming, setUpcoming] = useState(false);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Meeting | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Meeting | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const isManager = user?.role !== "team_member";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), per_page: "15" });
      if (search) params.set("search", search);
      if (projectFilter) params.set("project_id", projectFilter);
      if (upcoming) params.set("upcoming", "1");
      const res = await api<any[]>(`/meetings?${params.toString()}`);
      setItems(res.data);
      setPagination(res.pagination);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "تعذر تحميل الاجتماعات.", "error");
    } finally {
      setLoading(false);
    }
  }, [page, search, projectFilter, upcoming]);

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
  function openEdit(m: Meeting) {
    setEditing(m);
    setForm({ project_id: String(m.project_id), title: m.title, description: m.description || "", meeting_date: m.meeting_date || "", start_time: m.start_time || "", end_time: m.end_time || "", location: m.location || "", meeting_url: m.meeting_url || "" });
    setModalOpen(true);
  }

  async function save(ev: FormEvent) {
    ev.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await api(`/meetings/${editing.id}`, { method: "PUT", body: form });
        toast("تم تحديث الاجتماع بنجاح.");
      } else {
        await api("/meetings", { method: "POST", body: form });
        toast("تم إنشاء الاجتماع بنجاح.");
      }
      setModalOpen(false);
      load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "تعذر حفظ الاجتماع.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleteLoading(true);
    try {
      await api(`/meetings/${toDelete.id}`, { method: "DELETE" });
      toast("تم حذف الاجتماع بنجاح.");
      setToDelete(null);
      load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "تعذر حذف الاجتماع.", "error");
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div>
      <PageHeader title="الاجتماعات" subtitle={`إجمالي ${pagination.total} اجتماع`}
        actions={isManager && <Button onClick={openCreate}><Plus className="h-4 w-4" /> اجتماع جديد</Button>} />

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-4">
          <SearchInput value={search} onChange={setSearch} placeholder="ابحث في الاجتماعات..." className="w-full sm:w-56" />
          <Select value={projectFilter} onChange={(e) => { setProjectFilter(e.target.value); setPage(1); }} className="w-full sm:w-48">
            <option value="">كل المشاريع</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={upcoming} onChange={(e) => setUpcoming(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-indigo-600" />
            القادمة فقط
          </label>
        </div>

        {loading ? (
          <div className="flex h-48 items-center justify-center"><Spinner className="h-7 w-7 text-indigo-600" /></div>
        ) : items.length === 0 ? (
          <EmptyState title="لا توجد اجتماعات" description="لم يتم العثور على اجتماعات." />
        ) : (
          <>
            <ul className="divide-y divide-slate-50">
              {items.map((m) => {
                const isPast = m.meeting_date && m.meeting_date < new Date().toISOString().slice(0, 10);
                return (
                  <li key={m.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                      <CalendarClock className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800">{m.title}</span>
                        {isPast ? <Badge className="bg-slate-100 text-slate-500 border-slate-200">منتهي</Badge> : <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">قادم</Badge>}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-400">
                        {m.project_name} · {formatDate(m.meeting_date)} · {timeOnly(m.start_time)} — {timeOnly(m.end_time)}
                      </div>
                    </div>
                    <div className="text-xs text-slate-500">{m.location || "بدون مكان"}</div>
                    {m.meeting_url && (
                      <a href={m.meeting_url} target="_blank" rel="noreferrer" dir="ltr" className="text-xs font-semibold text-indigo-600 hover:underline">رابط</a>
                    )}
                    <div className="flex items-center gap-1">
                      {isManager && (
                        <button onClick={() => openEdit(m)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="تعديل"><Pencil className="h-4 w-4" /></button>
                      )}
                      {isManager && (
                        <button onClick={() => setToDelete(m)} className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="حذف"><Trash2 className="h-4 w-4" /></button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            <Pagination page={pagination.current_page} lastPage={pagination.last_page} total={pagination.total} perPage={pagination.per_page} onPage={setPage} />
          </>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "تعديل الاجتماع" : "اجتماع جديد"}
        footer={<><Button variant="secondary" onClick={() => setModalOpen(false)}>إلغاء</Button><Button onClick={save} loading={saving}>حفظ</Button></>}>
        <form onSubmit={save} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="المشروع *">
            <Select value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })} required disabled={!!editing}>
              <option value="">— اختر المشروع —</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
          <Field label="عنوان الاجتماع *"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></Field>
          <div className="sm:col-span-2"><Field label="الوصف"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field></div>
          <Field label="التاريخ"><Input type="date" value={form.meeting_date} onChange={(e) => setForm({ ...form, meeting_date: e.target.value })} /></Field>
          <Field label="المكان"><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
          <Field label="وقت البداية"><Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></Field>
          <Field label="وقت النهاية"><Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} /></Field>
          <div className="sm:col-span-2"><Field label="رابط الاجتماع"><Input dir="ltr" value={form.meeting_url} onChange={(e) => setForm({ ...form, meeting_url: e.target.value })} /></Field></div>
        </form>
      </Modal>

      <ConfirmDialog open={!!toDelete} onClose={() => setToDelete(null)} onConfirm={confirmDelete} loading={deleteLoading}
        title="حذف الاجتماع" message={`هل أنت متأكد من حذف الاجتماع "${toDelete?.title}"؟`} />
    </div>
  );
}
