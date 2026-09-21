import { Router } from "express";
import { query } from "../db.js";
import { requireAuth } from "../auth.js";
import {
  ok, fail, asyncHandler, required, isValidDate, isNonNegativeNumber,
  getPagination, paginated, PROJECT_SELECT, PROJECT_STATUSES, PRIORITIES,
  deriveProjectProgress, canViewProject, canManageProject, visibleProjectIds,
  logActivity, notify,
} from "../util.js";

const router = Router();
router.use(requireAuth);

function validateProjectBody(body) {
  const errors = [];
  if (!required(body.name)) errors.push("اسم المشروع مطلوب.");
  if (body.status && !PROJECT_STATUSES.includes(body.status)) errors.push("حالة المشروع غير صالحة.");
  if (body.priority && !PRIORITIES.includes(body.priority)) errors.push("أولوية المشروع غير صالحة.");
  if (body.start_date && !isValidDate(body.start_date)) errors.push("تاريخ البداية غير صالح.");
  if (body.end_date && !isValidDate(body.end_date)) errors.push("تاريخ النهاية غير صالح.");
  if (body.start_date && body.end_date && body.end_date < body.start_date) {
    errors.push("تاريخ النهاية لا يجب أن يكون قبل تاريخ البداية.");
  }
  if (body.budget !== undefined && body.budget !== "" && !isNonNegativeNumber(body.budget)) {
    errors.push("الميزانية يجب أن تكون رقماً غير سالب.");
  }
  return errors;
}

// List projects (scoped by role)
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, perPage, offset } = getPagination(req);
    const search = (req.query.search || "").trim();
    const status = req.query.status || "";
    const priority = req.query.priority || "";
    const managerId = req.query.manager_id || "";
    const sort = req.query.sort || "created_at";
    const dir = req.query.dir === "asc" ? "ASC" : "DESC";

    const allowedSorts = { created_at: "p.created_at", name: "p.name", status: "p.status", priority: "p.priority", budget: "p.budget", progress: "p.progress", end_date: "p.end_date" };
    const sortCol = allowedSorts[sort] || "p.created_at";

    const where = [];
    const params = [];
    const ids = await visibleProjectIds(req.user);
    if (ids !== null) {
      if (ids.length === 0) {
        // No visible projects; return empty page
        return paginated(res, [], 0, page, perPage);
      }
      params.push(ids);
      where.push(`p.id = ANY($${params.length})`);
    }
    if (search) {
      params.push(`%${search}%`);
      where.push(`(p.name ILIKE $${params.length} OR p.code ILIKE $${params.length} OR p.description ILIKE $${params.length})`);
    }
    if (status) { params.push(status); where.push(`p.status = $${params.length}`); }
    if (priority) { params.push(priority); where.push(`p.priority = $${params.length}`); }
    if (managerId) { params.push(managerId); where.push(`p.manager_id = $${params.length}`); }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const count = await query(`SELECT COUNT(*)::int AS c FROM projects p ${whereSql}`, params);
    const { rows } = await query(
      `SELECT ${PROJECT_SELECT} FROM projects p
       LEFT JOIN users u ON u.id = p.manager_id
       ${whereSql}
       ORDER BY ${sortCol} ${dir}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, perPage, offset]
    );
    const data = rows.map((p) => ({ ...p, progress: deriveProjectProgress(p) }));
    return paginated(res, data, count.rows[0].c, page, perPage);
  })
);

// Create project
router.post(
  "/",
  asyncHandler(async (req, res) => {
    if (!["system_admin", "project_manager"].includes(req.user.role)) {
      return fail(res, 403, "لا تملك صلاحية إنشاء المشاريع.");
    }
    const errors = validateProjectBody(req.body || {});
    if (errors.length) return fail(res, 422, "بيانات غير صالحة.", errors);

    const { name, code, description, manager_id, status, priority, start_date, end_date, budget } = req.body;

    let managerId = manager_id ? parseInt(manager_id, 10) : req.user.id;
    if (Number.isNaN(managerId)) managerId = req.user.id;
    const mgr = await query(`SELECT id FROM users WHERE id = $1 AND status = 'active'`, [managerId]);
    if (mgr.rowCount === 0) return fail(res, 422, "المدير المحدد غير موجود أو معطل.");

    const { rows } = await query(
      `INSERT INTO projects (name, code, description, manager_id, status, priority, start_date, end_date, budget, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        name.trim(),
        code || null,
        description || null,
        managerId,
        status || "planned",
        priority || "medium",
        start_date || null,
        end_date || null,
        budget !== undefined && budget !== "" ? Number(budget) : 0,
        req.user.id,
      ]
    );
    const project = rows[0];
    // auto-add creator + manager as members
    await query(
      `INSERT INTO project_members (project_id, user_id, project_role, status)
       VALUES ($1,$2,'manager','active'), ($1,$3,'manager','active')
       ON CONFLICT DO NOTHING`,
      [project.id, req.user.id, managerId]
    );
    await logActivity(req.user, "create", "project", project.id, `أنشأ المشروع "${project.name}"`, req);
    if (managerId !== req.user.id) {
      await notify(managerId, "project", "تم تعيينك كمدير لمشروع", `تم تعيينك كمدير لمشروع "${project.name}".`, "project", project.id);
    }
    return ok(res, project, "تم إنشاء المشروع بنجاح.", 201);
  })
);

// Get one project (scope check)
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return fail(res, 400, "معرف غير صالح.");
    if (!(await canViewProject(req.user, id))) return fail(res, 403, "لا تملك صلاحية الوصول إلى هذا المشروع.");

    const { rows } = await query(
      `SELECT ${PROJECT_SELECT} FROM projects p LEFT JOIN users u ON u.id = p.manager_id WHERE p.id = $1`,
      [id]
    );
    if (!rows[0]) return fail(res, 404, "المشروع غير موجود.");
    return ok(res, { ...rows[0], progress: deriveProjectProgress(rows[0]) });
  })
);

// Update project
router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return fail(res, 400, "معرف غير صالح.");
    if (!(await canManageProject(req.user, id))) return fail(res, 403, "لا تملك صلاحية تعديل هذا المشروع.");

    const errors = validateProjectBody(req.body || {});
    if (errors.length) return fail(res, 422, "بيانات غير صالحة.", errors);

    const { rows: cur } = await query(`SELECT * FROM projects WHERE id = $1`, [id]);
    if (!cur[0]) return fail(res, 404, "المشروع غير موجود.");
    const current = cur[0];

    const b = req.body;
    const managerId = b.manager_id !== undefined ? parseInt(b.manager_id, 10) : current.manager_id;
    if (b.manager_id !== undefined) {
      const mgr = await query(`SELECT id FROM users WHERE id = $1 AND status = 'active'`, [managerId]);
      if (mgr.rowCount === 0) return fail(res, 422, "المدير المحدد غير موجود أو معطل.");
    }

    await query(
      `UPDATE projects SET
         name = $1, code = $2, description = $3, manager_id = $4, status = $5, priority = $6,
         start_date = $7, end_date = $8, budget = $9, updated_at = now()
       WHERE id = $10`,
      [
        b.name !== undefined ? b.name.trim() : current.name,
        b.code !== undefined ? b.code || null : current.code,
        b.description !== undefined ? b.description || null : current.description,
        managerId,
        b.status !== undefined ? b.status : current.status,
        b.priority !== undefined ? b.priority : current.priority,
        b.start_date !== undefined ? b.start_date || null : current.start_date,
        b.end_date !== undefined ? b.end_date || null : current.end_date,
        b.budget !== undefined && b.budget !== "" ? Number(b.budget) : current.budget,
        id,
      ]
    );
    if (b.manager_id !== undefined && managerId !== current.manager_id) {
      await query(
        `INSERT INTO project_members (project_id, user_id, project_role, status)
         VALUES ($1,$2,'manager','active') ON CONFLICT DO NOTHING`,
        [id, managerId]
      );
      await notify(managerId, "project", "تم تعيينك كمدير لمشروع", `تم تعيينك كمدير لمشروع "${b.name || current.name}".`, "project", id);
    }
    await logActivity(req.user, "update", "project", id, `عدّل المشروع "${b.name || current.name}"`, req);
    const { rows } = await query(
      `SELECT ${PROJECT_SELECT} FROM projects p LEFT JOIN users u ON u.id = p.manager_id WHERE p.id = $1`,
      [id]
    );
    return ok(res, { ...rows[0], progress: deriveProjectProgress(rows[0]) }, "تم تحديث المشروع بنجاح.");
  })
);

// Delete project
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return fail(res, 400, "معرف غير صالح.");
    if (!(await canManageProject(req.user, id))) return fail(res, 403, "لا تملك صلاحية حذف هذا المشروع.");
    const { rows } = await query(`SELECT name FROM projects WHERE id = $1`, [id]);
    if (!rows[0]) return fail(res, 404, "المشروع غير موجود.");
    await query(`DELETE FROM projects WHERE id = $1`, [id]);
    await logActivity(req.user, "delete", "project", id, `حذف المشروع "${rows[0].name}"`, req);
    return ok(res, null, "تم حذف المشروع بنجاح.");
  })
);

// ---------- members ----------
router.get(
  "/:id/members",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!(await canViewProject(req.user, id))) return fail(res, 403, "لا تملك صلاحية الوصول إلى هذا المشروع.");
    const { rows } = await query(
      `SELECT pm.id, pm.project_id, pm.user_id, pm.project_role, pm.status, pm.joined_at,
              u.name, u.email, u.role, u.avatar
       FROM project_members pm
       JOIN users u ON u.id = pm.user_id
       WHERE pm.project_id = $1
       ORDER BY pm.joined_at ASC`,
      [id]
    );
    return ok(res, rows);
  })
);

router.post(
  "/:id/members",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!(await canManageProject(req.user, id))) return fail(res, 403, "لا تملك صلاحية إدارة أعضاء هذا المشروع.");
    const { user_id, project_role } = req.body || {};
    const userId = parseInt(user_id, 10);
    if (Number.isNaN(userId)) return fail(res, 422, "يرجى تحديد المستخدم.");
    const user = await query(`SELECT id, name FROM users WHERE id = $1 AND status = 'active'`, [userId]);
    if (user.rowCount === 0) return fail(res, 422, "المستخدم غير موجود أو معطل.");

    const existing = await query(`SELECT id, status FROM project_members WHERE project_id = $1 AND user_id = $2`, [id, userId]);
    if (existing.rowCount > 0) {
      if (existing.rows[0].status === "active") return fail(res, 409, "المستخدم عضو بالفعل في هذا المشروع.");
      await query(`UPDATE project_members SET status = 'active', project_role = $1 WHERE id = $2`, [project_role || "member", existing.rows[0].id]);
    } else {
      await query(
        `INSERT INTO project_members (project_id, user_id, project_role, status) VALUES ($1,$2,$3,'active')`,
        [id, userId, project_role || "member"]
      );
    }
    const { rows: proj } = await query(`SELECT name FROM projects WHERE id = $1`, [id]);
    await notify(userId, "project", "تمت إضافتك إلى مشروع", `تمت إضافتك إلى مشروع "${proj[0].name}".`, "project", id);
    await logActivity(req.user, "create", "project_member", userId, `أضاف "${user.rows[0].name}" إلى المشروع`, req);
    return ok(res, null, "تمت إضافة العضو بنجاح.", 201);
  })
);

router.delete(
  "/:id/members/:userId",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const userId = parseInt(req.params.userId, 10);
    if (!(await canManageProject(req.user, id))) return fail(res, 403, "لا تملك صلاحية إدارة أعضاء هذا المشروع.");
    const { rows } = await query(`SELECT id FROM project_members WHERE project_id = $1 AND user_id = $2`, [id, userId]);
    if (!rows[0]) return fail(res, 404, "العضو غير موجود في المشروع.");
    await query(`UPDATE project_members SET status = 'inactive' WHERE id = $1`, [rows[0].id]);
    await logActivity(req.user, "delete", "project_member", userId, "أزال عضواً من المشروع", req);
    return ok(res, null, "تمت إزالة العضو بنجاح.");
  })
);

export default router;
