import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { fetchTrackingRow } from '../api'

function formatTemplateType(value) {
  const raw = String(value || '').trim()
  if (!raw) return '-'
  return raw.replaceAll('_', ' ')
}

function toFriendlyDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString()
}

function TrackingDetailPage() {
  const access = localStorage.getItem('access') || ''
  const { trackingId } = useParams()
  const navigate = useNavigate()
  const [row, setRow] = useState(null)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const data = await fetchTrackingRow(access, trackingId)
        if (!cancelled) {
          setRow(data)
          const firstEmployee = Array.isArray(data?.selected_employees) ? data.selected_employees[0] : null
          setSelectedEmployeeId(firstEmployee?.id ? String(firstEmployee.id) : '')
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load tracking detail.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [access, trackingId])

  const employeeOptions = Array.isArray(row?.selected_employees) ? row.selected_employees : []
  const filteredMailEvents = Array.isArray(row?.mail_events)
    ? row.mail_events.filter((item) => {
      if (!selectedEmployeeId) return true
      return String(item.employee_id || '') === String(selectedEmployeeId)
    })
    : []
  const scopedEvents = filteredMailEvents
  const mailedAt = scopedEvents.length
    ? scopedEvents[0]?.action_at || ''
    : (row?.mailed_at || row?.maild_at || '')
  const repliedEvents = scopedEvents.filter((item) => Boolean(item.got_replied))
  const repliedAt = repliedEvents.length ? repliedEvents[0]?.action_at || '' : (row?.replied_at || '')
  const repliedBy = Array.from(new Set(
    repliedEvents
      .map((item) => String(item.employee_name || '').trim())
      .filter(Boolean),
  ))

  return (
    <main className="page page-wide mx-auto w-full">
      <div className="tracking-head">
        <div>
          <h1>Tracking Detail</h1>
          <p className="subtitle">Summary, employee-wise mail chat history, and actions.</p>
        </div>
        <div className="actions">
          <button type="button" className="secondary" onClick={() => navigate('/tracking', { replace: true })}>Back</button>
        </div>
      </div>

      {loading ? <p className="hint">Loading...</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {row ? (
        <>
          <section className="dash-card">
            <h2>Summary</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <p><strong>Company:</strong> {row.company_name || '-'}</p>
              <p><strong>Job ID:</strong> {row.job_id || '-'}</p>
              <p><strong>Role:</strong> {row.role || '-'}</p>
              <p><strong>Job URL:</strong> {row.job_url ? <a href={row.job_url} target="_blank" rel="noreferrer">Open</a> : '-'}</p>
              <p><strong>Selected HR:</strong> {Array.isArray(row.selected_hrs) && row.selected_hrs.length ? row.selected_hrs.join(', ') : '-'}</p>
              <p><strong>Status:</strong> {row.is_open ? 'Open' : 'Closed'}</p>
              <p><strong>Template Type:</strong> {formatTemplateType(row.template_choice)}</p>
              <p><strong>Selected Resume:</strong> {row.resume_preview?.title || row.tailored_resume_preview?.title || '-'}</p>
              <p><strong>Freeze:</strong> {row.is_freezed ? 'Yes' : 'No'}</p>
              <p><strong>Created At:</strong> {toFriendlyDateTime(row.created_at)}</p>
              <p><strong>Last Updated:</strong> {toFriendlyDateTime(row.updated_at)}</p>
              <p><strong>Mailed:</strong> {(row.mailed || scopedEvents.length) ? 'Yes' : 'No'} {mailedAt ? `(${toFriendlyDateTime(mailedAt)})` : ''}</p>
              <p><strong>Got Response:</strong> {(row.got_replied || repliedEvents.length) ? 'Yes' : 'No'} {repliedAt ? `(${toFriendlyDateTime(repliedAt)})` : ''}</p>
              <p><strong>Response From Employee:</strong> {repliedBy.length ? repliedBy.join(', ') : '-'}</p>
            </div>
          </section>

          <section className="dash-card">
            <div className="flex justify-end">
              <label className="min-w-[280px]">
                Select Employee
                <select value={selectedEmployeeId} onChange={(event) => setSelectedEmployeeId(event.target.value)}>
                  <option value="">All selected employees</option>
                  {employeeOptions.map((item) => (
                    <option key={item.id} value={item.id}>{item.name || `Employee #${item.id}`}</option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="dash-card">
            <h2>Mail Chat History</h2>
            <table className="tracking-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>To</th>
                  <th>Subject</th>
                  <th>Message / Notes</th>
                  <th>At</th>
                </tr>
              </thead>
              <tbody>
                {filteredMailEvents.map((item) => (
                  <tr key={`chat-${item.id}`}>
                    <td>{item.employee_name || '-'}</td>
                    <td>{item.to_email || '-'}</td>
                    <td>{item.subject || '-'}</td>
                    <td>{item.message || item.notes || '-'}</td>
                    <td>{toFriendlyDateTime(item.action_at)}</td>
                  </tr>
                ))}
                {!filteredMailEvents.length ? (
                  <tr><td colSpan={5}>No mail chat history available for this employee.</td></tr>
                ) : null}
              </tbody>
            </table>
          </section>

          <section className="dash-card">
            <h2>Action Taken</h2>
            <table className="tracking-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Mode</th>
                  <th>Replied</th>
                  <th>At</th>
                </tr>
              </thead>
              <tbody>
                {filteredMailEvents.map((item) => (
                  <tr key={`action-${item.id}`}>
                    <td>{item.mail_type || '-'}</td>
                    <td>{item.send_mode || '-'}</td>
                    <td>{item.got_replied ? 'Yes' : 'No'}</td>
                    <td>{toFriendlyDateTime(item.action_at)}</td>
                  </tr>
                ))}
                {!filteredMailEvents.length ? (
                  <tr><td colSpan={4}>No actions available for this employee.</td></tr>
                ) : null}
              </tbody>
            </table>
          </section>
        </>
      ) : null}
    </main>
  )
}

export default TrackingDetailPage
