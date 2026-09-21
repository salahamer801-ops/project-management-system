export interface LabelMap {
  [key: string]: { label: string; color: string; dot: string };
}

export const PROJECT_STATUS: LabelMap = {
  draft: { label: "مسودة", color: "bg-slate-100 text-slate-700 border-slate-200", dot: "bg-slate-400" },
  planned: { label: "مخطط له", color: "bg-sky-50 text-sky-700 border-sky-200", dot: "bg-sky-500" },
  in_progress: { label: "قيد التنفيذ", color: "bg-indigo-50 text-indigo-700 border-indigo-200", dot: "bg-indigo-500" },
  on_hold: { label: "متوقف", color: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  completed: { label: "مكتمل", color: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  cancelled: { label: "ملغى", color: "bg-rose-50 text-rose-700 border-rose-200", dot: "bg-rose-500" },
};

export const TASK_STATUS: LabelMap = {
  todo: { label: "لم تبدأ", color: "bg-slate-100 text-slate-700 border-slate-200", dot: "bg-slate-400" },
  in_progress: { label: "قيد التنفيذ", color: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  review: { label: "قيد المراجعة", color: "bg-purple-50 text-purple-700 border-purple-200", dot: "bg-purple-500" },
  completed: { label: "مكتملة", color: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  cancelled: { label: "ملغاة", color: "bg-rose-50 text-rose-700 border-rose-200", dot: "bg-rose-500" },
};

export const PRIORITY: LabelMap = {
  low: { label: "منخفضة", color: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  medium: { label: "متوسطة", color: "bg-sky-50 text-sky-700 border-sky-200", dot: "bg-sky-500" },
  high: { label: "عالية", color: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  critical: { label: "حرجة", color: "bg-rose-50 text-rose-700 border-rose-200", dot: "bg-rose-500" },
};

export const ROLES: Record<string, string> = {
  system_admin: "مدير النظام",
  project_manager: "مدير مشروع",
  team_leader: "قائد فريق",
  team_member: "عضو فريق",
};

export const ROLE_COLORS: Record<string, string> = {
  system_admin: "bg-rose-50 text-rose-700 border-rose-200",
  project_manager: "bg-indigo-50 text-indigo-700 border-indigo-200",
  team_leader: "bg-sky-50 text-sky-700 border-sky-200",
  team_member: "bg-slate-100 text-slate-700 border-slate-200",
};

export const MEMBER_ROLES: Record<string, string> = {
  manager: "مدير",
  leader: "قائد فريق",
  member: "عضو",
};

export const EXPENSE_CATEGORIES = [
  "برمجيات",
  "بنية تحتية",
  "تصميم",
  "تدريب",
  "تسويق",
  "رواتب",
  "معدات",
  "أخرى",
];

export const statusOptions = (map: LabelMap) =>
  Object.entries(map).map(([value, v]) => ({ value, label: v.label }));
