import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { Spinner, toast } from "../components/ui";
import { isOverdue } from "../lib/format";

const DAY_NAMES = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];

interface CalEvent {
  id: string;
  kind: "task" | "meeting";
  title: string;
  date: string;
  status?: string;
  project?: string;
}

export default function CalendarPage() {
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  useEffect(() => {
    let active = true;
    api<CalEvent[]>("/calendar")
      .then((r) => active && setEvents(r.data))
      .catch((err) => active && toast(err instanceof ApiError ? err.message : "تعذر تحميل التقويم.", "error"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const byDate = useMemo(() => {
    const map: Record<string, CalEvent[]> = {};
    for (const e of events) {
      const key = e.date?.slice(0, 10);
      if (key) (map[key] ||= []).push(e);
    }
    return map;
  }, [events]);

  const cells = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    // Saturday = 0 in our grid (JS getDay: 0=Sun)
    let offset = first.getDay(); // 0 Sun .. 6 Sat
    const satOffset = (offset + 1) % 7; // shift so Saturday=0
    const start = new Date(year, month, 1 - satOffset);
    const arr: Date[] = [];
    for (let i = 0; i < 42; i++) {
      arr.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
    }
    return arr;
  }, [cursor]);

  const monthLabel = cursor.toLocaleDateString("ar-EG", { month: "long", year: "numeric" });

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><Spinner className="h-8 w-8 text-indigo-600" /></div>;
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">التقويم</h1>
          <p className="mt-1 text-sm text-slate-500">مواعيد المهام والاجتماعات</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} aria-label="الشهر السابق" className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50">
            <ChevronRight className="h-4 w-4" />
          </button>
          <span className="min-w-32 text-center text-sm font-bold text-slate-700">{monthLabel}</span>
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} aria-label="الشهر التالي" className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50">
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
          {DAY_NAMES.map((d) => (
            <div key={d} className="px-2 py-2.5 text-center text-xs font-bold text-slate-500">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((date, i) => {
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
            const dayEvents = byDate[key] || [];
            const inMonth = date.getMonth() === cursor.getMonth();
            const today = new Date();
            const isToday = date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
            return (
              <div key={i} className={`min-h-[92px] border-b border-l border-slate-100 p-1.5 ${inMonth ? "" : "bg-slate-50/60"} ${isToday ? "bg-indigo-50/40" : ""}`}>
                <div className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${isToday ? "bg-indigo-600 text-white" : "text-slate-600"}`}>
                  {date.getDate()}
                </div>
                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map((e) => {
                    const late = e.kind === "task" && isOverdue({ due_date: e.date, status: e.status || "" });
                    return (
                      <div
                        key={e.id}
                        title={`${e.title} — ${e.project || ""}`}
                        className={`truncate rounded px-1.5 py-0.5 text-[10px] font-semibold leading-tight ${
                          e.kind === "meeting"
                            ? "bg-emerald-50 text-emerald-700"
                            : late
                            ? "bg-rose-50 text-rose-700"
                            : "bg-indigo-50 text-indigo-700"
                        }`}
                      >
                        {e.kind === "meeting" ? "📅 " : "✓ "}{e.title}
                      </div>
                    );
                  })}
                  {dayEvents.length > 3 && (
                    <div className="px-1 text-[10px] font-bold text-slate-400">+{dayEvents.length - 3} أخرى</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-indigo-400" /> مهام</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /> اجتماعات</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-rose-400" /> مهام متأخرة</span>
      </div>
    </div>
  );
}
