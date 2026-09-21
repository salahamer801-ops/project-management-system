import { Router } from "express";
import { query } from "../db.js";
import { requireAuth } from "../auth.js";
import {
  ok, fail, asyncHandler, required, isValidDate, isNonNegativeNumber,
  getPagination, paginated, canViewProject, canManageExpenses, visibleProjectIds, logActivity,
} from "../util.js";

const router = Router();
router.use(requireAuth);

const EXPENSE_SELECT = `
  e.id, e.project_id, e.title, e.description, e.amount, e.category, e.expense_date,
  e.created_by, e.created_at, e.updated_at, p.name AS project_name, u.name AS creator_name
`;

function validateExpense(body) {
  const errors = [];
  if (!required(body.title)) errors.push("عنوان المصروف مطلوب.");
  if (body.amount === undefined || body.amount === "" || !isNonNegativeNumber(body.amount)) {
    errors.push("القيمة يجب أن تكون رقماً غير سالب.");
  }
  if (body.expense_date && !isValidDate(body.expense_date)) errors.push("تاريخ المصروف غير صالح.");
  return errors;
}

// All expenses (scoped)
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, perPage, offset } = getPagination(req);
    const search = (req.query.search || "").trim();
    const projectId = req.query.project_id || "";
    const category = req.query.category || "";
    const sort = req.query.sort || "expense_date";
    const dir = req.query.dir === "asc" ? "ASC" : "DESC";
    const sortCol = { expense_date: "e.expense_date", amount: "e.amount", created_at: "e.created_at" }[sort] || "e.created_at";

    const where = [];
    const params = [];
    const ids = await visibleProjectIds(req.user);
    if (ids !== null) {
      if (ids.length === 0) return paginated(res, [], 0, page, perPage);
      params.push(ids);
      where.push(`e.project_id = ANY($${params.length})`);
    }
    if (search) { params.push(`%${search}%`); where.push(`(e.title ILIKE $${params.length} OR e.description ILIKE $${params.length})`); }
    if (projectId) { params.push(projectId); where.push(`e.project_id = $${params.length}`); }
    if (category) { params.push(category); where.push(`e.category = $${params.length}`); }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const count = await query(`SELECT COUNT(*)::int AS c FROM expenses e ${whereSql}`, params);
    const { rows } = await query(
      `SELECT ${EXPENSE_SELECT} FROM expenses e
       LEFT JOIN projects p ON p.id = e.project_id
       LEFT JOIN users u ON u.id = e.created_by
       ${whereSql}
       ORDER BY ${sortCol} ${dir} NULLS LAST
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, perPage, offset]
    );
    return paginated(res, rows, count.rows[0].c, page, perPage);
  })
);

// Project expenses
router.get(
  "/projects/:projectId",
  asyncHandler(async (req, res) => {
    const projectId = parseInt(req.params.projectId, 10);
    if (!(await canViewProject(req.user, projectId))) return fail(res, 403, "لا تملك صلاحية الوصول إلى هذا المشروع.");
    const { rows } = await query(
      `SELECT ${EXPENSE_SELECT} FROM expenses e
       LEFT JOIN projects p ON p.id = e.project_id
       LEFT JOIN users u ON u.id = e.created_by
       WHERE e.project_id = $1 ORDER BY e.expense_date DESC NULLS LAST, e.created_at DESC`,
      [projectId]
    );
    return ok(res, rows);
  })
);

// Create expense under a project
router.post(
  "/projects/:projectId",
  asyncHandler(async (req, res) => {
    const projectId = parseInt(req.params.projectId, 10);
    if (!(await canManageExpenses(req.user, projectId))) return fail(res, 403, "لا تملك صلاحية إضافة مصروف لهذا المشروع.");
    const errors = validateExpense(req.body || {});
    if (errors.length) return fail(res, 422, "بيانات غير صالحة.", errors);
    const { title, description, amount, category, expense_date } = req.body;
    const { rows } = await query(
      `INSERT INTO expenses (project_id, title, description, amount, category, expense_date, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [projectId, title.trim(), description || null, Number(amount), category || null, expense_date || null, req.user.id]
    );
    await logActivity(req.user, "create", "expense", rows[0].id, `أضاف مصروفاً "${title}" بقيمة ${amount}`, req);
    return ok(res, rows[0], "تمت إضافة المصروف بنجاح.", 201);
  })
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { rows: cur } = await query(`SELECT * FROM expenses WHERE id = $1`, [id]);
    if (!cur[0]) return fail(res, 404, "المصروف غير موجود.");
    if (!(await canManageExpenses(req.user, cur[0].project_id))) return fail(res, 403, "لا تملك صلاحية تعديل هذا المصروف.");
    const errors = validateExpense(req.body || {});
    if (errors.length) return fail(res, 422, "بيانات غير صالحة.", errors);
    const b = req.body;
    await query(
      `UPDATE expenses SET title = $1, description = $2, amount = $3, category = $4, expense_date = $5, updated_at = now() WHERE id = $6`,
      [b.title.trim(), b.description || null, Number(b.amount), b.category || null, b.expense_date || null, id]
    );
    await logActivity(req.user, "update", "expense", id, `عدّل المصروف "${b.title}"`, req);
    return ok(res, null, "تم تحديث المصروف بنجاح.");
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { rows } = await query(`SELECT * FROM expenses WHERE id = $1`, [id]);
    if (!rows[0]) return fail(res, 404, "المصروف غير موجود.");
    if (!(await canManageExpenses(req.user, rows[0].project_id))) return fail(res, 403, "لا تملك صلاحية حذف هذا المصروف.");
    await query(`DELETE FROM expenses WHERE id = $1`, [id]);
    await logActivity(req.user, "delete", "expense", id, `حذف المصروف "${rows[0].title}"`, req);
    return ok(res, null, "تم حذف المصروف بنجاح.");
  })
);

export default router;
