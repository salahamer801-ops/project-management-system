import { Router } from "express";
import { query } from "../db.js";
import { requireAuth } from "../auth.js";
import { asyncHandler, getPagination, paginated, isAdmin } from "../util.js";

const router = Router();
router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    if (!isAdmin(req.user)) {
      return res.status(403).json({ success: false, message: "سجل الأنشطة متاح لمدير النظام فقط.", errors: [] });
    }
    const { page, perPage, offset } = getPagination(req);
    const search = (req.query.search || "").trim();
    const params = [];
    let whereSql = "";
    if (search) {
      params.push(`%${search}%`);
      whereSql = `WHERE a.description ILIKE $1 OR a.action ILIKE $1`;
    }
    const count = await query(`SELECT COUNT(*)::int AS c FROM activity_logs a ${whereSql}`, params);
    const { rows } = await query(
      `SELECT a.*, u.name AS user_name
       FROM activity_logs a LEFT JOIN users u ON u.id = a.user_id
       ${whereSql}
       ORDER BY a.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, perPage, offset]
    );
    return paginated(res, rows, count.rows[0].c, page, perPage);
  })
);

export default router;
