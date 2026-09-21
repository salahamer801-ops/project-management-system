import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../lib/api";
import { Badge, Dot, Spinner, toast } from "../components/ui";
import { PRIORITY, TASK_STATUS } from "../lib/constants";
import { formatDate, isOverdue } from "../lib/format";
import type { Task } from "../lib/types";

const COLUMNS = [
  { key: "todo", label: "لم تبدأ", count: 0 },
  { key: "in_progress", label: "قيد التنفيذ", count: 0 },
  { key: "review", label: "قيد المراجعة", count: 0 },
  { key: "completed", label: "مكتملة", count: 0 },
  { key: "cancelled", label: "ملغاة", count: 0 },
];

export default function Kanban() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api<any[]>("/tasks?per_page=100")
      .then((r) => active && setTasks(r.data))
      .catch((err) => active && toast(err instanceof ApiError ? err.message : "تعذر تحميل المهام.", "error"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const byColumn = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const c of COLUMNS) map[c.key] = [];
    for (const t of tasks) {
      if (map[t.status]) map[t.status].push(t);
    }
    return map;
  }, [tasks]);

  async function moveTask(taskId: number, status: string) {
    setDragging(null);
    setDragOver(null);
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)));
    try {
      await api(`/tasks/${taskId}`, { method: "PUT", body: { status } });
      toast("تم تحديث حالة المهمة.");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "تعذر نقل المهمة.", "error");
    }
  }

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><Spinner className="h-8 w-8 text-indigo-600" /></div>;
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-extrabold text-slate-900">لوحة كانبان</h1>
        <p className="mt-1 text-sm text-slate-500">اسحب المهمة وأفلتها في العمود المناسب لتحديث حالتها.</p>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((col) => {
          const items = byColumn[col.key] || [];
          return (
            <div
              key={col.key}
              onDragOver={(e) => { e.preventDefault(); setDragOver(col.key); }}
              onDragLeave={() => setDragOver((v) => (v === col.key ? null : v))}
              onDrop={() => dragging != null && moveTask(dragging, col.key)}
              className={`flex w-72 shrink-0 flex-col rounded-xl border bg-slate-50 transition-colors ${
                dragOver === col.key ? "border-indigo-400 bg-indigo-50/50" : "border-slate-200"
              }`}
            >
              <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
                <Dot className={TASK_STATUS[col.key]?.dot} />
                <span className="text-sm font-bold text-slate-700">{col.label}</span>
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-600">{items.length}</span>
              </div>

              <div className="scroll-thin flex min-h-[200px] flex-1 flex-col gap-2 overflow-y-auto p-3">
                {items.length === 0 && (
                  <div className="rounded-lg border border-dashed border-slate-300 py-6 text-center text-xs text-slate-400">
                    لا توجد مهام
                  </div>
                )}
                {items.map((t) => (
                  <div
                    key={t.id}
                    draggable
                    onDragStart={() => setDragging(t.id)}
                    onDragEnd={() => setDragging(null)}
                    className="cursor-grab rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-bold text-slate-800">{t.title}</span>
                      <Badge className={PRIORITY[t.priority]?.color}>{PRIORITY[t.priority]?.label}</Badge>
                    </div>
                    <div className="mt-1 text-xs text-slate-400">{t.project_name}</div>
                    {t.assignee_name && <div className="mt-2 text-xs text-slate-500">المسؤول: {t.assignee_name}</div>}
                    <div className="mt-2 flex items-center justify-between">
                      <span className={`text-xs font-semibold ${isOverdue(t) ? "text-rose-600" : "text-slate-400"}`}>
                        {formatDate(t.due_date)}
                      </span>
                      {isOverdue(t) && <Badge className="bg-rose-50 text-rose-700 border-rose-200">متأخرة</Badge>}
                    </div>
                    {t.progress > 0 && (
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-indigo-500" style={{ width: `${t.progress}%` }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
