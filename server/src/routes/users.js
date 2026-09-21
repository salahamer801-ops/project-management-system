import { Router } from "express";
import bcrypt from "bcryptjs";
import { query } from "../db.js";
import { requireAuth, requireRole } from "../auth.js";
import {
  ok, fail, asyncHandler, required, isValidEmail, getPagination, paginated,
  ROLES, logActivity,
} from "../util.js";

const router = Router();

router.use(requireAuth);

// Lightweight user options for pickers (assignment, managers, members)
router.get(
  "/options",
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT id, name, email, role FROM users WHERE status = 'active' ORDER BY name ASC`
    );
    return ok(res, rows);
  })
);

// List users (admin only)
router.get(
  "/",
  requireRole("system_admin"),
  asyncHandler(async (req, res) => {
    const { page, perPage, offset } = getPagination(req);
    const search = (req.query.search || "").trim();
    const role = req.query.role || "";
    const status = req.query.status || "";

    const where = [];
    const params = [];
    if (search) {
      params.push(`%${search}%`);
      where.push(`(name ILIKE $${params.length} OR email ILIKE $${params.length})`);
    }
    if (role) {
      params.push(role);
      where.push(`role = $${params.length}`);
    }
    if (status) {
      params.push(status);
      where.push(`status = $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const count = await query(`SELECT COUNT(*)::int AS c FROM users ${whereSql}`, params);
    const { rows } = await query(
      `SELECT id, name, email, phone, role, avatar, status, last_login_at, created_at, updated_at
       FROM users ${whereSql}
       ORDER BY created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, perPage, offset]
    );
    return paginated(res, rows, count.rows[0].c, page, perPage);
  })
);

// Create user (admin only)
router.post(
  "/",
  requireRole("system_admin"),
  asyncHandler(async (req, res) => {
    const { name, email, phone, role, password, status } = req.body || {};
    if (!required(name) || !required(email) || !required(password)) {
      return fail(res, 422, "الاسم والبريد الإلكتروني وكلمة المرور مطلوبة.");
    }
    if (!isValidEmail(email)) return fail(res, 422, "صيغة البريد الإلكتروني غير صحيحة.");
    if (!ROLES.includes(role)) return fail(res, 422, "الدور غير صالح.");
    if (String(password).length < 6) return fail(res, 422, "كلمة المرور يجب ألا تقل عن 6 أحرف.");

    const existing = await query(`SELECT 1 FROM users WHERE LOWER(email) = LOWER($1)`, [email.trim()]);
    if (existing.rowCount > 0) return fail(res, 409, "البريد الإلكتروني مستخدم بالفعل.");

    const hash = await bcrypt.hash(password, 10);
    const { rows } = await query(
      `INSERT INTO users (name, email, phone, password_hash, role, status)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, name, email, phone, role, status, created_at`,
      [name.trim(), email.trim(), phone || null, hash, role, status || "active"]
    );
    await logActivity(req.user, "create", "user", rows[0].id, `أنشأ المستخدم "${name}"`, req);
    return ok(res, rows[0], "تم إنشاء المستخدم بنجاح.", 201);
  })
);

// Get one user
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return fail(res, 400, "معرف غير صالح.");
    if (req.user.role !== "system_admin" && req.user.id !== id) {
      return fail(res, 403, "لا تملك صلاحية الوصول إلى هذا المستخدم.");
    }
    const { rows } = await query(
      `SELECT id, name, email, phone, role, avatar, status, last_login_at, created_at, updated_at FROM users WHERE id = $1`,
      [id]
    );
    if (!rows[0]) return fail(res, 404, "المستخدم غير موجود.");
    return ok(res, rows[0]);
  })
);

// Update user
router.put(
  "/:id",
  requireRole("system_admin"),
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return fail(res, 400, "معرف غير صالح.");
    const { name, email, phone, role, status, password } = req.body || {};

    const { rows: existingRows } = await query(`SELECT * FROM users WHERE id = $1`, [id]);
    const existing = existingRows[0];
    if (!existing) return fail(res, 404, "المستخدم غير موجود.");

    if (email && !isValidEmail(email)) return fail(res, 422, "صيغة البريد الإلكتروني غير صحيحة.");
    if (role && !ROLES.includes(role)) return fail(res, 422, "الدور غير صالح.");
    if (password && String(password).length < 6) return fail(res, 422, "كلمة المرور يجب ألا تقل عن 6 أحرف.");

    const newEmail = email || existing.email;
    const dup = await query(`SELECT 1 FROM users WHERE LOWER(email) = LOWER($1) AND id <> $2`, [newEmail.trim(), id]);
    if (dup.rowCount > 0) return fail(res, 409, "البريد الإلكتروني مستخدم من حساب آخر.");

    const fields = [];
    const params = [id];
    const set = (col, val) => {
      params.push(val);
      fields.push(`${col} = $${params.length}`);
    };
    if (name) set("name", name.trim());
    if (email) set("email", email.trim());
    set("phone", phone !== undefined ? phone || null : existing.phone);
    if (role) set("role", role);
    if (status) set("status", status);
    set("updated_at", "now()");

    if (fields.length === 0) return fail(res, 400, "لا توجد بيانات للتحديث.");

    await query(`UPDATE users SET ${fields.join(", ")} WHERE id = $1`, params);

    if (password) {
      const hash = await bcrypt.hash(password, 10);
      await query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [hash, id]);
    }

    await logActivity(req.user, "update", "user", id, `عدّل بيانات المستخدم "${newEmail}"`, req);
    const { rows } = await query(
      `SELECT id, name, email, phone, role, avatar, status, last_login_at, created_at, updated_at FROM users WHERE id = $1`,
      [id]
    );
    return ok(res, rows[0], "تم تحديث المستخدم بنجاح.");
  })
);

// Deactivate / delete user (admin only) — soft delete via status
router.delete(
  "/:id",
  requireRole("system_admin"),
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return fail(res, 400, "معرف غير صالح.");
    if (id === req.user.id) return fail(res, 400, "لا يمكنك تعطيل حسابك الحالي.");

    const { rows } = await query(`SELECT * FROM users WHERE id = $1`, [id]);
    if (!rows[0]) return fail(res, 404, "المستخدم غير موجود.");

    await query(`UPDATE users SET status = 'disabled', updated_at = now() WHERE id = $1`, [id]);
    await logActivity(req.user, "delete", "user", id, `عطّل المستخدم "${rows[0].name}"`, req);
    return ok(res, null, "تم تعطيل المستخدم بنجاح.");
  })
);

export default router;
