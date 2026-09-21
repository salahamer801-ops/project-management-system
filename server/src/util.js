import { query } from "./db.js";

export function ok(res, data = null, message = "تم تنفيذ العملية بنجاح", status = 200) {
  return res.status(status).json({ success: true, message, data });
}

export function fail(res, status, message, errors = null) {
  return res.status(status).json({
    success: false,
    message,
    errors: errors || [],
  });
}

export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export function getPagination(req) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const perPage = Math.min(100, Math.max(1, parseInt(req.query.per_page, 10) || 20));
  return { page, perPage, offset: (page - 1) * perPage };
}

export function paginated(res, rows, total, page, perPage) {
  return res.json({
    success: true,
    message: "تم تنفيذ العملية بنجاح",
    data: rows,
    pagination: {
      current_page: page,
      per_page: perPage,
      total,
      last_page: Math.max(1, Math.ceil(total / perPage)),
    },
  });
}

// ---------- validation helpers ----------
export function required(v) {
  return v !== undefined && v !== null && String(v).trim() !== "";
}

export function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isNonNegativeNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0;
}

export function isPercent(v) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 100;
}

export function isValidDate(v) {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(v + "T00:00:00Z");
  return !Number.isNaN(d.getTime());
}

// ---------- constants ----------
export const PROJECT_STATUSES = ["draft", "planned", "in_progress", "on_hold", "completed", "cancelled"];
export const TASK_STATUSES = ["todo", "in_progress", "review", "completed", "cancelled"];
export const PRIORITIES = ["low", "medium", "high", "critical"];
export const ROLES = ["system_admin", "project_manager", "team_leader", "team_member"];

export function roleRank(role) {
  return { system_admin: 40, project_manager: 30, team_leader: 20, team_member: 10 }[role] || 0;
}

export function isAdmin(user) {
  return user?.role === "system_admin";
}

// ---------- shared SQL fragments ----------
export const PROJECT_SELECT = `
  p.id, p.name, p.code, p.description, p.manager_id, p.status, p.priority,
  p.start_date, p.end_date, p.budget, p.progress, p.created_by, p.created_at, p.updated_at,
  u.name AS manager_name,
  (SELECT COUNT(*)::int FROM tasks t WHERE t.project_id = p.id) AS tasks_total,
  (SELECT COUNT(*)::int FROM tasks t WHERE t.project_id = p.id AND t.status = 'completed') AS tasks_completed,
  (SELECT COALESCE(SUM(e.amount), 0) FROM expenses e WHERE e.project_id = p.id) AS expenses_total
`;

export const TASK_SELECT = `
  t.id, t.project_id, t.title, t.description, t.assigned_to, t.created_by, t.status, t.priority,
  t.start_date, t.due_date, t.completed_at, t.progress, t.created_at, t.updated_at,
  u.name AS assignee_name, p.name AS project_name
`;

export function deriveProjectProgress(project) {
  const total = Number(project.tasks_total) || 0;
  const completed = Number(project.tasks_completed) || 0;
  return total > 0 ? Math.round((completed / total) * 100) : 0;
}

export function isOverdue(task) {
  if (!task.due_date) return false;
  if (task.status === "completed" || task.status === "cancelled") return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(task.due_date + "T00:00:00Z");
  return due.getTime() < today.getTime();
}

// ---------- access control ----------
export async function getProject(projectId) {
  const { rows } = await query(`SELECT id, manager_id, created_by, name FROM projects WHERE id = $1`, [projectId]);
  return rows[0] || null;
}

export async function canViewProject(user, projectId) {
  if (isAdmin(user)) return true;
  const project = await getProject(projectId);
  if (!project) return false;
  if (project.manager_id === user.id || project.created_by === user.id) return true;
  const m = await query(
    `SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2 AND status = 'active'`,
    [projectId, user.id]
  );
  return m.rowCount > 0;
}

export async function assertCanViewProject(user, projectId) {
  const can = await canViewProject(user, projectId);
  return can;
}

export async function canManageProject(user, projectId) {
  if (isAdmin(user)) return true;
  const project = await getProject(projectId);
  if (!project) return false;
  return project.manager_id === user.id || project.created_by === user.id;
}

export async function canManageTasks(user, projectId) {
  if (isAdmin(user)) return true;
  const project = await getProject(projectId);
  if (!project) return false;
  if (project.manager_id === user.id || project.created_by === user.id) return true;
  if (user.role === "team_leader") {
    const m = await query(
      `SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2 AND status = 'active'`,
      [projectId, user.id]
    );
    return m.rowCount > 0;
  }
  return false;
}

export async function canManageExpenses(user, projectId) {
  if (isAdmin(user)) return true;
  const project = await getProject(projectId);
  if (!project) return false;
  return project.manager_id === user.id || project.created_by === user.id;
}

// visible project ids for a user (used by list endpoints)
export async function visibleProjectIds(user) {
  if (isAdmin(user)) return null; // null => no restriction
  const { rows } = await query(
    `SELECT id FROM projects
     WHERE manager_id = $1 OR created_by = $1
        OR id IN (SELECT project_id FROM project_members WHERE user_id = $1 AND status = 'active')`,
    [user.id]
  );
  return rows.map((r) => r.id);
}

// ---------- activity + notifications ----------
export async function logActivity(user, action, entityType, entityId, description, req) {
  await query(
    `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, description, ip_address, user_agent)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      user?.id || null,
      action,
      entityType || null,
      entityId || null,
      description || null,
      req?.ip || null,
      req?.headers?.["user-agent"] || null,
    ]
  );
}

export async function notify(userId, type, title, message, relatedType = null, relatedId = null) {
  if (!userId) return;
  await query(
    `INSERT INTO notifications (user_id, type, title, message, related_type, related_id)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [userId, type, title, message, relatedType, relatedId]
  );
}
