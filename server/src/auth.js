import jwt from "jsonwebtoken";
import { query } from "./db.js";
import { fail } from "./util.js";

const AUTH_SECRET = process.env.AUTH_SECRET || "mythex-dev-secret-change-me";
const TOKEN_TTL = "12h";

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, name: user.name, email: user.email },
    AUTH_SECRET,
    { expiresIn: TOKEN_TTL }
  );
}

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return fail(res, 401, "يجب تسجيل الدخول أولاً.");

  try {
    const payload = jwt.verify(token, AUTH_SECRET);
    const { rows } = await query(
      `SELECT id, name, email, phone, role, avatar, status, last_login_at, created_at FROM users WHERE id = $1`,
      [payload.sub]
    );
    const user = rows[0];
    if (!user) return fail(res, 401, "الحساب غير موجود.");
    if (user.status !== "active") return fail(res, 403, "تم تعطيل هذا الحساب.");

    req.user = user;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") return fail(res, 401, "انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً.");
    return fail(res, 401, "جلسة غير صالحة.");
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return fail(res, 401, "يجب تسجيل الدخول أولاً.");
    if (!roles.includes(req.user.role)) {
      return fail(res, 403, "لا تملك صلاحية تنفيذ هذه العملية.");
    }
    next();
  };
}
