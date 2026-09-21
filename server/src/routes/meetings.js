import { Router } from "express";
import { query } from "../db.js";
import { requireAuth } from "../auth.js";
import {
  ok, fail, asyncHandler, required, isValidDate,
  getPagination, paginated, canViewProject, canManageExpenses, visibleProjectIds, logActivity, notify,
} from "../util.js";

const router = Router();
router.use(requireAuth);

const MEETING_SELECT = `
  m.id, m.project_id, m.title, m.description, m.meeting_date, m.start_time, m.end_time,
  m.location, m.meeting_url, m.created_by, m.created_at, m.updated_at, p.name AS project_name, u.name AS creator_name
`;

function validateMeeting(body) {
  const errors = [];
  if (!required(body.title)) errors.push("عنوان الاجتماع مطلوب.");
  if (body.meeting_date && !isValidDate(body.meeting_date)) errors.push("تاريخ الاجتماع غير صالح.");
  return errors;
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, perPage, offset } = getPagination(req);
    const search = (req.query.search || "").trim();
    const projectId = req.query.project_id || "";
    const upcoming = req.query.upcoming === "1";

    const where = [];
    const params = [];
    const ids = await visibleProjectIds(req.user);
    if (ids !== null) {
      if (ids.length === 0) return paginated(res, [], 0, page, perPage);
      params.push(ids);
      where.push(`m.project_id = ANY($${params.length})`);
    }
    if (search) { params.push(`%${search}%`); where.push(`(m.title ILIKE $${params.length} OR m.description ILIKE $${params.length} OR m.location ILIKE $${params.length})`); }
    if (projectId) { params.push(projectId); where.push(`m.project_id = $${params.length}`); }
    if (upcoming) where.push(`m.meeting_date >= CURRENT_DATE`);

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const count = await query(`SELECT COUNT(*)::int AS c FROM meetings m ${whereSql}`, params);
    const { rows } = await query(
      `SELECT ${MEETING_SELECT} FROM meetings m
       LEFT JOIN projects p ON p.id = m.project_id
       LEFT JOIN users u ON u.id = m.created_by
       ${whereSql}
       ORDER BY m.meeting_date ASC NULLS LAST, m.start_time ASC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, perPage, offset]
    );
    return paginated(res, rows, count.rows[0].c, page, perPage);
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const projectId = parseInt(req.body?.project_id, 10);
    if (Number.isNaN(projectId)) return fail(res, 422, "يجب تحديد المشروع.");
    if (!(await canManageExpenses(req.user, projectId))) return fail(res, 403, "لا تملك صلاحية إنشاء اجتماع لهذا المشروع.");
    const errors = validateMeeting(req.body || {});
    if (errors.length) return fail(res, 422, "بيانات غير صالحة.", errors);
    const { title, description, meeting_date, start_time, end_time, location, meeting_url } = req.body;
    const { rows } = await query(
      `INSERT INTO meetings (project_id, title, description, meeting_date, start_time, end_time, location, meeting_url, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [projectId, title.trim(), description || null, meeting_date || null, start_time || null, end_time || null, location || null, meeting_url || null, req.user.id]
    );
    await logActivity(req.user, "create", "meeting", rows[0].id, `أنشأ الاجتماع "${title}"`, req);

    const members = await query(`SELECT user_id FROM project_members WHERE project_id = $1 AND status = 'active'`, [projectId]);
    for (const m of members.rows) {
      if (m.user_id !== req.user.id) {
        await notify(m.user_id, "meeting", "اجتماع جديد", `تمت جدولة اجتماع "${title}".`, "meeting", rows[0].id);
      }
    }
    return ok(res, rows[0], "تم إنشاء الاجتماع بنجاح.", 201);
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { rows } = await query(
      `SELECT ${MEETING_SELECT} FROM meetings m LEFT JOIN projects p ON p.id = m.project_id LEFT JOIN users u ON u.id = m.created_by WHERE m.id = $1`,
      [id]
    );
    if (!rows[0]) return fail(res, 404, "الاجتماع غير موجود.");
    if (!(await canViewProject(req.user, rows[0].project_id))) return fail(res, 403, "لا تملك صلاحية الوصول إلى هذا الاجتماع.");
    return ok(res, rows[0]);
  })
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { rows: cur } = await query(`SELECT * FROM meetings WHERE id = $1`, [id]);
    if (!cur[0]) return fail(res, 404, "الاجتماع غير موجود.");
    if (!(await canManageExpenses(req.user, cur[0].project_id))) return fail(res, 403, "لا تملك صلاحية تعديل هذا الاجتماع.");
    const errors = validateMeeting(req.body || {});
    if (errors.length) return fail(res, 422, "بيانات غير صالحة.", errors);
    const b = req.body;
    await query(
      `UPDATE meetings SET title = $1, description = $2, meeting_date = $3, start_time = $4, end_time = $5, location = $6, meeting_url = $7, updated_at = now() WHERE id = $8`,
      [b.title.trim(), b.description || null, b.meeting_date || null, b.start_time || null, b.end_time || null, b.location || null, b.meeting_url || null, id]
    );
    await logActivity(req.user, "update", "meeting", id, `عدّل الاجتماع "${b.title}"`, req);
    return ok(res, null, "تم تحديث الاجتماع بنجاح.");
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { rows } = await query(`SELECT * FROM meetings WHERE id = $1`, [id]);
    if (!rows[0]) return fail(res, 404, "الاجتماع غير موجود.");
    if (!(await canManageExpenses(req.user, rows[0].project_id))) return fail(res, 403, "لا تملك صلاحية حذف هذا الاجتماع.");
    await query(`DELETE FROM meetings WHERE id = $1`, [id]);
    await logActivity(req.user, "delete", "meeting", id, `حذف الاجتماع "${rows[0].title}"`, req);
    return ok(res, null, "تم حذف الاجتماع بنجاح.");
  })
);

export default router;
