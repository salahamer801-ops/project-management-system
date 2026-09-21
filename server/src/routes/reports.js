import { Router } from "express";
import { query } from "../db.js";
import { requireAuth } from "../auth.js";
import {
  ok, fail, asyncHandler, PROJECT_SELECT, deriveProjectProgress,
  visibleProjectIds, isAdmin,
} from "../util.js";

const router = Router();
router.use(requireAuth);

router.get(
  "/projects",
  asyncHandler(async (req, res) => {
    const ids = await visibleProjectIds(req.user);
    let where = "";
    const params = [];
    if (ids !== null) {
      params.push(ids);
      where = `WHERE p.id = ANY($1::int[])`;
    }
    const { rows } = await query(
      `SELECT ${PROJECT_SELECT} FROM projects p
       LEFT JOIN users u ON u.id = p.manager_id
       ${where}
       ORDER BY p.created_at DESC`,
      params
    );
    const data = rows.map((p) => {
      const progress = deriveProjectProgress(p);
      const remaining = Math.max(0, (p.budget || 0) - (p.expenses_total || 0));
      const expensePercent = p.budget > 0 ? Math.round(((p.expenses_total || 0) / p.budget) * 100) : 0;
      return { ...p, progress, remaining, expense_percentage: expensePercent };
    });
    return ok(res, data);
  })
);

router.get(
  "/tasks",
  asyncHandler(async (req, res) => {
    const ids = await visibleProjectIds(req.user);
    let where = "";
    const params = [];
    if (ids !== null) {
      params.push(ids);
      where = `WHERE t.project_id = ANY($1::int[])`;
    }
    if (req.user.role === "team_member") {
      params.push(req.user.id);
      where += where ? ` AND t.assigned_to = $${params.length}` : ` WHERE t.assigned_to = $${params.length}`;
    }
    const { rows } = await query(
      `SELECT t.id, t.title, t.status, t.priority, t.start_date, t.due_date, t.progress,
              t.assigned_to, u.name AS assignee_name, p.name AS project_name
       FROM tasks t
       LEFT JOIN users u ON u.id = t.assigned_to
       LEFT JOIN projects p ON p.id = t.project_id
       ${where}
       ORDER BY t.due_date ASC NULLS LAST`,
      params
    );
    return ok(res, rows);
  })
);

router.get(
  "/financial",
  asyncHandler(async (req, res) => {
    const ids = await visibleProjectIds(req.user);
    const params = [];
    let where = "";
    if (ids !== null) {
      params.push(ids);
      where = `WHERE p.id = ANY($1::int[])`;
    }
    const { rows } = await query(
      `SELECT p.id, p.name, p.budget,
              COALESCE((SELECT SUM(e.amount) FROM expenses e WHERE e.project_id = p.id),0) AS expenses_total
       FROM projects p ${where}
       ORDER BY p.budget DESC`,
      params
    );
    const data = rows.map((p) => {
      const remaining = Math.max(0, (p.budget || 0) - (p.expenses_total || 0));
      const expensePercent = p.budget > 0 ? Math.round(((p.expenses_total || 0) / p.budget) * 100) : 0;
      return { ...p, remaining, expense_percentage: expensePercent };
    });
    return ok(res, data);
  })
);

router.get(
  "/activity",
  asyncHandler(async (req, res) => {
    if (!isAdmin(req.user)) return fail(res, 403, "تقرير الأنشطة متاح لمدير النظام فقط.");
    const { rows } = await query(
      `SELECT a.*, u.name AS user_name FROM activity_logs a
       LEFT JOIN users u ON u.id = a.user_id
       ORDER BY a.created_at DESC LIMIT 500`
    );
    return ok(res, rows);
  })
);

export default router;
