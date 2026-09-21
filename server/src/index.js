import express from "express";
import { migrate, seed } from "./db.js";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import projectRoutes from "./routes/projects.js";
import taskRoutes from "./routes/tasks.js";
import expenseRoutes from "./routes/expenses.js";
import meetingRoutes from "./routes/meetings.js";
import notificationRoutes from "./routes/notifications.js";
import activityRoutes from "./routes/activity.js";
import reportRoutes from "./routes/reports.js";
import dashboardRoutes from "./routes/dashboard.js";
import calendarRoutes from "./routes/calendar.js";

const app = express();
app.use(express.json({ limit: "1mb" }));

// Health check
app.get("/api/health", (_req, res) => res.json({ success: true, message: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/meetings", meetingRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/activity-logs", activityRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/calendar", calendarRoutes);

// 404 for unknown API routes
app.use("/api", (_req, res) =>
  res.status(404).json({ success: false, message: "المسار غير موجود.", errors: [] })
);

// Global error handler (no stack traces to the client)
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({
    success: false,
    message: "حدث خطأ داخلي في الخادم.",
    errors: [],
  });
});

const PORT = process.env.PORT || 4000;

async function start() {
  try {
    await migrate();
    await seed();
    app.listen(PORT, () => console.log(`PMS API running on port ${PORT}`));
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

start();
