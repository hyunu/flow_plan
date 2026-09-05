import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import { Layout } from './components/Layout'
import { Login } from './pages/Login'
import { Projects } from './pages/Projects'
import { ProjectManage } from './pages/ProjectManage'
import { Dashboard } from './pages/Dashboard'
import { Schedule } from './pages/Schedule'
import { TaskDetail } from './pages/TaskDetail'
import { Challenges } from './pages/Challenges'
import { Reports } from './pages/Reports'
import { Settings } from './pages/Settings'
import { Manual } from './pages/Manual'

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loaded } = useAuth()
  if (!loaded) {
    return (
      <div className="min-h-screen grid place-items-center text-slate-400">
        불러오는 중...
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  const { refreshMe } = useAuth()
  useEffect(() => {
    void refreshMe()
  }, [refreshMe])

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route path="/" element={<Navigate to="/projects" replace />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/manage" element={<ProjectManage />} />
        <Route path="/projects/:id" element={<Dashboard />} />
        <Route path="/projects/:id/schedule" element={<Schedule />} />
        <Route path="/tasks/:id" element={<TaskDetail />} />
        <Route path="/challenges" element={<Challenges />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/manual" element={<Manual />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}