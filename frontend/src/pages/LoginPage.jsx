import { useState } from 'react'

import { loginUser } from '../api'

function LoginPage({ navigate, login }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
      login(data.access, data.refresh)
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
    <main className="page">
      <h1>Login</h1>
      <form className="form" onSubmit={handleSubmit}>
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

        {error && <p className="error">{error}</p>}

        <div className="actions">
          <button type="submit" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
          <button type="button" className="secondary" onClick={() => navigate('/register')}>
            Register
          </button>
          <button type="button" className="secondary" onClick={() => navigate('/')}>
            Back
          </button>
        </div>
      </form>
    </main>
  )
}

export default LoginPage
