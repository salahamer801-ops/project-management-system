export interface User {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  avatar?: string | null;
  status: string;
  last_login_at?: string | null;
  created_at?: string;
}

export interface Project {
  id: number;
  name: string;
  code?: string | null;
  description?: string | null;
  manager_id?: number | null;
  manager_name?: string | null;
  status: string;
  priority: string;
  start_date?: string | null;
  end_date?: string | null;
  budget: number;
  progress: number;
  created_by?: number | null;
  created_at?: string;
  tasks_total?: number;
  tasks_completed?: number;
  expenses_total?: number;
  remaining?: number;
  expense_percentage?: number;
}

export interface Task {
  id: number;
  project_id: number;
  project_name?: string;
  title: string;
  description?: string | null;
  assigned_to?: number | null;
  assignee_name?: string | null;
  created_by?: number | null;
  status: string;
  priority: string;
  start_date?: string | null;
  due_date?: string | null;
  completed_at?: string | null;
  progress: number;
  created_at?: string;
  updated_at?: string;
}

export interface Expense {
  id: number;
  project_id: number;
  project_name?: string;
  title: string;
  description?: string | null;
  amount: number;
  category?: string | null;
  expense_date?: string | null;
  created_by?: number | null;
  creator_name?: string | null;
  created_at?: string;
}

export interface Meeting {
  id: number;
  project_id: number;
  project_name?: string;
  title: string;
  description?: string | null;
  meeting_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  location?: string | null;
  meeting_url?: string | null;
  created_by?: number | null;
  creator_name?: string | null;
  created_at?: string;
}

export interface Notification {
  id: number;
  user_id: number;
  type?: string | null;
  title: string;
  message?: string | null;
  related_type?: string | null;
  related_id?: number | null;
  is_read: boolean;
  created_at: string;
  read_at?: string | null;
}

export interface ActivityLog {
  id: number;
  user_id?: number | null;
  user_name?: string | null;
  action: string;
  entity_type?: string | null;
  entity_id?: number | null;
  description?: string | null;
  created_at: string;
}

export interface Member {
  id: number;
  project_id: number;
  user_id: number;
  project_role: string;
  status: string;
  joined_at: string;
  name: string;
  email: string;
  role: string;
  avatar?: string | null;
}
