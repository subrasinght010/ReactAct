import { useEffect, useMemo, useState } from 'react'
import DashboardPage from './pages/DashboardPage'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ResumeBuilderPage from './pages/ResumeBuilderPage'
import ResumePreviewPage from './pages/ResumePreviewPage'
import ErrorBoundary from './components/ErrorBoundary'
import NavBar from './components/NavBar'

function App() {
  const [path, setPath] = useState(window.location.pathname || '/')
  const [isLoggedIn, setIsLoggedIn] = useState(Boolean(localStorage.getItem('access')))
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light')

  useEffect(() => {
    const onPopState = () => {
      setPath(window.location.pathname || '/')
      setIsLoggedIn(Boolean(localStorage.getItem('access')))
    }

    const syncAuth = () => {
      setIsLoggedIn(Boolean(localStorage.getItem('access')))
    }

    window.addEventListener('popstate', onPopState)
    window.addEventListener('storage', syncAuth)
    window.addEventListener('auth-changed', syncAuth)
    return () => {
      window.removeEventListener('popstate', onPopState)
      window.removeEventListener('storage', syncAuth)
      window.removeEventListener('auth-changed', syncAuth)
    }
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('theme', theme)
  }, [theme])

  const navigate = (nextPath) => {
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath)
    }
    setPath(nextPath)
  }

  const auth = useMemo(
    () => ({
      login: (access, refresh) => {
        localStorage.setItem('access', access)
        localStorage.setItem('refresh', refresh)
        setIsLoggedIn(true)
      },
      logout: () => {
        localStorage.removeItem('access')
        localStorage.removeItem('refresh')
        setIsLoggedIn(false)
      },
    }),
    [],
  )

  const renderPage = () => {
    const publicPaths = ['/login', '/register']

    // Hard auth gate: everything except login/register requires auth.
    if (!isLoggedIn && !publicPaths.includes(path)) {
      sessionStorage.setItem('redirectAfterLogin', path)
      navigate('/login')
      return null
    }

    // If already logged in, keep auth pages out of the way.
    if (isLoggedIn && publicPaths.includes(path)) {
      const redirect = sessionStorage.getItem('redirectAfterLogin') || '/dashboard'
      sessionStorage.removeItem('redirectAfterLogin')
      navigate(redirect)
      return null
    }

    if (path === '/login') {
      return <LoginPage navigate={navigate} login={auth.login} />
    }

    if (path === '/register') {
      return <RegisterPage navigate={navigate} />
    }

    // Authenticated routes
    if (path === '/dashboard') {
      return <DashboardPage navigate={navigate} logout={auth.logout} />
    }

    if (path === '/builder') {
      return <ResumeBuilderPage navigate={navigate} />
    }

    if (path.startsWith('/preview/')) {
      const resumeId = path.split('/')[2] || ''
      return <ResumePreviewPage navigate={navigate} resumeId={resumeId} />
    }

    return <HomePage navigate={navigate} isLoggedIn={isLoggedIn} />
  }

  return (
    <div className="app-shell">
      <ErrorBoundary>
        {isLoggedIn && path !== '/login' && path !== '/register' && (
          <NavBar
            navigate={navigate}
            onLogout={auth.logout}
            currentPath={path}
            theme={theme}
            onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
          />
        )}
        <div className="app-content">{renderPage()}</div>
      </ErrorBoundary>
    </div>
  )
}

export default App
