import { Router } from "express";
import { query } from "../db.js";
import { requireAuth } from "../auth.js";
import {
  ok, fail, asyncHandler, required, isValidDate, isPercent,
  getPagination, paginated, TASK_SELECT, TASK_STATUSES, PRIORITIES,
  canViewProject, canManageTasks, visibleProjectIds, logActivity, notify,
} from "../util.js";

const router = Router();
router.use(requireAuth);

function validateTaskBody(body, partial = false) {
  const errors = [];
  if (!partial && !required(body.title)) errors.push("عنوان المهمة مطلوب.");
  if (body.status && !TASK_STATUSES.includes(body.status)) errors.push("حالة المهمة غير صالحة.");
  if (body.priority && !PRIORITIES.includes(body.priority)) errors.push("أولوية المهمة غير صالحة.");
  if (body.start_date && !isValidDate(body.start_date)) errors.push("تاريخ البداية غير صالح.");
  if (body.due_date && !isValidDate(body.due_date)) errors.push("تاريخ التسليم غير صالح.");
  if (body.start_date && body.due_date && body.due_date < body.start_date) {
    errors.push("تاريخ التسليم لا يجب أن يكون قبل تاريخ البداية.");
  }
  if (body.progress !== undefined && body.progress !== "" && !isPercent(body.progress)) {
    errors.push("نسبة الإنجاز يجب أن تكون بين 0 و100.");
  }
  return errors;
}

// List tasks (scoped by role)
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, perPage, offset } = getPagination(req);
    const search = (req.query.search || "").trim();
    const status = req.query.status || "";
    const priority = req.query.priority || "";
    const projectId = req.query.project_id || "";
    const assignedTo = req.query.assigned_to || "";
    const sort = req.query.sort || "created_at";
    const dir = req.query.dir === "asc" ? "ASC" : "DESC";
    const allowedSorts = { created_at: "t.created_at", title: "t.title", status: "t.status", priority: "t.priority", due_date: "t.due_date", progress: "t.progress" };
    const sortCol = allowedSorts[sort] || "t.created_at";

    const where = [];
    const params = [];
    const ids = await visibleProjectIds(req.user);
    if (ids !== null) {
      if (ids.length === 0) return paginated(res, [], 0, page, perPage);
      params.push(ids);
      where.push(`t.project_id = ANY($${params.length})`);
    }
    if (req.user.role === "team_member") {
      params.push(req.user.id);
      where.push(`t.assigned_to = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      where.push(`(t.title ILIKE $${params.length} OR t.description ILIKE $${params.length})`);
    }
    if (status) { params.push(status); where.push(`t.status = $${params.length}`); }
    if (priority) { params.push(priority); where.push(`t.priority = $${params.length}`); }
    if (projectId) { params.push(projectId); where.push(`t.project_id = $${params.length}`); }
    if (assignedTo) { params.push(assignedTo); where.push(`t.assigned_to = $${params.length}`); }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const count = await query(`SELECT COUNT(*)::int AS c FROM tasks t ${whereSql}`, params);
    const { rows } = await query(
      `SELECT ${TASK_SELECT} FROM tasks t
       LEFT JOIN users u ON u.id = t.assigned_to
       LEFT JOIN projects p ON p.id = t.project_id
       ${whereSql}
       ORDER BY ${sortCol} ${dir}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, perPage, offset]
    );
    return paginated(res, rows, count.rows[0].c, page, perPage);
  })
);

// Create task
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { project_id } = req.body || {};
    const projectId = parseInt(project_id, 10);
    if (Number.isNaN(projectId)) return fail(res, 422, "يجب تحديد المشروع.");
    if (!(await canManageTasks(req.user, projectId))) return fail(res, 403, "لا تملك صلاحية إنشاء المهام في هذا المشروع.");

    const errors = validateTaskBody(req.body || {});
    if (errors.length) return fail(res, 422, "بيانات غير صالحة.", errors);

    const { title, description, assigned_to, status, priority, start_date, due_date, progress } = req.body;
    let assignee = assigned_to ? parseInt(assigned_to, 10) : null;
    if (assignee) {
      const u = await query(`SELECT id FROM users WHERE id = $1 AND status = 'active'`, [assignee]);
      if (u.rowCount === 0) return fail(res, 422, "المسؤول المحدد غير موجود أو معطل.");
    }

    const { rows } = await query(
      `INSERT INTO tasks (project_id, title, description, assigned_to, created_by, status, priority, start_date, due_date, progress)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        projectId, title.trim(), description || null, assignee, req.user.id,
        status || "todo", priority || "medium", start_date || null, due_date || null,
        progress !== undefined && progress !== "" ? Number(progress) : 0,
      ]
    );
    const task = rows[0];
    await logActivity(req.user, "create", "task", task.id, `أنشأ المهمة "${task.title}"`, req);
    if (assignee && assignee !== req.user.id) {
      await notify(assignee, "task", "تم تعيين مهمة لك", `تم تعيين المهمة "${task.title}" إليك.`, "task", task.id);
    }
    return ok(res, task, "تم إنشاء المهمة بنجاح.", 201);
  })
);

// Get one task
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return fail(res, 400, "معرف غير صالح.");
    const { rows } = await query(`SELECT * FROM tasks WHERE id = $1`, [id]);
    if (!rows[0]) return fail(res, 404, "المهمة غير موجودة.");
    if (!(await canViewProject(req.user, rows[0].project_id))) return fail(res, 403, "لا تملك صلاحية الوصول إلى هذه المهمة.");
    return ok(res, rows[0]);
  })
);

// Update task (full for managers/leaders, limited for assigned member)
router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return fail(res, 400, "معرف غير صالح.");
    const { rows: cur } = await query(`SELECT * FROM tasks WHERE id = $1`, [id]);
    if (!cur[0]) return fail(res, 404, "المهمة غير موجودة.");
    const current = cur[0];

    const canManage = await canManageTasks(req.user, current.project_id);
    const isAssignee = current.assigned_to === req.user.id && req.user.role === "team_member";

    if (!canManage && !isAssignee) return fail(res, 403, "لا تملك صلاحية تعديل هذه المهمة.");

    const b = req.body || {};
    if (isAssignee) {
      const allowed = ["status", "progress"];
      const keys = Object.keys(b).filter((k) => b[k] !== undefined && k !== "status" && k !== "progress");
      if (keys.length > 0) return fail(res, 403, "يمكنك فقط تحديث الحالة ونسبة الإنجاز لهذه المهمة.");
    }

    const errors = validateTaskBody(b, true);
    if (errors.length) return fail(res, 422, "بيانات غير صالحة.", errors);

    let assignee = current.assigned_to;
    if (canManage && b.assigned_to !== undefined) {
      assignee = b.assigned_to ? parseInt(b.assigned_to, 10) : null;
      if (assignee) {
        const u = await query(`SELECT id FROM users WHERE id = $1 AND status = 'active'`, [assignee]);
        if (u.rowCount === 0) return fail(res, 422, "المسؤول المحدد غير موجود أو معطل.");
      }
    }

    const nextStatus = b.status !== undefined ? b.status : current.status;
    const nextProgress = b.progress !== undefined && b.progress !== "" ? Number(b.progress) : current.progress;
    const completedAt = nextStatus === "completed" ? (current.completed_at ? current.completed_at : "now()") : null;
    const finalProgress = nextStatus === "completed" ? 100 : nextProgress;

    await query(
      `UPDATE tasks SET
         title = $1, description = $2, assigned_to = $3, status = $4, priority = $5,
         start_date = $6, due_date = $7, completed_at = $8, progress = $9, updated_at = now()
       WHERE id = $10`,
      [
        canManage && b.title !== undefined ? b.title.trim() : current.title,
        canManage && b.description !== undefined ? b.description || null : current.description,
        assignee,
        nextStatus,
        canManage && b.priority !== undefined ? b.priority : current.priority,
        canManage && b.start_date !== undefined ? b.start_date || null : current.start_date,
        canManage && b.due_date !== undefined ? b.due_date || null : current.due_date,
        completedAt,
        finalProgress,
        id,
      ]
    );

    if (nextStatus !== current.status) {
      await logActivity(req.user, "update", "task", id, `غيّر حالة المهمة "${current.title}" من "${current.status}" إلى "${nextStatus}"`, req);
      if (assignee && assignee !== req.user.id) {
        await notify(assignee, "task", "تغيّرت حالة مهمة", `تغيّرت حالة المهمة "${b.title || current.title}" إلى "${nextStatus}".`, "task", id);
      }
    } else {
      await logActivity(req.user, "update", "task", id, `عدّل المهمة "${b.title || current.title}"`, req);
    }

    const { rows } = await query(
      `SELECT ${TASK_SELECT} FROM tasks t LEFT JOIN users u ON u.id = t.assigned_to LEFT JOIN projects p ON p.id = t.project_id WHERE t.id = $1`,
      [id]
    );
    return ok(res, rows[0], "تم تحديث المهمة بنجاح.");
  })
);

// Delete task
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return fail(res, 400, "معرف غير صالح.");
    const { rows } = await query(`SELECT * FROM tasks WHERE id = $1`, [id]);
    if (!rows[0]) return fail(res, 404, "المهمة غير موجودة.");
    if (!(await canManageTasks(req.user, rows[0].project_id))) return fail(res, 403, "لا تملك صلاحية حذف هذه المهمة.");
    await query(`DELETE FROM tasks WHERE id = $1`, [id]);
    await logActivity(req.user, "delete", "task", id, `حذف المهمة "${rows[0].title}"`, req);
    return ok(res, null, "تم حذف المهمة بنجاح.");
  })
);

// ---------- comments ----------
router.get(
  "/:id/comments",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { rows: task } = await query(`SELECT * FROM tasks WHERE id = $1`, [id]);
    if (!task[0]) return fail(res, 404, "المهمة غير موجودة.");
    if (!(await canViewProject(req.user, task[0].project_id))) return fail(res, 403, "لا تملك صلاحية الوصول إلى هذه المهمة.");
    const { rows } = await query(
      `SELECT c.id, c.task_id, c.user_id, c.comment, c.created_at, c.updated_at, u.name AS user_name
       FROM task_comments c JOIN users u ON u.id = c.user_id
       WHERE c.task_id = $1 ORDER BY c.created_at ASC`,
      [id]
    );
    return ok(res, rows);
  })
);

router.post(
  "/:id/comments",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { rows: task } = await query(`SELECT * FROM tasks WHERE id = $1`, [id]);
    if (!task[0]) return fail(res, 404, "المهمة غير موجودة.");
    if (!(await canViewProject(req.user, task[0].project_id))) return fail(res, 403, "لا تملك صلاحية التعليق على هذه المهمة.");
    const { comment } = req.body || {};
    if (!required(comment)) return fail(res, 422, "لا يمكن إضافة تعليق فارغ.");
    const { rows } = await query(
      `INSERT INTO task_comments (task_id, user_id, comment) VALUES ($1,$2,$3) RETURNING *`,
      [id, req.user.id, comment.trim()]
    );
    await logActivity(req.user, "create", "task_comment", rows[0].id, `علّق على المهمة "${task[0].title}"`, req);
    return ok(res, rows[0], "تمت إضافة التعليق بنجاح.", 201);
  })
);

router.put(
  "/comments/:commentId",
  asyncHandler(async (req, res) => {
    const cid = parseInt(req.params.commentId, 10);
    const { rows } = await query(`SELECT * FROM task_comments WHERE id = $1`, [cid]);
    if (!rows[0]) return fail(res, 404, "التعليق غير موجود.");
    if (rows[0].user_id !== req.user.id && !["system_admin", "project_manager"].includes(req.user.role)) {
      return fail(res, 403, "لا تملك صلاحية تعديل هذا التعليق.");
    }
    const { comment } = req.body || {};
    if (!required(comment)) return fail(res, 422, "لا يمكن إضافة تعليق فارغ.");
    await query(`UPDATE task_comments SET comment = $1, updated_at = now() WHERE id = $2`, [comment.trim(), cid]);
    return ok(res, null, "تم تحديث التعليق بنجاح.");
  })
);

router.delete(
  "/comments/:commentId",
  asyncHandler(async (req, res) => {
    const cid = parseInt(req.params.commentId, 10);
    const { rows } = await query(`SELECT * FROM task_comments WHERE id = $1`, [cid]);
    if (!rows[0]) return fail(res, 404, "التعليق غير موجود.");
    if (rows[0].user_id !== req.user.id && !["system_admin", "project_manager"].includes(req.user.role)) {
      return fail(res, 403, "لا تملك صلاحية حذف هذا التعليق.");
    }
    await query(`DELETE FROM task_comments WHERE id = $1`, [cid]);
    return ok(res, null, "تم حذف التعليق بنجاح.");
  })
);

export default router;
