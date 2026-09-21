import { useState, type FormEvent } from "react";
import { KeyRound, User as UserIcon } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Badge, Button, Card, Field, Input, PageHeader, toast } from "../components/ui";
import { ROLE_COLORS, ROLES } from "../lib/constants";
import { formatDateTime } from "../lib/format";

export default function Settings() {
  const { user } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    if (next !== confirm) {
      toast("كلمتا المرور غير متطابقتين.", "error");
      return;
    }
    setSaving(true);
    try {
      await api("/auth/change-password", { method: "POST", body: { current_password: current, new_password: next } });
      toast("تم تغيير كلمة المرور بنجاح.");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "تعذر تغيير كلمة المرور.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="الإعدادات" subtitle="إدارة حسابك وتغيير كلمة المرور" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="معلومات الحساب">
          <div className="p-5">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-lg font-bold text-white">
                {user?.name?.slice(0, 1)}
              </div>
              <div>
                <div className="text-base font-bold text-slate-800">{user?.name}</div>
                <div className="text-sm text-slate-500" dir="ltr">{user?.email}</div>
                <Badge className={`mt-1 ${ROLE_COLORS[user?.role || ""] || ""}`}>{ROLES[user?.role || ""]}</Badge>
              </div>
            </div>
            <dl className="mt-5 space-y-3 text-sm">
              <Row label="البريد الإلكتروني" value={user?.email || "—"} ltr />
              <Row label="الهاتف" value={user?.phone || "—"} ltr />
              <Row label="آخر دخول" value={formatDateTime(user?.last_login_at)} />
              <Row label="تاريخ الإنشاء" value={formatDateTime(user?.created_at)} />
            </dl>
          </div>
        </Card>

        <Card title="تغيير كلمة المرور">
          <form onSubmit={changePassword} className="space-y-4 p-5">
            <Field label="كلمة المرور الحالية">
              <div className="relative">
                <KeyRound className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input type="password" dir="ltr" className="pr-9 text-right" value={current} onChange={(e) => setCurrent(e.target.value)} required />
              </div>
            </Field>
            <Field label="كلمة المرور الجديدة">
              <Input type="password" dir="ltr" className="text-right" value={next} onChange={(e) => setNext(e.target.value)} required />
            </Field>
            <Field label="تأكيد كلمة المرور الجديدة">
              <Input type="password" dir="ltr" className="text-right" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            </Field>
            <Button type="submit" loading={saving}>حفظ</Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-50 pb-2">
      <dt className="flex items-center gap-1.5 text-slate-500"><UserIcon className="h-3.5 w-3.5" />{label}</dt>
      <dd className={`font-semibold text-slate-700 ${ltr ? "text-left" : ""}`} dir={ltr ? "ltr" : undefined}>{value}</dd>
    </div>
  );
}
