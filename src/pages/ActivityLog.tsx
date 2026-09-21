import { useCallback, useEffect, useState } from "react";
import { History } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { Badge, Card, EmptyState, PageHeader, Pagination, SearchInput, Spinner, toast } from "../components/ui";
import { formatDateTime } from "../lib/format";
import type { ActivityLog as Activity } from "../lib/types";

const ACTION_LABELS: Record<string, string> = {
  create: "إنشاء",
  update: "تعديل",
  delete: "حذف",
  login: "دخول",
};

export default function ActivityLog() {
  const [items, setItems] = useState<Activity[]>([]);
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, total: 0, per_page: 20 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setForbidden(false);
    try {
      const params = new URLSearchParams({ page: String(page), per_page: "20" });
      if (search) params.set("search", search);
      const res = await api<any[]>(`/activity-logs?${params.toString()}`);
      setItems(res.data);
      setPagination(res.pagination);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setForbidden(true);
      else toast(err instanceof ApiError ? err.message : "تعذر تحميل السجل.", "error");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div>
      <PageHeader title="سجل الأنشطة" subtitle="تتبع العمليات المهمة في النظام" />

      <Card>
        <div className="border-b border-slate-100 p-4">
          <SearchInput value={search} onChange={setSearch} placeholder="ابحث في السجل..." className="w-full sm:w-72" />
        </div>

        {loading ? (
          <div className="flex h-48 items-center justify-center"><Spinner className="h-7 w-7 text-indigo-600" /></div>
        ) : forbidden ? (
          <EmptyState title="غير مصرح" description="سجل الأنشطة متاح لمدير النظام فقط." />
        ) : items.length === 0 ? (
          <EmptyState title="لا توجد أنشطة" />
        ) : (
          <>
            <ul className="divide-y divide-slate-50">
              {items.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <div className="rounded-full bg-slate-100 p-2 text-slate-500"><History className="h-4 w-4" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-700">{a.description}</p>
                    <p className="text-xs text-slate-400">{a.user_name || "نظام"} · {formatDateTime(a.created_at)}</p>
                  </div>
                  <Badge className="bg-slate-100 text-slate-600 border-slate-200">{ACTION_LABELS[a.action] || a.action}</Badge>
                  {a.entity_type && <Badge className="bg-indigo-50 text-indigo-600 border-indigo-200">{a.entity_type}</Badge>}
                </li>
              ))}
            </ul>
            <Pagination page={pagination.current_page} lastPage={pagination.last_page} total={pagination.total} perPage={pagination.per_page} onPage={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}
