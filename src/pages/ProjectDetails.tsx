import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowRight, CalendarDays, Plus, Trash2, UserPlus, Wallet,
} from "lucide-react";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import {
  Badge, Button, Card, ConfirmDialog, Dot, EmptyState, Field, Input, Modal,
  Select, Spinner, Textarea, toast,
} from "../components/ui";
import { PROJECT_STATUS, PRIORITY, TASK_STATUS, MEMBER_ROLES, statusOptions, EXPENSE_CATEGORIES } from "../lib/constants";
import { formatDate, money, timeOnly, isOverdue } from "../lib/format";
import type { Project, Member, Task, Expense, Meeting, User } from "../lib/types";

const TABS = ["نظرة عامة", "الفريق", "المهام", "المصروفات", "الاجتماعات"];

const EMPTY_TASK = { title: "", description: "", assigned_to: "", status: "todo", priority: "medium", start_date: "", due_date: "", progress: "0" };
const EMPTY_EXPENSE = { title: "", description: "", amount: "", category: "", expense_date: "" };
const EMPTY_MEETING = { title: "", description: "", meeting_date: "", start_time: "", end_time: "", location: "", meeting_url: "" };

export default function ProjectDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const projectId = Number(id);

  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // modals
  const [taskModal, setTaskModal] = useState(false);
  const [taskForm, setTaskForm] = useState(EMPTY_TASK);
  const [expenseModal, setExpenseModal] = useState(false);
  const [expenseForm, setExpenseForm] = useState(EMPTY_EXPENSE);
  const [meetingModal, setMeetingModal] = useState(false);
  const [meetingForm, setMeetingForm] = useState(EMPTY_MEETING);
  const [memberModal, setMemberModal] = useState(false);
  const [memberForm, setMemberForm] = useState({ user_id: "", project_role: "member" });
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<{ kind: string; id: number; label: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const canManage = project && (user?.role === "system_admin" || project.manager_id === user?.id || project.created_by === user?.id);
  const canManageTasks = canManage || user?.role === "team_leader";

  const load = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const [p, m, t, e, mt, u] = await Promise.all([
        api<Project>(`/projects/${projectId}`),
        api<Member[]>(`/projects/${projectId}/members`).catch(() => ({ data: [] as Member[] })),
        api<any[]>(`/tasks?project_id=${projectId}&per_page=100`).catch(() => ({ data: [] as Task[] })),
        api<Expense[]>(`/expenses/projects/${projectId}`).catch(() => ({ data: [] as Expense[] })),
        api<any[]>(`/meetings?project_id=${projectId}&per_page=50`).catch(() => ({ data: [] as Meeting[] })),
        api<User[]>("/users/options").catch(() => ({ data: [] as User[] })),
      ]);
      setProject(p.data);
      setMembers(m.data || []);
      setTasks(t.data || []);
      setExpenses(e.data || []);
      setMeetings(mt.data || []);
      setUsers(u.data || []);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 403 || err.status === 404)) setNotFound(true);
      else toast(err instanceof ApiError ? err.message : "تعذر تحميل المشروع.", "error");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveTask(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api("/tasks", { method: "POST", body: { ...taskForm, project_id: projectId } });
      toast("تم إنشاء المهمة بنجاح.");
      setTaskModal(false);
      setTaskForm(EMPTY_TASK);
      load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "تعذر إنشاء المهمة.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function saveExpense(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api(`/expenses/projects/${projectId}`, { method: "POST", body: expenseForm });
      toast("تمت إضافة المصروف بنجاح.");
      setExpenseModal(false);
      setExpenseForm(EMPTY_EXPENSE);
      load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "تعذر إضافة المصروف.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function saveMeeting(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api("/meetings", { method: "POST", body: { ...meetingForm, project_id: projectId } });
      toast("تم إنشاء الاجتماع بنجاح.");
      setMeetingModal(false);
      setMeetingForm(EMPTY_MEETING);
      load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "تعذر إنشاء الاجتماع.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function saveMember(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api(`/projects/${projectId}/members`, { method: "POST", body: memberForm });
      toast("تمت إضافة العضو بنجاح.");
      setMemberModal(false);
      setMemberForm({ user_id: "", project_role: "member" });
      load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "تعذر إضافة العضو.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function updateTaskStatus(task: Task, status: string) {
    try {
      await api(`/tasks/${task.id}`, { method: "PUT", body: { status } });
      toast("تم تحديث حالة المهمة.");
      load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "تعذر تحديث المهمة.", "error");
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleteLoading(true);
    try {
      if (toDelete.kind === "task") await api(`/tasks/${toDelete.id}`, { method: "DELETE" });
      if (toDelete.kind === "expense") await api(`/expenses/${toDelete.id}`, { method: "DELETE" });
      if (toDelete.kind === "meeting") await api(`/meetings/${toDelete.id}`, { method: "DELETE" });
      if (toDelete.kind === "member") await api(`/projects/${projectId}/members/${toDelete.id}`, { method: "DELETE" });
      toast("تم الحذف بنجاح.");
      setToDelete(null);
      load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "تعذر الحذف.", "error");
    } finally {
      setDeleteLoading(false);
    }
  }

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><Spinner className="h-8 w-8 text-indigo-600" /></div>;
  }

  if (notFound || !project) {
    return (
      <EmptyState
        title="لا يمكن الوصول إلى هذا المشروع"
        description="إما أن المشروع غير موجود أو لا تملك صلاحية الوصول إليه."
        action={<Link to="/projects"><Button variant="secondary"><ArrowRight className="h-4 w-4" /> العودة للمشاريع</Button></Link>}
      />
    );
  }

  const remaining = Math.max(0, project.budget - (project.expenses_total || 0));
  const expensePercent = project.budget > 0 ? Math.round(((project.expenses_total || 0) / project.budget) * 100) : 0;
  const memberIds = new Set(members.map((m) => m.user_id));
  const availableUsers = users.filter((u) => !memberIds.has(u.id));

  return (
    <div>
      <div className="mb-4">
        <Link to="/projects" className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:underline">
          <ArrowRight className="h-4 w-4" /> المشاريع
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-extrabold text-slate-900">{project.name}</h1>
            <Badge className={PROJECT_STATUS[project.status]?.color}>
              <Dot className={PROJECT_STATUS[project.status]?.dot} />
              {PROJECT_STATUS[project.status]?.label}
            </Badge>
            <Badge className={PRIORITY[project.priority]?.color}>{PRIORITY[project.priority]?.label}</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">{project.description || "لا يوجد وصف"}</p>
        </div>
        <div className="flex gap-2">
          {canManageTasks && (
            <Button onClick={() => setTaskModal(true)}>
              <Plus className="h-4 w-4" /> مهمة
            </Button>
          )}
        </div>
      </div>

      <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {TABS.map((t, i) => (
          <button
            key={t}
            onClick={() => setTab(i)}
            className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              tab === i ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card title="معلومات المشروع" className="lg:col-span-2">
            <dl className="grid grid-cols-2 gap-4 p-5 text-sm sm:grid-cols-3">
              <Info label="الكود" value={<span dir="ltr">{project.code || "—"}</span>} />
              <Info label="المدير" value={project.manager_name || "—"} />
              <Info label="تاريخ البداية" value={formatDate(project.start_date)} />
              <Info label="تاريخ النهاية" value={formatDate(project.end_date)} />
              <Info label="نسبة الإنجاز" value={`${project.progress}%`} />
              <Info label="عدد المهام" value={`${project.tasks_total || 0} (${project.tasks_completed || 0} مكتملة)`} />
            </dl>
            <div className="px-5 pb-5">
              <div className="mb-1 flex justify-between text-xs font-semibold text-slate-500">
                <span>التقدم</span>
                <span>{project.progress}%</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-indigo-500" style={{ width: `${project.progress}%` }} />
              </div>
            </div>
          </Card>

          <Card title="الميزانية">
            <div className="space-y-4 p-5">
              <MoneyRow label="الميزانية" value={money(project.budget)} />
              <MoneyRow label="إجمالي المصروفات" value={money(project.expenses_total || 0)} />
              <MoneyRow label="المتبقي" value={money(remaining)} highlight />
              <div>
                <div className="mb-1 flex justify-between text-xs font-semibold text-slate-500">
                  <span>نسبة الإنفاق</span>
                  <span>{expensePercent}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${expensePercent > 100 ? "bg-rose-500" : "bg-amber-500"}`} style={{ width: `${Math.min(100, expensePercent)}%` }} />
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {tab === 1 && (
        <Card
          title={`أعضاء الفريق (${members.length})`}
          action={canManage && <Button size="sm" onClick={() => setMemberModal(true)}><UserPlus className="h-4 w-4" /> إضافة عضو</Button>}
        >
          {members.length === 0 ? (
            <EmptyState title="لا يوجد أعضاء" description="أضف أعضاء الفريق للمشروع." />
          ) : (
            <ul className="divide-y divide-slate-50">
              {members.map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
                    {m.name?.slice(0, 1)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-slate-800">{m.name}</div>
                    <div className="text-xs text-slate-400" dir="ltr">{m.email}</div>
                  </div>
                  <Badge className="bg-slate-100 text-slate-600 border-slate-200">{MEMBER_ROLES[m.project_role] || m.project_role}</Badge>
                  {canManage && (
                    <button
                      onClick={() => setToDelete({ kind: "member", id: m.user_id, label: m.name })}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      aria-label="إزالة العضو"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === 2 && (
        <Card title={`المهام (${tasks.length})`}>
          {tasks.length === 0 ? (
            <EmptyState title="لا توجد مهام" description="أنشئ أول مهمة في هذا المشروع." />
          ) : (
            <ul className="divide-y divide-slate-50">
              {tasks.map((task) => (
                <li key={task.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-bold text-slate-800">{task.title}</span>
                      {isOverdue(task) && <Badge className="bg-rose-50 text-rose-700 border-rose-200">متأخرة</Badge>}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-400">
                      {task.assignee_name ? `المسؤول: ${task.assignee_name}` : "بدون مسؤول"} · تسليم: {formatDate(task.due_date)}
                    </div>
                  </div>
                  <Badge className={PRIORITY[task.priority]?.color}>{PRIORITY[task.priority]?.label}</Badge>
                  <Select
                    value={task.status}
                    onChange={(e) => updateTaskStatus(task, e.target.value)}
                    className="w-40 py-1.5 text-xs"
                  >
                    {statusOptions(TASK_STATUS).map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </Select>
                  {canManageTasks && (
                    <button
                      onClick={() => setToDelete({ kind: "task", id: task.id, label: task.title })}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      aria-label="حذف المهمة"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === 3 && (
        <Card
          title={`المصروفات (${expenses.length}) — الإجمالي: ${money(expenses.reduce((s, e) => s + (e.amount || 0), 0))}`}
          action={canManage && <Button size="sm" onClick={() => setExpenseModal(true)}><Plus className="h-4 w-4" /> إضافة مصروف</Button>}
        >
          {expenses.length === 0 ? (
            <EmptyState title="لا توجد مصروفات" description="سجّل مصروفات المشروع هنا." />
          ) : (
            <ul className="divide-y divide-slate-50">
              {expenses.map((ex) => (
                <li key={ex.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                    <Wallet className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-slate-800">{ex.title}</div>
                    <div className="text-xs text-slate-400">{ex.category || "بدون تصنيف"} · {formatDate(ex.expense_date)}</div>
                  </div>
                  <div className="font-bold text-slate-700">{money(ex.amount)}</div>
                  {canManage && (
                    <button
                      onClick={() => setToDelete({ kind: "expense", id: ex.id, label: ex.title })}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      aria-label="حذف المصروف"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === 4 && (
        <Card
          title={`الاجتماعات (${meetings.length})`}
          action={canManage && <Button size="sm" onClick={() => setMeetingModal(true)}><Plus className="h-4 w-4" /> اجتماع جديد</Button>}
        >
          {meetings.length === 0 ? (
            <EmptyState title="لا توجد اجتماعات" description="جدولة اجتماعات المشروع." />
          ) : (
            <ul className="divide-y divide-slate-50">
              {meetings.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                    <CalendarDays className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-slate-800">{m.title}</div>
                    <div className="text-xs text-slate-400">
                      {formatDate(m.meeting_date)} · {timeOnly(m.start_time)} — {timeOnly(m.end_time)} · {m.location || "بدون مكان"}
                    </div>
                  </div>
                  {m.meeting_url && (
                    <a href={m.meeting_url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-indigo-600 hover:underline" dir="ltr">
                      رابط الاجتماع
                    </a>
                  )}
                  {canManage && (
                    <button
                      onClick={() => setToDelete({ kind: "meeting", id: m.id, label: m.title })}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      aria-label="حذف الاجتماع"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {/* Task modal */}
      <Modal open={taskModal} onClose={() => setTaskModal(false)} title="مهمة جديدة" wide
        footer={<><Button variant="secondary" onClick={() => setTaskModal(false)}>إلغاء</Button><Button onClick={saveTask} loading={saving}>حفظ</Button></>}>
        <form onSubmit={saveTask} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="عنوان المهمة *"><Input value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} required /></Field></div>
          <div className="sm:col-span-2"><Field label="الوصف"><Textarea value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} /></Field></div>
          <Field label="المسؤول"><Select value={taskForm.assigned_to} onChange={(e) => setTaskForm({ ...taskForm, assigned_to: e.target.value })}><option value="">— بدون —</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></Field>
          <Field label="الأولوية"><Select value={taskForm.priority} onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}>{statusOptions(PRIORITY).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></Field>
          <Field label="الحالة"><Select value={taskForm.status} onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value })}>{statusOptions(TASK_STATUS).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></Field>
          <Field label="نسبة الإنجاز"><Input type="number" min="0" max="100" value={taskForm.progress} onChange={(e) => setTaskForm({ ...taskForm, progress: e.target.value })} /></Field>
          <Field label="تاريخ البداية"><Input type="date" value={taskForm.start_date} onChange={(e) => setTaskForm({ ...taskForm, start_date: e.target.value })} /></Field>
          <Field label="تاريخ التسليم"><Input type="date" value={taskForm.due_date} onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })} /></Field>
        </form>
      </Modal>

      {/* Expense modal */}
      <Modal open={expenseModal} onClose={() => setExpenseModal(false)} title="إضافة مصروف"
        footer={<><Button variant="secondary" onClick={() => setExpenseModal(false)}>إلغاء</Button><Button onClick={saveExpense} loading={saving}>حفظ</Button></>}>
        <form onSubmit={saveExpense} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="العنوان *"><Input value={expenseForm.title} onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })} required /></Field></div>
          <Field label="القيمة *"><Input type="number" min="0" step="0.01" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} required /></Field>
          <Field label="التصنيف"><Select value={expenseForm.category} onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}><option value="">— اختر —</option>{EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</Select></Field>
          <div className="sm:col-span-2"><Field label="الوصف"><Textarea value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })} /></Field></div>
          <Field label="التاريخ"><Input type="date" value={expenseForm.expense_date} onChange={(e) => setExpenseForm({ ...expenseForm, expense_date: e.target.value })} /></Field>
        </form>
      </Modal>

      {/* Meeting modal */}
      <Modal open={meetingModal} onClose={() => setMeetingModal(false)} title="اجتماع جديد"
        footer={<><Button variant="secondary" onClick={() => setMeetingModal(false)}>إلغاء</Button><Button onClick={saveMeeting} loading={saving}>حفظ</Button></>}>
        <form onSubmit={saveMeeting} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="عنوان الاجتماع *"><Input value={meetingForm.title} onChange={(e) => setMeetingForm({ ...meetingForm, title: e.target.value })} required /></Field></div>
          <div className="sm:col-span-2"><Field label="الوصف"><Textarea value={meetingForm.description} onChange={(e) => setMeetingForm({ ...meetingForm, description: e.target.value })} /></Field></div>
          <Field label="التاريخ"><Input type="date" value={meetingForm.meeting_date} onChange={(e) => setMeetingForm({ ...meetingForm, meeting_date: e.target.value })} /></Field>
          <Field label="المكان"><Input value={meetingForm.location} onChange={(e) => setMeetingForm({ ...meetingForm, location: e.target.value })} /></Field>
          <Field label="وقت البداية"><Input type="time" value={meetingForm.start_time} onChange={(e) => setMeetingForm({ ...meetingForm, start_time: e.target.value })} /></Field>
          <Field label="وقت النهاية"><Input type="time" value={meetingForm.end_time} onChange={(e) => setMeetingForm({ ...meetingForm, end_time: e.target.value })} /></Field>
          <div className="sm:col-span-2"><Field label="رابط الاجتماع"><Input dir="ltr" value={meetingForm.meeting_url} onChange={(e) => setMeetingForm({ ...meetingForm, meeting_url: e.target.value })} /></Field></div>
        </form>
      </Modal>

      {/* Member modal */}
      <Modal open={memberModal} onClose={() => setMemberModal(false)} title="إضافة عضو"
        footer={<><Button variant="secondary" onClick={() => setMemberModal(false)}>إلغاء</Button><Button onClick={saveMember} loading={saving}>إضافة</Button></>}>
        <form onSubmit={saveMember} className="grid grid-cols-1 gap-4">
          <Field label="المستخدم *">
            <Select value={memberForm.user_id} onChange={(e) => setMemberForm({ ...memberForm, user_id: e.target.value })} required>
              <option value="">— اختر مستخدماً —</option>
              {availableUsers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Select>
          </Field>
          <Field label="الدور في المشروع">
            <Select value={memberForm.project_role} onChange={(e) => setMemberForm({ ...memberForm, project_role: e.target.value })}>
              <option value="member">عضو</option>
              <option value="leader">قائد فريق</option>
              <option value="manager">مدير</option>
            </Select>
          </Field>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        loading={deleteLoading}
        title="تأكيد الحذف"
        message={`هل أنت متأكد من حذف "${toDelete?.label}"؟`}
      />
    </div>
  );
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm font-bold text-slate-700">{value}</dd>
    </div>
  );
}

function MoneyRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={`text-sm font-extrabold ${highlight ? "text-indigo-700" : "text-slate-700"}`}>{value}</span>
    </div>
  );
}
