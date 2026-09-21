import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";

// In-process Postgres (WASM) with on-disk persistence.
// Keeps the full PostgreSQL dialect so the API stays database-agnostic.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.PGDATA || path.join(__dirname, "..", ".pgdata");
fs.mkdirSync(dataDir, { recursive: true });

const db = new PGlite(dataDir);

export const query = (text, params = []) => db.query(text, params);
export { db };

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'team_member',
  avatar TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT,
  description TEXT,
  manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'planned',
  priority TEXT NOT NULL DEFAULT 'medium',
  start_date DATE,
  end_date DATE,
  budget NUMERIC(14,2) NOT NULL DEFAULT 0,
  progress NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_members (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_role TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);

CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'todo',
  priority TEXT NOT NULL DEFAULT 'medium',
  start_date DATE,
  due_date DATE,
  completed_at TIMESTAMPTZ,
  progress NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS task_comments (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  category TEXT,
  expense_date DATE,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS meetings (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  meeting_date DATE,
  start_time TIME,
  end_time TIME,
  location TEXT,
  meeting_url TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT,
  title TEXT NOT NULL,
  message TEXT,
  related_type TEXT,
  related_id INTEGER,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id INTEGER,
  description TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_manager ON projects(manager_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_members_user ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_members_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_comments_task ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_expenses_project ON expenses(project_id);
CREATE INDEX IF NOT EXISTS idx_meetings_project ON meetings(project_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs(created_at DESC);
`;

export async function migrate() {
  await db.exec(SCHEMA);
}

export async function seed() {
  const passwordHash = await bcrypt.hash("123456", 10);

  const demoUsers = [
    ["أحمد المدير", "admin@company.com", "system_admin"],
    ["محمد المدير", "manager@company.com", "project_manager"],
    ["سارة القائدة", "leader@company.com", "team_leader"],
    ["علي العضو", "member@company.com", "team_member"],
  ];

  // Always (re)sync the demo accounts with the documented password so a stale
  // on-disk seed from an earlier build can never lock the reviewer out.
  for (const [name, email, role] of demoUsers) {
    await query(
      `INSERT INTO users (name, email, password_hash, role, status)
       VALUES ($1,$2,$3,$4,'active')
       ON CONFLICT (email) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         role = EXCLUDED.role,
         status = 'active'`,
      [name, email, passwordHash, role]
    );
  }

  const usersRes = await query(
    `SELECT id, email FROM users WHERE email = ANY($1::text[])`,
    [demoUsers.map((u) => u[1])]
  );
  const idByEmail = {};
  for (const row of usersRes.rows) idByEmail[row.email] = row.id;
  const adminId = idByEmail["admin@company.com"];
  const managerId = idByEmail["manager@company.com"];
  const leaderId = idByEmail["leader@company.com"];
  const memberId = idByEmail["member@company.com"];

  const { rows } = await query("SELECT COUNT(*)::int AS c FROM projects");
  if (rows[0].c > 0) return;

  const p1 = await query(
    `INSERT INTO projects (name, code, description, manager_id, status, priority, start_date, end_date, budget, created_by)
     VALUES ($1,$2,$3,$4,'in_progress','high', $5, $6, 250000, $7) RETURNING id`,
    [
      "نظام إدارة الموارد المؤسسي",
      "ERP-2025",
      "بناء وتشغيل نظام مركزي لإدارة موارد المؤسسة والعمليات الداخلية.",
      managerId,
      "2025-01-05",
      "2025-12-31",
      managerId,
    ]
  );
  const p2 = await query(
    `INSERT INTO projects (name, code, description, manager_id, status, priority, start_date, end_date, budget, created_by)
     VALUES ($1,$2,$3,$4,'planned','medium', $5, $6, 80000, $7) RETURNING id`,
    [
      "تطوير موقع الشركة الجديد",
      "WEB-2025",
      "إعادة تصميم الموقع الرسمي مع متجر إلكتروني ولوحة تحكم.",
      managerId,
      "2025-04-01",
      "2025-09-30",
      managerId,
    ]
  );
  const project1Id = p1.rows[0].id;
  const project2Id = p2.rows[0].id;

  for (const uid of [managerId, leaderId, memberId]) {
    await query(
      `INSERT INTO project_members (project_id, user_id, project_role, status)
       VALUES ($1,$2,$3,'active') ON CONFLICT DO NOTHING`,
      [project1Id, uid, uid === leaderId ? "leader" : "member"]
    );
  }
  for (const uid of [managerId, leaderId]) {
    await query(
      `INSERT INTO project_members (project_id, user_id, project_role, status)
       VALUES ($1,$2,$3,'active') ON CONFLICT DO NOTHING`,
      [project2Id, uid, uid === leaderId ? "leader" : "member"]
    );
  }

  const taskSeeds = [
    ["تحليل متطلبات النظام", "todo", "high", memberId, "2025-01-10", "2025-03-01", 0],
    ["تصميم قاعدة البيانات", "in_progress", "high", leaderId, "2025-02-01", "2025-03-15", 40],
    ["تطوير وحدة المصادقة", "review", "high", leaderId, "2025-02-20", "2025-04-01", 80],
    ["بناء لوحة التحكم", "completed", "medium", memberId, "2025-03-01", "2025-05-10", 100],
    ["إعداد بيئة الإنتاج", "todo", "medium", memberId, "2025-05-01", "2025-07-01", 0],
    ["إعداد خطة المحتوى", "completed", "medium", leaderId, "2025-04-05", "2025-04-20", 100],
    ["تصميم الصفحة الرئيسية", "in_progress", "high", memberId, "2025-04-15", "2025-06-15", 30],
    ["تطوير المتجر الإلكتروني", "todo", "critical", leaderId, "2025-06-01", "2025-09-15", 0],
  ];

  for (const [title, status, priority, assignee, start, due, progress] of taskSeeds) {
    const projectId = ["إعداد خطة المحتوى", "تصميم الصفحة الرئيسية", "تطوير المتجر الإلكتروني"].includes(title)
      ? project2Id
      : project1Id;
    await query(
      `INSERT INTO tasks (project_id, title, status, priority, assigned_to, created_by, start_date, due_date, progress)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [projectId, title, status, priority, assignee, managerId, start, due, progress]
    );
  }

  await query(
    `INSERT INTO expenses (project_id, title, amount, category, expense_date, created_by)
     VALUES
       ($1, 'تراخيص البرمجيات', 12500, 'برمجيات', '2025-02-10', $2),
       ($1, 'استضافة سحابية', 4300, 'بنية تحتية', '2025-03-01', $2),
       ($1, 'تصميم الهوية البصرية', 9500, 'تصميم', '2025-04-20', $2)`,
    [project1Id, managerId]
  );

  await query(
    `INSERT INTO meetings (project_id, title, meeting_date, start_time, end_time, location, meeting_url, created_by)
     VALUES
       ($1, 'اجتماع انطلاق المشروع', '2025-02-01', '10:00', '11:00', 'قاعة الاجتماعات', NULL, $2),
       ($1, 'مراجعة منتصف المشروع', '2025-06-15', '14:00', '15:30', 'اجتماع عن بعد', 'https://meet.example.com/erp-review', $2)`,
    [project1Id, managerId]
  );

  await query(
    `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, description)
     VALUES
       ($1, 'create', 'project', $2, 'أنشأ المشروع "نظام إدارة الموارد المؤسسي"'),
       ($1, 'create', 'project', $3, 'أنشأ المشروع "تطوير موقع الشركة الجديد"')`,
    [managerId, project1Id, project2Id]
  );

  await query(
    `INSERT INTO notifications (user_id, type, title, message, related_type, related_id, is_read)
     VALUES
       ($1, 'task', 'تمت إضافة مشروع جديد', 'تمت إضافتك كعضو في مشروع "نظام إدارة الموارد المؤسسي".', 'project', $2, false),
       ($1, 'meeting', 'اجتماع قادم', 'لديك اجتماع "مراجعة منتصف المشروع" يوم 15 يونيو.', 'meeting', NULL, false)`,
    [memberId, project1Id]
  );

  console.log("Seed data created.");
}
