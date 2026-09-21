import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { FolderKanban, Lock, Mail } from "lucide-react";
import { useAuth } from "../lib/auth";
import { ApiError } from "../lib/api";
import { Button, Field, Input } from "../components/ui";

const DEMO_ACCOUNTS = [
  { role: "مدير النظام", email: "admin@company.com" },
  { role: "مدير مشروع", email: "manager@company.com" },
  { role: "قائد فريق", email: "leader@company.com" },
  { role: "عضو فريق", email: "member@company.com" },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email.trim(), password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذر تسجيل الدخول.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
            <FolderKanban className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-extrabold text-slate-900">نظام إدارة المشاريع للمؤسسة</h1>
          <p className="mt-1 text-sm text-slate-500">سجّل الدخول للمتابعة</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <form onSubmit={onSubmit} className="space-y-4">
            <Field label="البريد الإلكتروني">
              <div className="relative">
                <Mail className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  type="email"
                  dir="ltr"
                  className="pr-9 text-right"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
            </Field>
            <Field label="كلمة المرور">
              <div className="relative">
                <Lock className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  type="password"
                  dir="ltr"
                  className="pr-9 text-right"
                  placeholder="••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </Field>

            {error && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </div>
            )}

            <Button type="submit" loading={loading} className="w-full">
              تسجيل الدخول
            </Button>
          </form>
        </div>

        <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
          <p className="mb-2 text-xs font-bold text-indigo-800">حسابات تجريبية (كلمة المرور: 123456)</p>
          <div className="grid grid-cols-2 gap-2">
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.email}
                type="button"
                onClick={() => setEmail(a.email)}
                className="rounded-lg border border-indigo-100 bg-white px-2 py-1.5 text-right hover:border-indigo-300"
              >
                <div className="text-[11px] font-bold text-indigo-700">{a.role}</div>
                <div className="text-[10px] text-slate-500" dir="ltr">
                  {a.email}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
