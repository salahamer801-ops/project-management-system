import { Router } from "express";
import { query } from "../db.js";
import { requireAuth } from "../auth.js";
import { asyncHandler, visibleProjectIds, ok } from "../util.js";

const router = Router();
router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const ids = await visibleProjectIds(req.user);
    const params = [];
    let whereTasks = "";
    let whereMeetings = "";
    if (ids !== null) {
      params.push(ids);
      whereTasks = `WHERE t.project_id = ANY($1::int[])`;
      whereMeetings = `WHERE m.project_id = ANY($1::int[])`;
    }

    const tasks = await query(
      `SELECT t.id, t.title, t.status, t.priority, t.due_date, t.start_date,
              p.name AS project_name, t.assigned_to, u.name AS assignee_name
       FROM tasks t
       LEFT JOIN projects p ON p.id = t.project_id
       LEFT JOIN users u ON u.id = t.assigned_to
       ${whereTasks}
       ORDER BY t.due_date ASC`,
      params
    );

    const meetings = await query(
      `SELECT m.id, m.title, m.meeting_date, m.start_time, m.end_time, m.location, m.meeting_url, p.name AS project_name
       FROM meetings m
       LEFT JOIN projects p ON p.id = m.project_id
       ${whereMeetings}
       ORDER BY m.meeting_date ASC`,
      params
    );

    const events = [
      ...tasks.rows.map((t) => ({
        id: `task-${t.id}`,
        kind: "task",
        title: t.title,
        date: t.due_date,
        status: t.status,
        priority: t.priority,
        project: t.project_name,
        assignee: t.assignee_name,
      })),
      ...meetings.rows.map((m) => ({
        id: `meeting-${m.id}`,
        kind: "meeting",
        title: m.title,
        date: m.meeting_date,
        start_time: m.start_time,
        end_time: m.end_time,
        location: m.location,
        project: m.project_name,
      })),
    ].filter((e) => e.date);

    return ok(res, events);
  })
);

export default router;
