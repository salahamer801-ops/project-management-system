import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { Badge, Button, Card, Dot, EmptyState, PageHeader, Spinner, toast } from "../components/ui";
import { PROJECT_STATUS, PRIORITY, TASK_STATUS } from "../lib/constants";
import { formatDate, formatDateTime, money } from "../lib/format";
import { useAuth } from "../lib/auth";
import type { Task } from "../lib/types";

const TABS = ["تقرير المشاريع", "تقرير المهام", "التقرير المالي", "تقرير الأنشطة"];

function exportCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const { user } = useAuth();
  const [tab, setTab] = useState(0);
  const [projects, setProjects] = useState<any[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [financial, setFinancial] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    async function load() {
      try {
        const [p, t, f, a] = await Promise.all([
          api<any[]>("/reports/projects"),
          api<any[]>("/reports/tasks"),
          api<any[]>("/reports/financial"),
          api<any[]>("/reports/activity").catch(() => ({ data: [] as any[] })),
        ]);
        if (!active) return;
        setProjects(p.data);
        setTasks(t.data);
        setFinancial(f.data);
        setActivity(a.data);
      } catch (err) {
        if (active) toast(err instanceof ApiError ? err.message : "تعذر تحميل التقارير.", "error");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><Spinner className="h-8 w-8 text-indigo-600" /></div>;
  }

  const isAdmin = user?.role === "system_admin";

  return (
    <div>
      <PageHeader title="التقارير" subtitle="تقارير حقيقية مبنية على بيانات قاعدة البيانات" />

      <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {TABS.map((t, i) => (
          <button
            key={t}
            onClick={() => setTab(i)}
            className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${tab === i ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 0 && (
        <Card
          title="تقرير المشاريع"
          action={
            <Button variant="secondary" size="sm" onClick={() => exportCSV("projects-report.csv",
              ["الاسم", "الكود", "المدير", "الحالة", "الأولوية", "التقدم%", "المهام", "الميزانية", "المصروفات", "المتبقي", "نسبة الإنفاق%"],
              projects.map((p) => [p.name, p.code || "", p.manager_name || "", PROJECT_STATUS[p.status]?.label || "", PRIORITY[p.priority]?.label || "", p.progress, `${p.tasks_completed}/${p.tasks_total}`, p.budget, p.expenses_total, p.remaining, p.expense_percentage])
            )}>
              <Download className="h-4 w-4" /> تصدير CSV
            </Button>
          }
        >
          {projects.length === 0 ? (
            <EmptyState title="لا توجد بيانات" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs text-slate-500">
                    <th className="px-5 py-3">المشروع</th>
                    <th className="px-3 py-3">المدير</th>
                    <th className="px-3 py-3">الحالة</th>
                    <th className="px-3 py-3">التقدم</th>
                    <th className="px-3 py-3">الميزانية</th>
                    <th className="px-3 py-3">المصروفات</th>
                    <th className="px-3 py-3">المتبقي</th>
                    <th className="px-3 py-3">الإنفاق</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {projects.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3 font-bold text-slate-800">{p.name}</td>
                      <td className="px-3 py-3 text-slate-500">{p.manager_name || "—"}</td>
                      <td className="px-3 py-3"><Badge className={PROJECT_STATUS[p.status]?.color}><Dot className={PROJECT_STATUS[p.status]?.dot} />{PROJECT_STATUS[p.status]?.label}</Badge></td>
                      <td className="px-3 py-3 font-bold text-slate-700">{p.progress}%</td>
                      <td className="px-3 py-3 text-slate-600">{money(p.budget)}</td>
                      <td className="px-3 py-3 text-slate-600">{money(p.expenses_total)}</td>
                      <td className="px-3 py-3 font-bold text-slate-700">{money(p.remaining)}</td>
                      <td className="px-3 py-3 text-slate-600">{p.expense_percentage}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === 1 && (
        <Card
          title="تقرير المهام"
          action={
            <Button variant="secondary" size="sm" onClick={() => exportCSV("tasks-report.csv",
              ["العنوان", "المشروع", "المسؤول", "الحالة", "الأولوية", "التسليم", "التقدم%"],
              tasks.map((t) => [t.title, t.project_name || "", t.assignee_name || "", TASK_STATUS[t.status]?.label || "", PRIORITY[t.priority]?.label || "", t.due_date || "", t.progress])
            )}>
              <Download className="h-4 w-4" /> تصدير CSV
            </Button>
          }
        >
          {tasks.length === 0 ? (
            <EmptyState title="لا توجد بيانات" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs text-slate-500">
                    <th className="px-5 py-3">المهمة</th>
                    <th className="px-3 py-3">المشروع</th>
                    <th className="px-3 py-3">المسؤول</th>
                    <th className="px-3 py-3">الحالة</th>
                    <th className="px-3 py-3">الأولوية</th>
                    <th className="px-3 py-3">التسليم</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {tasks.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3 font-bold text-slate-800">{t.title}</td>
                      <td className="px-3 py-3 text-slate-500">{t.project_name}</td>
                      <td className="px-3 py-3 text-slate-500">{t.assignee_name || "—"}</td>
                      <td className="px-3 py-3"><Badge className={TASK_STATUS[t.status]?.color}>{TASK_STATUS[t.status]?.label}</Badge></td>
                      <td className="px-3 py-3"><Badge className={PRIORITY[t.priority]?.color}>{PRIORITY[t.priority]?.label}</Badge></td>
                      <td className="px-3 py-3 text-slate-500">{formatDate(t.due_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === 2 && (
        <Card
          title="التقرير المالي"
          action={
            <Button variant="secondary" size="sm" onClick={() => exportCSV("financial-report.csv",
              ["المشروع", "الميزانية", "المصروفات", "المتبقي", "نسبة الإنفاق%"],
              financial.map((f) => [f.name, f.budget, f.expenses_total, f.remaining, f.expense_percentage])
            )}>
              <Download className="h-4 w-4" /> تصدير CSV
            </Button>
          }
        >
          {financial.length === 0 ? (
            <EmptyState title="لا توجد بيانات مالية" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs text-slate-500">
                    <th className="px-5 py-3">المشروع</th>
                    <th className="px-3 py-3">الميزانية</th>
                    <th className="px-3 py-3">المصروفات</th>
                    <th className="px-3 py-3">المتبقي</th>
                    <th className="px-3 py-3">نسبة الإنفاق</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {financial.map((f) => (
                    <tr key={f.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3 font-bold text-slate-800">{f.name}</td>
                      <td className="px-3 py-3 text-slate-600">{money(f.budget)}</td>
                      <td className="px-3 py-3 text-slate-600">{money(f.expenses_total)}</td>
                      <td className="px-3 py-3 font-bold text-slate-700">{money(f.remaining)}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
                            <div className={`h-full rounded-full ${f.expense_percentage > 100 ? "bg-rose-500" : "bg-amber-500"}`} style={{ width: `${Math.min(100, f.expense_percentage)}%` }} />
                          </div>
                          <span className="text-xs font-bold text-slate-600">{f.expense_percentage}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === 3 && (
        <Card
          title="تقرير الأنشطة"
          action={
            isAdmin && (
              <Button variant="secondary" size="sm" onClick={() => exportCSV("activity-report.csv",
                ["الوصف", "المستخدم", "العملية", "التاريخ"],
                activity.map((a) => [a.description || "", a.user_name || "", a.action, a.created_at])
              )}>
                <Download className="h-4 w-4" /> تصدير CSV
              </Button>
            )
          }
        >
          {!isAdmin ? (
            <EmptyState title="غير مصرح" description="تقرير الأنشطة متاح لمدير النظام فقط." />
          ) : activity.length === 0 ? (
            <EmptyState title="لا توجد أنشطة" />
          ) : (
            <ul className="divide-y divide-slate-50">
              {activity.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-5 py-3">
                  <Dot className="bg-indigo-400" />
                  <div className="min-w-0 flex-1 text-sm text-slate-600">{a.description}</div>
                  <div className="text-xs text-slate-400">{a.user_name}</div>
                  <div className="text-xs text-slate-400">{formatDateTime(a.created_at)}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
