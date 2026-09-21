import { useCallback, useEffect, useState } from "react";
import { Bell, CheckCheck, Circle } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { Button, Card, EmptyState, PageHeader, Spinner, toast } from "../components/ui";
import { formatDateTime } from "../lib/format";
import type { Notification } from "../lib/types";

export default function Notifications() {
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await api<{ items: Notification[]; unread: number }>("/notifications");
      setItems(res.data.items);
      setUnread(res.data.unread);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "تعذر تحميل الإشعارات.", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function markRead(id: number) {
    try {
      await api(`/notifications/${id}/read`, { method: "PUT" });
      load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "تعذر تحديث الإشعار.", "error");
    }
  }

  async function markAll() {
    try {
      await api("/notifications/read-all", { method: "PUT" });
      load();
      toast("تم تحديد الكل كمقروء.");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "تعذر التحديث.", "error");
    }
  }

  return (
    <div>
      <PageHeader
        title="الإشعارات"
        subtitle={`لديك ${unread} إشعار غير مقروء`}
        actions={
          unread > 0 && (
            <Button variant="secondary" onClick={markAll}>
              <CheckCheck className="h-4 w-4" /> تحديد الكل كمقروء
            </Button>
          )
        }
      />

      <Card>
        {loading ? (
          <div className="flex h-48 items-center justify-center"><Spinner className="h-7 w-7 text-indigo-600" /></div>
        ) : items.length === 0 ? (
          <EmptyState title="لا توجد إشعارات" description="ستظهر هنا إشعارات المهام والاجتماعات." />
        ) : (
          <ul className="divide-y divide-slate-50">
            {items.map((n) => (
              <li key={n.id} className={`flex items-start gap-3 px-5 py-3.5 ${n.is_read ? "" : "bg-indigo-50/40"}`}>
                <div className={`mt-0.5 shrink-0 rounded-full p-2 ${n.is_read ? "bg-slate-100 text-slate-400" : "bg-indigo-100 text-indigo-600"}`}>
                  <Bell className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${n.is_read ? "text-slate-600" : "text-slate-900"}`}>{n.title}</span>
                    {!n.is_read && <Circle className="h-2 w-2 fill-indigo-500 text-indigo-500" />}
                  </div>
                  {n.message && <p className="mt-0.5 text-sm text-slate-500">{n.message}</p>}
                  <div className="mt-1 text-xs text-slate-400">{formatDateTime(n.created_at)}</div>
                </div>
                {!n.is_read && (
                  <button onClick={() => markRead(n.id)} className="shrink-0 text-xs font-semibold text-indigo-600 hover:underline">
                    قراءة
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
