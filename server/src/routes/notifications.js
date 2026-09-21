import { Router } from "express";
import { query } from "../db.js";
import { requireAuth } from "../auth.js";
import { ok, fail, asyncHandler } from "../util.js";

const router = Router();
router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 200`,
      [req.user.id]
    );
    const unread = rows.filter((n) => !n.is_read).length;
    return ok(res, { items: rows, unread });
  })
);

router.put(
  "/read-all",
  asyncHandler(async (req, res) => {
    await query(`UPDATE notifications SET is_read = true, read_at = now() WHERE user_id = $1 AND is_read = false`, [req.user.id]);
    return ok(res, null, "تم تحديد الكل كمقروء.");
  })
);

router.put(
  "/:id/read",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { rows } = await query(`SELECT id FROM notifications WHERE id = $1 AND user_id = $2`, [id, req.user.id]);
    if (!rows[0]) return fail(res, 404, "الإشعار غير موجود.");
    await query(`UPDATE notifications SET is_read = true, read_at = now() WHERE id = $1`, [id]);
    return ok(res, null, "تم قراءة الإشعار.");
  })
);

export default router;
