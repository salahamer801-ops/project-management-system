import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  FolderKanban,
  ListTodo,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { api } from "../lib/api";
import { Card, PageHeader, StatCard, EmptyState, Spinner, Badge, Dot } from "../components/ui";
import { Chart } from "../components/Chart";
import { PROJECT_STATUS, TASK_STATUS } from "../lib/constants";
import { formatDate, money } from "../lib/format";
import { useAuth } from "../lib/auth";
import type { Meeting, Task } from "../lib/types";

const PALETTE = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#f43f5e", "#94a3b8"];

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [financial, setFinancial] = useState<any[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [d, f, t, m] = await Promise.all([
          api("/dashboard"),
          api<any[]>("/reports/financial").catch(() => ({ data: [] })),
          api<any[]>("/tasks?sort=due_date&dir=asc&per_page=50").catch(() => ({ data: [] })),
          api<any[]>("/meetings?upcoming=1&per_page=10").catch(() => ({ data: [] })),
        ]);
        if (!active) return;
        setData(d.data);
        setFinancial(f.data || []);
        setTasks((t.data || []).slice(0, 50));
        setMeetings((m.data || []).slice(0, 8));
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const projectDoughnut = useMemo(() => {
    const items = data?.charts?.project_status || [];
    return {
      labels: items.map((i: any) => PROJECT_STATUS[i.status]?.label || i.status),
      datasets: [
        {
          data: items.map((i: any) => i.c),
          backgroundColor: items.map((_: any, idx: number) => PALETTE[idx % PALETTE.length]),
          borderWidth: 0,
        },
      ],
    };
  }, [data]);

  const taskDoughnut = useMemo(() => {
    const items = data?.charts?.task_status || [];
    return {
      labels: items.map((i: any) => TASK_STATUS[i.status]?.label || i.status),
      datasets: [
        {
          data: items.map((i: any) => i.c),
          backgroundColor: items.map((_: any, idx: number) => PALETTE[idx % PALETTE.length]),
          borderWidth: 0,
        },
      ],
    };
  }, [data]);

  const monthlyLine = useMemo(() => {
    const items = data?.charts?.monthly_tasks || [];
    return {
      labels: items.map((i: any) => i.month),
      datasets: [
        {
          label: "مهام جديدة",
          data: items.map((i: any) => i.c),
          borderColor: "#6366f1",
          backgroundColor: "rgba(99,102,241,0.15)",
          fill: true,
          tension: 0.35,
        },
      ],
    };
  }, [data]);

  const financeBar = useMemo(() => {
    const top = financial.slice(0, 6);
    return {
      labels: top.map((f) => f.name),
      datasets: [
        { label: "الميزانية", data: top.map((f) => f.budget), backgroundColor: "#6366f1", borderRadius: 6 },
        { label: "المصروفات", data: top.map((f) => f.expenses_total), backgroundColor: "#f43f5e", borderRadius: 6 },
      ],
    };
  }, [financial]);

  const upcomingTasks = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return tasks
      .filter((t) => t.status !== "completed" && t.status !== "cancelled" && t.due_date)
      .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1))
      .slice(0, 6);
  }, [tasks]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="h-8 w-8 text-indigo-600" />
      </div>
    );
  }

  const kpi = data?.kpi || {};
  const p = kpi.projects || {};
  const t = kpi.tasks || {};

  return (
    <div>
      <PageHeader
        title={`مرحباً، ${user?.name?.split(" ")[0] || ""} 👋`}
        subtitle="نظرة عامة على المشاريع والمهام والميزانيات"
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="إجمالي المشاريع" value={p.total ?? 0} icon={<FolderKanban className="h-5 w-5" />} accent="bg-indigo-50 text-indigo-600" />
        <StatCard label="المشاريع النشطة" value={p.active ?? 0} icon={<TrendingUp className="h-5 w-5" />} accent="bg-emerald-50 text-emerald-600" />
        <StatCard label="المشاريع المتأخرة" value={p.overdue ?? 0} icon={<AlertTriangle className="h-5 w-5" />} accent="bg-amber-50 text-amber-600" />
        <StatCard label="المهام المكتملة" value={t.completed ?? 0} icon={<CheckCircle2 className="h-5 w-5" />} accent="bg-sky-50 text-sky-600" />
        <StatCard label="إجمالي المهام" value={t.total ?? 0} icon={<ListTodo className="h-5 w-5" />} accent="bg-purple-50 text-purple-600" />
        <StatCard label="المهام المتأخرة" value={t.overdue ?? 0} icon={<AlertTriangle className="h-5 w-5" />} accent="bg-rose-50 text-rose-600" />
        <StatCard label="إجمالي الميزانية" value={money(kpi.budget)} icon={<Wallet className="h-5 w-5" />} accent="bg-indigo-50 text-indigo-600" />
        <StatCard label="المتبقي من الميزانية" value={money(kpi.remaining)} icon={<Wallet className="h-5 w-5" />} accent="bg-emerald-50 text-emerald-600" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title="توزيع حالات المشاريع">
          <div className="p-4">
            {(data?.charts?.project_status?.length || 0) > 0 ? (
              <Chart type="doughnut" data={projectDoughnut} height={240} />
            ) : (
              <EmptyState title="لا توجد مشاريع" />
            )}
          </div>
        </Card>
        <Card title="توزيع حالات المهام">
          <div className="p-4">
            {(data?.charts?.task_status?.length || 0) > 0 ? (
              <Chart type="doughnut" data={taskDoughnut} height={240} />
            ) : (
              <EmptyState title="لا توجد مهام" />
            )}
          </div>
        </Card>
        <Card title="المهام الجديدة (آخر 6 أشهر)">
          <div className="p-4">
            <Chart type="line" data={monthlyLine} height={240} />
          </div>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card
          title="الميزانية مقابل المصروفات"
          action={<Link to="/reports" className="text-xs font-semibold text-indigo-600 hover:underline">التقارير</Link>}
        >
          <div className="p-4">
            {financial.length > 0 ? <Chart type="bar" data={financeBar} height={260} /> : <EmptyState title="لا توجد بيانات مالية" />}
          </div>
        </Card>

        <Card title="المواعيد القادمة" action={<Link to="/tasks" className="text-xs font-semibold text-indigo-600 hover:underline">المهام</Link>}>
          <div className="divide-y divide-slate-50 px-5 py-2">
            {upcomingTasks.length === 0 && <EmptyState title="لا توجد مواعيد قادمة" />}
            {upcomingTasks.map((task) => {
              const isLate = task.due_date && new Date(task.due_date) < new Date(new Date().setHours(0, 0, 0, 0));
              return (
                <Link key={task.id} to="/tasks" className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-slate-700">{task.title}</div>
                    <div className="text-xs text-slate-400">{task.project_name}</div>
                  </div>
                  <Badge className={isLate ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-slate-100 text-slate-600 border-slate-200"}>
                    {formatDate(task.due_date)}
                  </Badge>
                </Link>
              );
            })}
          </div>
        </Card>

        <Card title="الاجتماعات القادمة" action={<Link to="/meetings" className="text-xs font-semibold text-indigo-600 hover:underline">الكل</Link>}>
          <div className="divide-y divide-slate-50 px-5 py-2">
            {meetings.length === 0 && <EmptyState title="لا توجد اجتماعات قادمة" />}
            {meetings.map((m) => (
              <div key={m.id} className="flex items-center gap-3 py-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <CalendarClock className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-slate-700">{m.title}</div>
                  <div className="text-xs text-slate-400">{m.project_name}</div>
                </div>
                <div className="text-xs font-semibold text-slate-500">{formatDate(m.meeting_date)}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {data?.recent_activity?.length > 0 && (
        <Card title="آخر الأنشطة" className="mt-6" action={<Link to="/activity" className="text-xs font-semibold text-indigo-600 hover:underline">سجل الأنشطة</Link>}>
          <div className="divide-y divide-slate-50 px-5 py-2">
            {data.recent_activity.map((a: any) => (
              <div key={a.id} className="flex items-center gap-3 py-2.5">
                <Dot className="bg-indigo-400" />
                <div className="min-w-0 flex-1 text-sm text-slate-600">{a.description}</div>
                <div className="text-xs text-slate-400">{formatDate(a.created_at)}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
