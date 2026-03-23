import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { loginUser } from '../api'
import { useAuth } from '../store/useAuth'

function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { login } = useAuth()

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (!username || !password) {
      setError('Username and password are required.')
      return
    }

    try {
      setLoading(true)
      const data = await loginUser(username, password)
      login(data.access)
      const redirect = sessionStorage.getItem('redirectAfterLogin') || '/dashboard'
      sessionStorage.removeItem('redirectAfterLogin')
      navigate(redirect)
    } catch (err) {
      const message = err.message || 'Login failed'
      if (message.toLowerCase().includes('no active account found')) {
        navigate('/register')
        return
      }
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
      <h1>Login</h1>
      <form className="grid gap-3" onSubmit={handleSubmit}>
        <label htmlFor="username">Username</label>
        <input
          id="username"
          type="text"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="Enter username"
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Enter password"
        />

        {error && <p className="text-sm font-medium text-red-700 dark:text-red-300">{error}</p>}

        <div className="mt-3 flex flex-wrap gap-3">
          <button type="submit" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
          <button
            type="button"
            className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100 dark:hover:bg-slate-800"
            onClick={() => navigate('/register')}
          >
            Register
          </button>
          <button
            type="button"
            className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100 dark:hover:bg-slate-800"
            onClick={() => navigate('/')}
          >
            Back
          </button>
        </div>
      </form>
    </main>
  )
}

export default LoginPage
