export interface User {
  id: number
  username: string
  email: string
  name: string
  role_id: number
  role_name?: string
  permissions?: string[]
  is_active: boolean
  profile?: string
}

export interface Role {
  id: number
  name: string
  description?: string
  permissions?: string[]
}

export interface PermissionDef {
  key: string
  label: string
  desc: string
}

export interface PermissionGroup {
  key: string
  label: string
  perms: PermissionDef[]
}

export interface Project {
  id: number
  name: string
  description?: string
  manager_id?: number
  status: string
  created_at: string
}

export interface ProjectMember {
  id: number
  project_id: number
  user_id: number
  role_in_project: string
  user_name?: string
}

export interface ProjectDetail extends Project {
  members: ProjectMember[]
}

export interface Assignment {
  id: number
  task_id: number
  user_id: number
  workload_hours: number
  user_name?: string
}

export interface Task {
  id: number
  project_id: number
  group_id?: number
  parent_id?: number
  title: string
  description?: string
  baseline_start?: string
  baseline_end?: string
  baseline_workload?: number
  plan_start?: string
  plan_end?: string
  workload: number
  actual_start?: string
  actual_end?: string
  status: string
  task_type: string
  schedule_progress: number
  work_progress: number
  user_adjustment: number
  effective_progress: number
  is_issue: boolean
  created_at: string
  updated_at: string
  assignments: Assignment[]
  children?: Task[]
  group_name?: string
  delay_days?: number
  is_critical?: boolean
  forecast_finish?: string
  total_float?: number
}

export interface Dependency {
  id: number
  predecessor_id: number
  successor_id: number
  dependency_type: string
  lag_days: number
}

export interface Group {
  id: number
  project_id: number
  name: string
  description?: string
  sort_order: number
}

export interface Milestone {
  id: number
  project_id: number
  name: string
  description?: string
  sort_order: number
  start_date?: string
  end_date?: string
  progress: number
  status: string
  owner_id?: number
}

export interface CriticalPathItem {
  task_id: number
  title: string
  total_float: number
  free_float: number
  early_start?: string
  early_finish?: string
  late_start?: string
  late_finish?: string
  is_critical: boolean
}

export interface ScheduleAnalysis {
  plan_progress: number
  actual_progress: number
  progress_gap: number
  planned_finish?: string
  forecast_finish?: string
  schedule_delay_days?: number
  critical_path: CriticalPathItem[]
}

export interface DashboardData {
  project_name: string
  overall_progress: number
  plan_progress: number
  progress_gap: number
  planned_finish?: string
  forecast_finish?: string
  expected_delay_days: number
  risk_level: string
  plan_curve?: { date: string; pct: number }[]
  milestones: Milestone[]
  critical_path: { task_id: number; title: string; delay_days: number; total_float: number }[]
  delayed_tasks: { task_id: number; title: string; delay_days: number; forecast_finish?: string }[]
  issues: { id: number; title: string; status: string; resolve_plan_date?: string; cause?: string; solution?: string }[]
  user_workload: { user_id: number; name: string; workload_hours: number; delayed_tasks: number; critical_tasks: number; issue_tasks: number }[]
  recent_changes: { task_id: number; changed_at: string; reason?: string; before_end?: string; after_end?: string }[]
  ai_summary?: string
}

export interface ProgressUpdate {
  id: number
  task_id: number
  author_id: number
  author_name?: string
  current_status?: string
  work_done?: string
  problems?: string
  delay_cause?: string
  delay_cause_category?: string
  response_plan?: string
  next_plan?: string
  extra_opinion?: string
  expected_delay_days?: number
  recovery_plan?: string
  recovery_expected_date?: string
  created_at: string
}

export interface ScheduleChange {
  id: number
  task_id: number
  before_start?: string
  before_end?: string
  after_start?: string
  after_end?: string
  before_workload?: number
  after_workload?: number
  changed_by: number
  changed_by_name?: string
  changed_at: string
  reason?: string
  user_opinion?: string
}

export interface Challenge {
  id: number
  user_id: number
  project_id: number
  task_id?: number
  priority: string
  category: string
  message: string
  status: string
  created_at: string
}

export interface DailyReport {
  id: number
  user_id: number
  report_date: string
  content: string
  created_at: string
}

export interface Notification {
  id: number
  user_id: number
  channel: string
  type: string
  title: string
  body: string
  link?: string
  is_read: boolean
  created_at: string
}

export interface EmailSettings {
  id: number
  smtp_host: string
  smtp_port: number
  smtp_user?: string
  has_smtp_password: boolean
  from_email: string
  from_name: string
  use_tls: boolean
  enabled: boolean
}

export interface UserSetting {
  user_id: number
  username: string
  name: string
  email: string
  role: string
  is_active: boolean
  deliver_daily: boolean
  deliver_weekly: boolean
}