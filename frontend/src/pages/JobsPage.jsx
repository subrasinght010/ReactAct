import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { createJob, deleteJob, fetchCompanies, fetchJobs, updateJob } from '../api'

const JD_SESSION_KEY = 'tailoredBuilderJdText'
const JOB_META_SESSION_KEY = 'tailoredBuilderJobMeta'

const ROLE_PRESETS = ['Backend', 'Software', 'Fullstack']

function toDateInput(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

function formatDisplayDate(value) {
  if (!value) return '—'
  const s = String(value).slice(0, 10)
  return s || '—'
}

function ExternalLinkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" className="jobs-link-icon">
      <path
        fill="currentColor"
        d="M14 3h2.997v5h-2.005V5.41l-9.3 9.295l-1.416-1.418L14.586 4H14V3zm-9 2.997h6v2H7v10h10v-4.01h2V18a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5.997a2 2 0 0 1 2-2z"
      />
    </svg>
  )
}

function PencilIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83l3.75 3.75l1.84-1.82z"
      />
    </svg>
  )
}

function emptyJobForm() {
  return {
    editingId: null,
    company: '',
    new_company_name: '',
    job_id: '',
    role: '',
    job_link: '',
    jd_text: '',
    date_of_posting: toDateInput(new Date().toISOString()),
    applied_at: '',
    is_closed: false,
    is_removed: false,
    tailored_resume_file: null,
    existing_tailored_resume_url: '',
  }
}

function JobsPage() {
  const access = localStorage.getItem('access') || ''
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [selectedIds, setSelectedIds] = useState([])
  const [companyOptions, setCompanyOptions] = useState([])
  const [companyReloadTick, setCompanyReloadTick] = useState(0)
  const [jobForm, setJobForm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({
    companyName: '',
    postingDate: '',
    appliedDate: '',
    jobId: '',
    role: '',
    applied: 'all',
  })
  const [ordering, setOrdering] = useState('-date_of_posting')

  const bumpFilters = (patch) => {
    setFilters((prev) => ({ ...prev, ...patch }))
    setPage(1)
  }

  const load = useCallback(async () => {
    if (!access) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const data = await fetchJobs(access, {
        page,
        page_size: pageSize,
        company_name: filters.companyName.trim() || undefined,
        posting_date: filters.postingDate || undefined,
        applied_date: filters.appliedDate || undefined,
        job_id: filters.jobId.trim() || undefined,
        role: filters.role.trim() || undefined,
        applied: filters.applied === 'all' ? undefined : filters.applied,
        ordering,
      })
      const list = Array.isArray(data?.results) ? data.results : []
      setRows(list)
      setTotalCount(Number(data?.count ?? list.length))
      setTotalPages(Number(data?.total_pages || 1))
    } catch (err) {
      setError(err.message || 'Failed to load jobs.')
    } finally {
      setLoading(false)
    }
  }, [access, page, pageSize, filters, ordering])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!access) return
    let cancelled = false
    ;(async () => {
      try {
        const data = await fetchCompanies(access, { page: 1, page_size: 200 })
        const list = Array.isArray(data?.results) ? data.results : []
        if (!cancelled) setCompanyOptions(list)
      } catch {
        if (!cancelled) setCompanyOptions([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [access, companyReloadTick])

  const openCreateForm = () => {
    setJobForm(emptyJobForm())
  }

  const openEditForm = (row) => {
    setJobForm({
      editingId: row.id,
      company: row.company != null ? String(row.company) : '',
      new_company_name: '',
      job_id: row.job_id || '',
      role: row.role || '',
      job_link: row.job_link || '',
      jd_text: row.jd_text || '',
      date_of_posting: toDateInput(row.date_of_posting),
      applied_at: toDateInput(row.applied_at),
      is_closed: Boolean(row.is_closed),
      is_removed: Boolean(row.is_removed),
      tailored_resume_file: null,
      existing_tailored_resume_url: row.tailored_resume_file_url || '',
    })
  }

  const appendCompanyToPayload = (payload, companySel, newCompanyRaw) => {
    const rawNew = String(newCompanyRaw || '').trim()
    if (rawNew) {
      return { ...payload, new_company_name: rawNew }
    }
    if (companySel) {
      return { ...payload, company: Number(companySel) }
    }
    return payload
  }

  const appendCompanyToFormData = (fd, companySel, newCompanyRaw) => {
    const rawNew = String(newCompanyRaw || '').trim()
    if (rawNew) {
      fd.append('new_company_name', rawNew)
    } else if (companySel) {
      fd.append('company', String(companySel))
    }
  }

  const submitJobForm = async () => {
    if (!jobForm) return
    const jobId = String(jobForm.job_id || '').trim()
    const role = String(jobForm.role || '').trim()
    const companySel = String(jobForm.company || '').trim()
    const rawNew = String(jobForm.new_company_name || '').trim()
    if (!jobId || !role) {
      setError('Job ID and Role are required.')
      return
    }
    if (!rawNew && !companySel) {
      setError('Select a company or enter a new company name.')
      return
    }
    try {
      const jd = String(jobForm.jd_text || '')
      const base = {
        job_id: jobId,
        role,
        job_link: String(jobForm.job_link || '').trim(),
        jd_text: jd,
        date_of_posting: jobForm.date_of_posting || null,
        applied_at: jobForm.applied_at || null,
        is_closed: Boolean(jobForm.is_closed),
        is_removed: Boolean(jobForm.is_removed),
      }

      if (jobForm.tailored_resume_file) {
        const fd = new FormData()
        appendCompanyToFormData(fd, companySel, rawNew)
        fd.append('job_id', jobId)
        fd.append('role', role)
        fd.append('job_link', String(jobForm.job_link || '').trim())
        fd.append('jd_text', jd)
        if (jobForm.date_of_posting) fd.append('date_of_posting', String(jobForm.date_of_posting))
        if (jobForm.applied_at) fd.append('applied_at', String(jobForm.applied_at))
        fd.append('is_closed', jobForm.is_closed ? 'true' : 'false')
        fd.append('is_removed', jobForm.is_removed ? 'true' : 'false')
        fd.append('tailored_resume_file', jobForm.tailored_resume_file)
        if (jobForm.editingId) {
          await updateJob(access, jobForm.editingId, fd)
        } else {
          await createJob(access, fd)
        }
      } else {
        let jsonPayload = { ...base }
        jsonPayload = appendCompanyToPayload(jsonPayload, companySel, rawNew)
        if (jobForm.editingId) {
          await updateJob(access, jobForm.editingId, jsonPayload)
        } else {
          await createJob(access, jsonPayload)
        }
      }
      setJobForm(null)
      setCompanyReloadTick((t) => t + 1)
      await load()
    } catch (err) {
      setError(err.message || 'Could not save job.')
    }
  }

  const goTailorWithJob = (job) => {
    sessionStorage.setItem(JD_SESSION_KEY, String(job.jd_text || ''))
    sessionStorage.setItem(
      JOB_META_SESSION_KEY,
      JSON.stringify({
        id: job.id,
        job_id: job.job_id,
        role: job.role,
        company_name: job.company_name,
        job_link: job.job_link,
      }),
    )
    navigate('/tailored-builder')
  }

  const toggleSelect = (rowId, checked) => {
    setSelectedIds((prev) => {
      if (checked) return Array.from(new Set([...prev, rowId]))
      return prev.filter((id) => id !== rowId)
    })
  }

  const allSelected = rows.length > 0 && rows.every((row) => selectedIds.includes(row.id))
  const toggleSelectAll = (checked) => {
    setSelectedIds(checked ? rows.map((row) => row.id) : [])
  }

  const removeSelected = async () => {
    const toDelete = [...selectedIds]
    await Promise.all(
      toDelete.map(async (id) => {
        try {
          await deleteJob(access, id)
        } catch {
          // ignore single failures
        }
      }),
    )
    setSelectedIds([])
    await load()
  }

  return (
    <main className="page page-wide page-plain mx-auto w-full">
      <div className="tracking-head">
        <div>
          <h1>Jobs</h1>
          <p className="subtitle">Filter in one row, add or edit jobs, create a company by name when it is not in the list (names are trimmed and de-duplicated).</p>
        </div>
        <div className="actions">
          <button type="button" className="secondary" onClick={openCreateForm}>Add job</button>
          <button type="button" className="secondary" onClick={removeSelected} disabled={!selectedIds.length}>
            Remove selected
          </button>
        </div>
      </div>

      <section className="tracking-filters filters-one-row jobs-filters-one-row">
        <label>
          Company
          <input
            value={filters.companyName}
            onChange={(e) => bumpFilters({ companyName: e.target.value })}
            placeholder="Contains…"
          />
        </label>
        <label>
          Posting
          <input
            type="date"
            value={filters.postingDate}
            onChange={(e) => bumpFilters({ postingDate: e.target.value })}
          />
        </label>
        <label>
          Applied
          <input
            type="date"
            value={filters.appliedDate}
            onChange={(e) => bumpFilters({ appliedDate: e.target.value })}
          />
        </label>
        <label>
          Job ID
          <input value={filters.jobId} onChange={(e) => bumpFilters({ jobId: e.target.value })} placeholder="Contains…" />
        </label>
        <label>
          Role
          <input value={filters.role} onChange={(e) => bumpFilters({ role: e.target.value })} placeholder="Contains…" />
        </label>
        <label>
          Applied?
          <select
            value={filters.applied}
            onChange={(e) => bumpFilters({ applied: e.target.value })}
          >
            <option value="all">All</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </label>
        <label>
          Sort
          <select
            value={ordering}
            onChange={(e) => {
              setOrdering(e.target.value)
              setPage(1)
            }}
          >
            <option value="-date_of_posting">Posting ↓</option>
            <option value="date_of_posting">Posting ↑</option>
            <option value="-applied_at">Applied ↓</option>
            <option value="applied_at">Applied ↑</option>
            <option value="-created_at">Created ↓</option>
            <option value="created_at">Created ↑</option>
            <option value="role">Role A–Z</option>
            <option value="-role">Role Z–A</option>
            <option value="job_id">Job ID A–Z</option>
            <option value="-job_id">Job ID Z–A</option>
            <option value="company_name">Company A–Z</option>
            <option value="-company_name">Company Z–A</option>
          </select>
        </label>
      </section>

      {error ? <p className="error">{error}</p> : null}
      {loading ? <p className="hint">Loading jobs…</p> : null}

      <div className="tracking-table-wrap tracking-table-wrap-compact">
        <table className="tracking-table tracking-table-compact jobs-table">
          <thead>
            <tr>
              <th>
                <input type="checkbox" checked={allSelected} onChange={(e) => toggleSelectAll(e.target.checked)} />
              </th>
              <th>Job ID</th>
              <th>Company</th>
              <th>Role</th>
              <th>Posting date</th>
              <th>Closed</th>
              <th>Removed</th>
              <th>Tailored file</th>
              <th>Job link</th>
              <th>Applied</th>
              <th>Applied date</th>
              <th>Edit</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(row.id)}
                    onChange={(e) => toggleSelect(row.id, e.target.checked)}
                  />
                </td>
                <td>{row.job_id || '—'}</td>
                <td>{row.company_name || '—'}</td>
                <td>{row.role || '—'}</td>
                <td>{formatDisplayDate(row.date_of_posting)}</td>
                <td>{row.is_closed ? 'Yes' : 'No'}</td>
                <td>{row.is_removed ? 'Yes' : 'No'}</td>
                <td>
                  {row.has_tailored_resume ? (
                    <button type="button" className="jobs-tailor-link" onClick={() => goTailorWithJob(row)}>
                      Yes — open tailor
                    </button>
                  ) : (
                    'No'
                  )}
                </td>
                <td>
                  {row.job_link ? (
                    <a
                      href={row.job_link}
                      target="_blank"
                      rel="noreferrer"
                      className="jobs-external-link"
                      title={row.job_link}
                      aria-label="Open job posting in new tab"
                    >
                      <ExternalLinkIcon />
                    </a>
                  ) : (
                    '—'
                  )}
                </td>
                <td>{row.applied ? 'Yes' : 'No'}</td>
                <td>{formatDisplayDate(row.applied_at)}</td>
                <td>
                  <button
                    type="button"
                    className="secondary jobs-edit-btn"
                    onClick={() => openEditForm(row)}
                    aria-label="Edit job"
                    title="Edit job"
                  >
                    <PencilIcon />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!loading && !rows.length ? <p className="hint">No jobs found.</p> : null}

      <div className="table-pagination">
        <button type="button" className="secondary" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
          Previous
        </button>
        <span>
          Page {page} / {Math.max(1, totalPages)} ({totalCount})
        </span>
        <button
          type="button"
          className="secondary"
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
        >
          Next
        </button>
      </div>

      {jobForm ? (
        <div className="modal-overlay">
          <div className="modal-panel modal-panel-jobs">
            <h2>{jobForm.editingId ? 'Edit job' : 'Add job'}</h2>
            <label>
              Company (existing)
              <select
                value={jobForm.company}
                onChange={(e) => setJobForm((prev) => ({ ...prev, company: e.target.value }))}
              >
                <option value="">— Select —</option>
                {companyOptions.map((c) => (
                  <option key={c.id} value={String(c.id)}>{c.name}</option>
                ))}
              </select>
            </label>
            <p className="hint jobs-form-hint">If the company is missing, type a name below. Extra spaces are removed; matching names reuse one company.</p>
            <label>
              New company name
              <input
                value={jobForm.new_company_name}
                onChange={(e) => setJobForm((prev) => ({ ...prev, new_company_name: e.target.value }))}
                placeholder="Creates company if not already listed"
              />
            </label>
            <label>
              Job ID*
              <input value={jobForm.job_id} onChange={(e) => setJobForm((prev) => ({ ...prev, job_id: e.target.value }))} />
            </label>
            <label>
              Role* (preset or custom)
              <input
                value={jobForm.role}
                onChange={(e) => setJobForm((prev) => ({ ...prev, role: e.target.value }))}
                list="job-role-presets-list"
                placeholder="Pick a preset or type your own"
              />
            </label>
            <datalist id="job-role-presets-list">
              {ROLE_PRESETS.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
            <div className="jobs-role-chips">
              {ROLE_PRESETS.map((r) => (
                <button
                  key={r}
                  type="button"
                  className="secondary jobs-role-chip"
                  onClick={() => setJobForm((prev) => ({ ...prev, role: r }))}
                >
                  {r}
                </button>
              ))}
            </div>
            <label>
              Job link
              <input value={jobForm.job_link} onChange={(e) => setJobForm((prev) => ({ ...prev, job_link: e.target.value }))} />
            </label>
            <label>
              JD text
              <textarea
                rows={4}
                value={jobForm.jd_text}
                onChange={(e) => setJobForm((prev) => ({ ...prev, jd_text: e.target.value }))}
              />
            </label>
            <label>
              Date of posting
              <input
                type="date"
                value={jobForm.date_of_posting || ''}
                onChange={(e) => setJobForm((prev) => ({ ...prev, date_of_posting: e.target.value }))}
              />
            </label>
            <label>
              Applied date
              <input
                type="date"
                value={jobForm.applied_at || ''}
                onChange={(e) => setJobForm((prev) => ({ ...prev, applied_at: e.target.value }))}
              />
            </label>
            <div className="jobs-checkbox-row">
              <label className="tracking-check jobs-form-check">
                <input
                  type="checkbox"
                  checked={jobForm.is_closed}
                  onChange={(e) => setJobForm((prev) => ({ ...prev, is_closed: e.target.checked }))}
                />
                <span>Closed (yes)</span>
              </label>
              <label className="tracking-check jobs-form-check">
                <input
                  type="checkbox"
                  checked={jobForm.is_removed}
                  onChange={(e) => setJobForm((prev) => ({ ...prev, is_removed: e.target.checked }))}
                />
                <span>Removed (yes)</span>
              </label>
            </div>
            {jobForm.existing_tailored_resume_url ? (
              <p className="hint">
                Current tailored file:
                {' '}
                <a href={jobForm.existing_tailored_resume_url} target="_blank" rel="noreferrer">Open</a>
              </p>
            ) : null}
            <label>
              {jobForm.editingId ? 'Replace tailored resume file' : 'Tailored resume file'}
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => setJobForm((prev) => ({ ...prev, tailored_resume_file: e.target.files?.[0] || null }))}
              />
            </label>
            <div className="actions">
              <button type="button" onClick={submitJobForm}>{jobForm.editingId ? 'Save' : 'Create'}</button>
              <button type="button" className="secondary" onClick={() => setJobForm(null)}>Cancel</button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}

export default JobsPage
