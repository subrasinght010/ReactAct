import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const STORAGE_KEY = 'jobApplicationMessageTemplates'

function readTemplates() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function MessageTemplatesPage() {
  const navigate = useNavigate()
  const [templates, setTemplates] = useState(() => readTemplates())
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
  }, [templates])

  const addTemplate = () => {
    const n = String(name || '').trim()
    const m = String(message || '').trim()
    if (!n || !m) return
    setTemplates((prev) => [{ id: Date.now(), name: n, message: m }, ...prev])
    setName('')
    setMessage('')
  }

  const removeTemplate = (id) => {
    setTemplates((prev) => prev.filter((row) => row.id !== id))
  }

  return (
    <main className="page page-wide mx-auto w-full">
      <div className="tracking-head">
        <div>
          <h1>Templates</h1>
          <p className="subtitle">Manage quick message templates for outreach.</p>
        </div>
        <div className="actions">
          <button type="button" className="secondary" onClick={() => navigate('/profile')}>Back Profile</button>
        </div>
      </div>

      <section className="dash-card">
        <h2>Add Template</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label>Name<input value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="md:col-span-2">Message<textarea rows={6} value={message} onChange={(e) => setMessage(e.target.value)} /></label>
        </div>
        <div className="actions">
          <button type="button" onClick={addTemplate}>Save Template</button>
        </div>
      </section>

      <section className="dash-card">
        <h2>Saved Templates</h2>
        <table className="tracking-table">
          <thead><tr><th>Name</th><th>Message</th><th>Action</th></tr></thead>
          <tbody>
            {templates.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td>{row.message}</td>
                <td><button type="button" className="tracking-icon-btn is-danger" onClick={() => removeTemplate(row.id)}>Delete</button></td>
              </tr>
            ))}
            {!templates.length ? <tr><td colSpan={3}>No templates yet.</td></tr> : null}
          </tbody>
        </table>
      </section>
    </main>
  )
}

export default MessageTemplatesPage
