import { Router } from "express";
import { query } from "../db.js";
import { requireAuth } from "../auth.js";
import { asyncHandler, visibleProjectIds, isAdmin, ok } from "../util.js";

const router = Router();
router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const ids = await visibleProjectIds(req.user);
    const projectScope = ids === null ? "" : `WHERE p.id = ANY($1::int[])`;
    const scopeParams = ids === null ? [] : [ids];
    const p = (sql, params = []) => query(sql, [...scopeParams, ...params]);

    const [
      projects,
      tasks,
      finance,
      meetings,
      notifications,
      activity,
      projectStatus,
      taskStatus,
      monthly,
    ] = await Promise.all([
      p(`SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE p.status = 'in_progress')::int AS active,
           COUNT(*) FILTER (WHERE p.status = 'completed')::int AS completed,
           COUNT(*) FILTER (WHERE p.status = 'on_hold')::int AS on_hold,
           COUNT(*) FILTER (WHERE p.status = 'draft')::int AS draft,
           COUNT(*) FILTER (WHERE p.end_date < CURRENT_DATE AND p.status NOT IN ('completed','cancelled'))::int AS overdue,
           COALESCE(SUM(p.budget),0) AS budget
         FROM projects p ${projectScope}`),
      p(`SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE t.status = 'completed')::int AS completed,
           COUNT(*) FILTER (WHERE t.status = 'in_progress')::int AS in_progress,
           COUNT(*) FILTER (WHERE t.status = 'review')::int AS review,
           COUNT(*) FILTER (WHERE t.status = 'todo')::int AS todo,
           COUNT(*) FILTER (WHERE t.due_date < CURRENT_DATE AND t.status NOT IN ('completed','cancelled'))::int AS overdue
         FROM tasks t
         JOIN projects p ON p.id = t.project_id
         ${projectScope}`),
      p(`SELECT COALESCE(SUM(e.amount),0) AS expenses FROM expenses e JOIN projects p ON p.id = e.project_id ${projectScope}`),
      p(`SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE m.meeting_date >= CURRENT_DATE)::int AS upcoming
         FROM meetings m JOIN projects p ON p.id = m.project_id ${projectScope}`),
      query(`SELECT COUNT(*)::int AS unread FROM notifications WHERE user_id = $1 AND is_read = false`, [req.user.id]),
      isAdmin(req.user)
        ? query(`SELECT a.id, a.description, a.created_at, u.name AS user_name FROM activity_logs a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.created_at DESC LIMIT 10`)
        : Promise.resolve({ rows: [] }),
      p(`SELECT p.status, COUNT(*)::int AS c FROM projects p ${projectScope} GROUP BY p.status`),
      p(`SELECT t.status, COUNT(*)::int AS c FROM tasks t JOIN projects p ON p.id = t.project_id ${projectScope} GROUP BY t.status`),
      p(`SELECT to_char(t.created_at, 'YYYY-MM') AS month, COUNT(*)::int AS c
         FROM tasks t JOIN projects p ON p.id = t.project_id
         ${projectScope} AND t.created_at >= now() - interval '6 months'
         GROUP BY 1 ORDER BY 1`),
    ]);

    const budget = finance.rows[0].expenses || 0;
    const totalBudget = projects.rows[0].budget || 0;

    return ok(res, {
      kpi: {
        projects: projects.rows[0],
        tasks: tasks.rows[0],
        meetings: meetings.rows[0],
        unread: notifications.rows[0].unread,
        expenses_total: budget,
        budget: totalBudget,
        remaining: Math.max(0, totalBudget - budget),
      },
      charts: {
        project_status: projectStatus.rows,
        task_status: taskStatus.rows,
        monthly_tasks: monthly.rows,
      },
      recent_activity: activity.rows,
    });
  })
);

export default router;
