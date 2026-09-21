import { Router } from "express";
import bcrypt from "bcryptjs";
import { query } from "../db.js";
import { signToken, requireAuth } from "../auth.js";
import { ok, fail, asyncHandler, required, isValidEmail, logActivity } from "../util.js";

const router = Router();

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body || {};
    if (!required(email) || !required(password)) {
      return fail(res, 422, "يرجى إدخال البريد الإلكتروني وكلمة المرور.");
    }

    const { rows } = await query(`SELECT * FROM users WHERE LOWER(email) = LOWER($1)`, [email.trim()]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return fail(res, 401, "بيانات الدخول غير صحيحة.");
    }
    if (user.status !== "active") {
      return fail(res, 403, "تم تعطيل هذا الحساب، تواصل مع مدير النظام.");
    }

    await query(`UPDATE users SET last_login_at = now() WHERE id = $1`, [user.id]);
    await logActivity(user, "login", "user", user.id, "سجّل الدخول إلى النظام", req);

    const token = signToken(user);
    const { password_hash, ...safe } = user;
    return ok(res, { token, user: safe }, "تم تسجيل الدخول بنجاح.");
  })
);

router.post("/logout", requireAuth, (req, res) => ok(res, null, "تم تسجيل الخروج."));

router.get("/me", requireAuth, (req, res) => ok(res, req.user));

router.post(
  "/change-password",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { current_password, new_password } = req.body || {};
    if (!required(current_password) || !required(new_password)) {
      return fail(res, 422, "يرجى إدخال كلمة المرور الحالية والجديدة.");
    }
    if (String(new_password).length < 6) {
      return fail(res, 422, "كلمة المرور الجديدة يجب ألا تقل عن 6 أحرف.");
    }

    const { rows } = await query(`SELECT password_hash FROM users WHERE id = $1`, [req.user.id]);
    if (!(await bcrypt.compare(current_password, rows[0].password_hash))) {
      return fail(res, 400, "كلمة المرور الحالية غير صحيحة.");
    }

    const hash = await bcrypt.hash(new_password, 10);
    await query(`UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2`, [hash, req.user.id]);
    await logActivity(req.user, "update", "user", req.user.id, "غيّر كلمة المرور الخاصة به", req);
    return ok(res, null, "تم تغيير كلمة المرور بنجاح.");
  })
);

export default router;
