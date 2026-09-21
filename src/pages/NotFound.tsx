import { Link } from "react-router-dom";
import { Button } from "../components/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-100 p-4 text-center">
      <div className="text-7xl font-extrabold text-indigo-200">404</div>
      <h1 className="mt-2 text-xl font-extrabold text-slate-800">الصفحة غير موجودة</h1>
      <p className="mt-1 text-sm text-slate-500">عذراً، الصفحة التي تبحث عنها غير موجودة.</p>
      <Link to="/" className="mt-5">
        <Button>العودة للوحة التحكم</Button>
      </Link>
    </div>
  );
}
