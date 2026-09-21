export function formatDate(d?: string | null): string {
  if (!d) return "—";
  const s = String(d).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return String(d);
  const [y, m, day] = s.split("-");
  return `${day}/${m}/${y}`;
}

export function formatDateTime(d?: string | null): string {
  if (!d) return "—";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return String(d);
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
}

export function money(n?: number | null): string {
  if (n === undefined || n === null) return "—";
  return Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function timeOnly(t?: string | null): string {
  if (!t) return "—";
  return String(t).slice(0, 5);
}

export function initials(name?: string | null): string {
  if (!name) return "؟";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2);
  return parts[0][0] + parts[parts.length - 1][0];
}

export function isOverdue(task: { due_date?: string | null; status: string }): boolean {
  if (!task.due_date) return false;
  if (task.status === "completed" || task.status === "cancelled") return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(task.due_date + "T00:00:00Z");
  return due.getTime() < today.getTime();
}
