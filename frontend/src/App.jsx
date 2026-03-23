import { Navigate, Route, Routes, useLocation } from 'react-router-dom'

import DashboardPage from './pages/DashboardPage'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ResumeBuilderPage from './pages/ResumeBuilderPage'
import ResumePreviewPage from './pages/ResumePreviewPage'
import ErrorBoundary from './components/ErrorBoundary'
import NavBar from './components/NavBar'
import { useAuth } from './store/useAuth'

function AuthBootScreen() {
  return (
    <main className="mx-auto w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
      <p className="mb-5 text-sm text-slate-500 dark:text-slate-400">Checking session...</p>
    </main>
  )
}

function RequireAuth({ children }) {
  const { isLoggedIn, authReady } = useAuth()
  const location = useLocation()

  if (!authReady) {
    return <AuthBootScreen />
  }

  if (!isLoggedIn) {
    sessionStorage.setItem('redirectAfterLogin', location.pathname || '/')
    return <Navigate to="/login" replace />
  }

  return children
}

function PublicOnly({ children }) {
  const { isLoggedIn, authReady } = useAuth()

  if (!authReady) {
    return <AuthBootScreen />
  }

  if (!isLoggedIn) return children

  const redirect = sessionStorage.getItem('redirectAfterLogin') || '/dashboard'
  sessionStorage.removeItem('redirectAfterLogin')
  return <Navigate to={redirect} replace />
}

function AppLayout() {
  const { isLoggedIn, authReady } = useAuth()
  const location = useLocation()
  const showNav = authReady && isLoggedIn && location.pathname !== '/login' && location.pathname !== '/register'

  return (
    <div className="min-h-screen">
      <ErrorBoundary>
        {showNav && <NavBar />}
        <div className="mx-auto w-full px-4 py-6 md:px-6">
          <Routes>
            <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
            <Route path="/register" element={<PublicOnly><RegisterPage /></PublicOnly>} />
            <Route path="/" element={<RequireAuth><HomePage /></RequireAuth>} />
            <Route path="/dashboard" element={<RequireAuth><DashboardPage /></RequireAuth>} />
            <Route path="/builder" element={<RequireAuth><ResumeBuilderPage /></RequireAuth>} />
            <Route path="/preview/:resumeId" element={<RequireAuth><ResumePreviewPage /></RequireAuth>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </ErrorBoundary>
    </div>
  )
}

function App() {
  return <AppLayout />
}

export default App
