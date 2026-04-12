import { Fragment, useEffect, useMemo, useState } from 'react'

import {
  createTrackingRow,
  deleteTrackingRow,
  fetchTrackingRows,
  updateTrackingRow,
} from '../api'

const EMPTY_MILESTONE_DOTS = 10

function toDateInput(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

function formatMilestoneLabel(item) {
  if (!item) return '--'
  const type = item.type === 'followup' ? 'Follow Up' : 'Fresh'
  const date = item.at ? new Date(item.at) : null
  const timeText = date && !Number.isNaN(date.getTime())
    ? `${toDateInput(item.at)} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : '--'
  return `${type} | ${timeText}`
}

function rowHasFreshMilestone(row) {
  return (row?.milestones || []).some((item) => item.type === 'fresh')
}

function rowLastActionType(row) {
  const items = row?.milestones || []
  if (!items.length) return ''
  return String(items[items.length - 1]?.type || '')
}

function buildHrOptions(row) {
  const names = Array.isArray(row?.available_hrs) ? row.available_hrs : []
  const ids = Array.isArray(row?.available_hr_ids) ? row.available_hr_ids : []
  return names.map((name, index) => ({
    id: ids[index] || null,
    name: String(name || '').trim(),
  })).filter((item) => item.name)
}

function uniqueArray(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).map((x) => String(x || '').trim()).filter(Boolean)))
}

function TrackingPage() {
  const access = localStorage.getItem('access') || ''
  const [rows, setRows] = useState([])
  const [page, setPage] = useState(1)
  const [pageSize] = useState(8)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [selectedIds, setSelectedIds] = useState([])
  const [rowControls, setRowControls] = useState({})
  const [applyStateByRow, setApplyStateByRow] = useState({})
  const [openHrPickerId, setOpenHrPickerId] = useState(null)
  const [createForm, setCreateForm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({
    companyName: '',
    jobId: '',
    appliedDate: '',
    mailed: 'all',
    gotReplied: 'all',
    lastAction: 'all',
    orderByApplied: 'desc',
  })
  const [editForm, setEditForm] = useState(null)

  const load = async () => {
    if (!access) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const data = await fetchTrackingRows(access, { page, page_size: pageSize })
      const list = Array.isArray(data?.results) ? data.results : (Array.isArray(data) ? data : [])
      setRows(list)
      setTotalCount(Number(data?.count || list.length || 0))
      setTotalPages(Number(data?.total_pages || 1))
      if (data?.page && Number(data.page) !== page) {
        setPage(Number(data.page))
      }
      setRowControls((prev) => {
        const next = { ...prev }
        for (const row of list) {
          const key = String(row.id)
          if (!next[key]) {
            next[key] = {
              actionType: rowHasFreshMilestone(row) ? 'followup' : 'fresh',
              sendMode: 'now',
              actionAt: '',
            }
          }
        }
        return next
      })
    } catch (err) {
      setError(err.message || 'Failed to load tracking rows.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [access, page, pageSize])

  const openCreateForm = () => {
    setCreateForm({
      company_name: '',
      job_id: '',
      role: '',
      job_url: '',
      tailored_resume_file: '',
      tailored_resume_upload: null,
      mailed: false,
      got_replied: false,
      applied_date: toDateInput(new Date().toISOString()),
      posting_date: toDateInput(new Date().toISOString()),
      is_open: true,
      selected_hrs: [],
    })
  }

  const createRow = async () => {
    if (!createForm) return
    const companyName = String(createForm.company_name || '').trim()
    const jobId = String(createForm.job_id || '').trim()
    const role = String(createForm.role || '').trim()
    if (!companyName || !jobId || !role) {
      setError('Company Name, Job ID, and Role are required.')
      return
    }
    try {
      const payload = createForm.tailored_resume_upload ? new FormData() : {
        company_name: companyName,
        job_id: jobId,
        role,
        job_url: String(createForm.job_url || '').trim(),
        mailed: Boolean(createForm.mailed),
        got_replied: Boolean(createForm.got_replied),
        applied_date: createForm.applied_date || null,
        posting_date: createForm.posting_date || null,
        is_open: Boolean(createForm.is_open),
        selected_hrs: Array.isArray(createForm.selected_hrs) ? createForm.selected_hrs : [],
      }
      if (payload instanceof FormData) {
        payload.append('company_name', companyName)
        payload.append('job_id', jobId)
        payload.append('role', role)
        payload.append('job_url', String(createForm.job_url || '').trim())
        payload.append('mailed', String(Boolean(createForm.mailed)))
        payload.append('got_replied', String(Boolean(createForm.got_replied)))
        payload.append('applied_date', String(createForm.applied_date || ''))
        payload.append('posting_date', String(createForm.posting_date || ''))
        payload.append('is_open', String(Boolean(createForm.is_open)))
        payload.append('tailored_resume_upload', createForm.tailored_resume_upload)
      }
      const created = await createTrackingRow(access, payload)
      setRows((prev) => [created, ...prev])
      setRowControls((prev) => ({
        ...prev,
        [String(created.id)]: {
          actionType: 'fresh',
          sendMode: 'now',
          actionAt: '',
        },
      }))
      setCreateForm(null)
      await load()
    } catch (err) {
      setError(err.message || 'Could not create tracking row.')
    }
  }

  const updateHrQuick = async (row, selectedValues) => {
    const hrOptions = buildHrOptions(row)
    const selected = uniqueArray(selectedValues)
    const selectedHrIds = Array.from(
      new Set(
        hrOptions
          .filter((item) => selected.includes(item.name) && item.id)
          .map((item) => Number(item.id))
          .filter((id) => Number.isFinite(id)),
      ),
    )
    try {
      const updated = await updateTrackingRow(access, row.id, {
        selected_hrs: selected,
        selected_hr_ids: selectedHrIds,
      })
      setRows((prev) => prev.map((item) => (item.id === row.id ? updated : item)))
    } catch (err) {
      setError(err.message || 'Could not update HR selection.')
    }
  }

  const toggleFreeze = async (row) => {
    try {
      const updated = await updateTrackingRow(access, row.id, { is_freezed: !row.is_freezed })
      setRows((prev) => prev.map((item) => (item.id === row.id ? updated : item)))
    } catch (err) {
      setError(err.message || 'Could not update freeze state.')
    }
  }

  const openEditForm = (row) => {
    const hrOptions = buildHrOptions(row)
    setEditForm({
      id: row.id,
      company: row.company || '',
      company_name: row.company_name || '',
      job_id: row.job_id || '',
      role: row.role || '',
      job_url: row.job_url || '',
      tailored_resume_file: row.tailored_resume_file || '',
      tailored_resume_upload: null,
      mailed: Boolean(row.mailed),
      applied_date: toDateInput(row.applied_date),
      posting_date: toDateInput(row.posting_date),
      is_open: Boolean(row.is_open),
      hrOptions,
      selected_hrs: uniqueArray(row.selected_hrs),
      got_replied: Boolean(row.got_replied),
    })
  }

  const saveEditForm = async () => {
    if (!editForm) return
    const uniqueSelectedHrs = uniqueArray(editForm.selected_hrs)
    const selectedHrIds = editForm.hrOptions
      .filter((option) => uniqueSelectedHrs.includes(option.name) && option.id)
      .map((option) => option.id)
    const basePayload = {
      company: editForm.company || null,
      company_name: editForm.company_name,
      job_id: editForm.job_id,
      role: editForm.role,
      job_url: editForm.job_url,
      mailed: editForm.mailed,
      applied_date: editForm.applied_date || null,
      posting_date: editForm.posting_date || null,
      is_open: editForm.is_open,
      selected_hrs: uniqueSelectedHrs,
      selected_hr_ids: selectedHrIds,
      got_replied: editForm.got_replied,
    }
    try {
      let payload = basePayload
      if (editForm.tailored_resume_upload) {
        payload = new FormData()
        payload.append('company', String(editForm.company || ''))
        payload.append('company_name', String(editForm.company_name || ''))
        payload.append('job_id', String(editForm.job_id || ''))
        payload.append('role', String(editForm.role || ''))
        payload.append('job_url', String(editForm.job_url || ''))
        payload.append('mailed', String(Boolean(editForm.mailed)))
        payload.append('applied_date', String(editForm.applied_date || ''))
        payload.append('posting_date', String(editForm.posting_date || ''))
        payload.append('is_open', String(Boolean(editForm.is_open)))
        payload.append('got_replied', String(Boolean(editForm.got_replied)))
        uniqueSelectedHrs.forEach((name) => payload.append('selected_hrs', name))
        selectedHrIds.forEach((id) => payload.append('selected_hr_ids', String(id)))
        payload.append('tailored_resume_upload', editForm.tailored_resume_upload)
      }
      const updated = await updateTrackingRow(access, editForm.id, payload)
      setRows((prev) => prev.map((row) => (row.id === editForm.id ? updated : row)))
      setEditForm(null)
    } catch (err) {
      setError(err.message || 'Could not save tracking row.')
    }
  }

  const removeRow = async (rowId) => {
    try {
      await deleteTrackingRow(access, rowId)
      setSelectedIds((prev) => prev.filter((id) => id !== rowId))
      await load()
    } catch (err) {
      setError(err.message || 'Could not delete row.')
    }
  }

  const removeSelected = async () => {
    const toDelete = [...selectedIds]
    await Promise.all(
      toDelete.map(async (id) => {
        try {
          await deleteTrackingRow(access, id)
        } catch {
          // no-op
        }
      }),
    )
    setSelectedIds([])
    await load()
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

  const setActionField = (rowId, key, value) => {
    setRowControls((prev) => {
      const current = prev[String(rowId)] || { actionType: 'fresh', sendMode: 'now', actionAt: '' }
      return {
        ...prev,
        [String(rowId)]: {
          ...current,
          [key]: value,
        },
      }
    })
  }

  const applyAction = async (row) => {
    if (row.is_freezed) return
    setApplyStateByRow((prev) => ({
      ...prev,
      [String(row.id)]: { status: 'saving', message: 'Applying...' },
    }))
    const controls = rowControls[String(row.id)] || { actionType: 'fresh', sendMode: 'now', actionAt: '' }
    const canFollowUp = rowHasFreshMilestone(row)
    const actionType = canFollowUp ? controls.actionType : 'fresh'
    if (actionType === 'followup' && !canFollowUp) return
    if (controls.sendMode === 'schedule' && !controls.actionAt) {
      setError('Pick a date/time for scheduled action.')
      setApplyStateByRow((prev) => ({
        ...prev,
        [String(row.id)]: { status: 'error', message: 'Pick date/time' },
      }))
      return
    }
    try {
      const updated = await updateTrackingRow(access, row.id, {
        append_action: {
          type: actionType,
          send_mode: controls.sendMode,
          action_at: controls.sendMode === 'schedule' ? controls.actionAt : null,
        },
      })
      setRows((prev) => prev.map((item) => (item.id === row.id ? updated : item)))
      setApplyStateByRow((prev) => ({
        ...prev,
        [String(row.id)]: { status: 'success', message: 'Applied' },
      }))
      setTimeout(() => {
        setApplyStateByRow((prev) => {
          const next = { ...prev }
          if (next[String(row.id)]?.status === 'success') delete next[String(row.id)]
          return next
        })
      }, 1400)
    } catch (err) {
      setError(err.message || 'Could not apply action.')
      setApplyStateByRow((prev) => ({
        ...prev,
        [String(row.id)]: { status: 'error', message: 'Failed' },
      }))
    }
  }

  const filteredRows = useMemo(() => {
    const out = rows.filter((row) => {
      if (filters.companyName && !String(row.company_name || '').toLowerCase().includes(filters.companyName.toLowerCase())) return false
      if (filters.jobId && !String(row.job_id || '').toLowerCase().includes(filters.jobId.toLowerCase())) return false
      if (filters.appliedDate && toDateInput(row.applied_date) !== filters.appliedDate) return false
      if (filters.mailed === 'yes' && !row.mailed) return false
      if (filters.mailed === 'no' && row.mailed) return false
      if (filters.gotReplied === 'yes' && !row.got_replied) return false
      if (filters.gotReplied === 'no' && row.got_replied) return false
      const actionType = rowLastActionType(row)
      if (filters.lastAction !== 'all' && actionType !== filters.lastAction) return false
      return true
    })
    out.sort((a, b) => {
      const aTime = new Date(a.applied_date || 0).getTime()
      const bTime = new Date(b.applied_date || 0).getTime()
      return filters.orderByApplied === 'asc' ? aTime - bTime : bTime - aTime
    })
    return out
  }, [rows, filters])

  return (
    <main className="page page-wide page-plain mx-auto w-full">
      <div className="tracking-head">
        <div>
          <h1>Tracking</h1>
          <p className="subtitle">Compact tracking with HR dropdown, freeze control, and persisted wavy milestones.</p>
        </div>
        <div className="actions">
          <button type="button" className="secondary" onClick={openCreateForm}>Add Row</button>
          <button type="button" className="secondary" onClick={removeSelected}>Remove Selected</button>
        </div>
      </div>

      <section className="tracking-filters filters-one-row">
        <label>Company Name<input value={filters.companyName} onChange={(event) => setFilters((prev) => ({ ...prev, companyName: event.target.value }))} /></label>
        <label>Job ID<input value={filters.jobId} onChange={(event) => setFilters((prev) => ({ ...prev, jobId: event.target.value }))} /></label>
        <label>Applied Date<input type="date" value={filters.appliedDate} onChange={(event) => setFilters((prev) => ({ ...prev, appliedDate: event.target.value }))} /></label>
        <label>Mailed<select value={filters.mailed} onChange={(event) => setFilters((prev) => ({ ...prev, mailed: event.target.value }))}><option value="all">All</option><option value="yes">Yes</option><option value="no">No</option></select></label>
        <label>Replied (got_replied)<select value={filters.gotReplied} onChange={(event) => setFilters((prev) => ({ ...prev, gotReplied: event.target.value }))}><option value="all">All</option><option value="yes">Yes</option><option value="no">No</option></select></label>
        <label>Last Action<select value={filters.lastAction} onChange={(event) => setFilters((prev) => ({ ...prev, lastAction: event.target.value }))}><option value="all">All</option><option value="fresh">Fresh</option><option value="followup">Follow Up</option></select></label>
        <label>Order By Applied<select value={filters.orderByApplied} onChange={(event) => setFilters((prev) => ({ ...prev, orderByApplied: event.target.value }))}><option value="desc">Newest</option><option value="asc">Oldest</option></select></label>
      </section>

      {error ? <p className="error">{error}</p> : null}
      {loading ? <p className="hint">Loading tracking rows...</p> : null}

      <div className="tracking-table-wrap tracking-table-wrap-compact">
        <table className="tracking-table tracking-table-compact">
          <thead>
            <tr>
              <th><input type="checkbox" checked={allSelected} onChange={(event) => toggleSelectAll(event.target.checked)} /></th>
              <th>Company</th>
              <th>Job ID</th>
              <th>HR</th>
              <th>Mailed</th>
              <th>Replied</th>
              <th>Action</th>
              <th>Time</th>
              <th>Send</th>
              <th>Freeze</th>
              <th>Apply</th>
              <th>Edit</th>
              <th>Remove</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => {
              const controls = rowControls[String(row.id)] || { actionType: 'fresh', sendMode: 'now', actionAt: '' }
              const applyState = applyStateByRow[String(row.id)] || { status: '', message: '' }
              const canFollowUp = rowHasFreshMilestone(row)
              const milestones = Array.isArray(row.milestones) ? row.milestones : []
              const availableHrOptions = buildHrOptions(row)
              const selectedHrValues = uniqueArray(row.selected_hrs)

              return (
                <Fragment key={`row-wrap-${row.id}`}>
                  <tr key={`data-${row.id}`}>
                    <td><input type="checkbox" checked={selectedIds.includes(row.id)} onChange={(event) => toggleSelect(row.id, event.target.checked)} /></td>
                    <td>{row.company_name || '-'}</td>
                    <td>{row.job_id || '-'}</td>
                    <td>
                      <div className="hr-multi-picker">
                        <button
                          type="button"
                          className="secondary"
                          disabled={row.is_freezed}
                          onClick={() => setOpenHrPickerId((prev) => (prev === row.id ? null : row.id))}
                        >
                          {selectedHrValues.length ? `${selectedHrValues.length} selected` : 'Select HRs'}
                        </button>
                        {openHrPickerId === row.id ? (
                          <div className="hr-multi-menu">
                            {availableHrOptions.map((option) => {
                              const isChecked = selectedHrValues.includes(option.name)
                              return (
                                <label key={option.id || option.name} className="hr-multi-item">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(event) => {
                                      const next = event.target.checked
                                        ? [...selectedHrValues, option.name]
                                        : selectedHrValues.filter((value) => value !== option.name)
                                      updateHrQuick(row, next)
                                    }}
                                  />
                                  <span>{option.name}</span>
                                </label>
                              )
                            })}
                            {!availableHrOptions.length ? <p className="hint">No HR options</p> : null}
                            <button type="button" className="secondary" onClick={() => setOpenHrPickerId(null)}>Close</button>
                          </div>
                        ) : null}
                      </div>
                    </td>
                    <td>{row.mailed ? 'Yes' : 'No'}</td>
                    <td>{row.got_replied ? 'Yes' : 'No'}</td>
                    <td>
                      <select
                        value={controls.actionType}
                        onChange={(event) => setActionField(row.id, 'actionType', event.target.value)}
                        disabled={row.is_freezed}
                      >
                        <option value="fresh">Fresh</option>
                        <option value="followup" disabled={!canFollowUp}>Follow Up</option>
                      </select>
                    </td>
                    <td>
                      {controls.sendMode === 'schedule' ? (
                        <input
                          type="datetime-local"
                          value={controls.actionAt || ''}
                          onChange={(event) => setActionField(row.id, 'actionAt', event.target.value)}
                          disabled={row.is_freezed}
                        />
                      ) : (
                        <span>Server now</span>
                      )}
                    </td>
                    <td>
                      <select
                        value={controls.sendMode}
                        onChange={(event) => setActionField(row.id, 'sendMode', event.target.value)}
                        disabled={row.is_freezed}
                      >
                        <option value="now">Now</option>
                        <option value="schedule">Schedule</option>
                      </select>
                    </td>
                    <td>
                      <button type="button" className="secondary" onClick={() => toggleFreeze(row)}>
                        {row.is_freezed ? 'Unfreeze' : 'Freeze'}
                      </button>
                    </td>
                    <td>
                      <div className="tracking-apply-cell">
                        <button
                          type="button"
                          onClick={() => applyAction(row)}
                          disabled={row.is_freezed || applyState.status === 'saving'}
                        >
                          {applyState.status === 'saving' ? 'Applying...' : 'Apply'}
                        </button>
                        {applyState.message ? (
                          <span className={`tracking-apply-msg is-${applyState.status || 'idle'}`}>{applyState.message}</span>
                        ) : null}
                      </div>
                    </td>
                    <td><button type="button" className="secondary" onClick={() => openEditForm(row)} disabled={row.is_freezed}>Edit</button></td>
                    <td><button type="button" className="tracking-remove-inline" onClick={() => removeRow(row.id)}>Remove</button></td>
                  </tr>
                  <tr className="tracking-milestone-row">
                    <td />
                    <td colSpan={12}>
                      <div className="tracking-wave-wrap">
                        <svg className="tracking-wave-svg" viewBox="0 0 1000 44" preserveAspectRatio="none" aria-hidden="true">
                          <path
                            d="M0 22 Q25 4 50 22 T100 22 T150 22 T200 22 T250 22 T300 22 T350 22 T400 22 T450 22 T500 22 T550 22 T600 22 T650 22 T700 22 T750 22 T800 22 T850 22 T900 22 T950 22 T1000 22"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.4"
                          />
                        </svg>
                        <div className="tracking-wave-points">
                          {Array.from({ length: EMPTY_MILESTONE_DOTS }).map((_, index) => {
                            const milestone = milestones[index]
                            return (
                              <div
                                key={`${row.id}-wave-${index}`}
                                className="tracking-wave-point"
                                style={{ left: `${(index / (EMPTY_MILESTONE_DOTS - 1)) * 100}%` }}
                                title={milestone ? `${milestone.type} | ${milestone.mode} | ${milestone.at}` : `Step ${index + 1}`}
                              >
                                <span className={`tracking-wave-circle ${milestone ? 'is-on' : ''}`} />
                                <span className="tracking-wave-label">{formatMilestoneLabel(milestone)}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </td>
                  </tr>
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {!loading && !filteredRows.length ? <p className="hint">No rows found.</p> : null}
      <div className="table-pagination">
        <button type="button" className="secondary" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>Previous</button>
        <span>Page {page} / {Math.max(1, totalPages)} ({totalCount})</span>
        <button type="button" className="secondary" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Next</button>
      </div>

      {createForm ? (
        <div className="modal-overlay">
          <div className="modal-panel">
            <h2>Add Tracking Row</h2>
            <label>Company Name*<input value={createForm.company_name} onChange={(event) => setCreateForm((prev) => ({ ...prev, company_name: event.target.value }))} /></label>
            <label>Job ID*<input value={createForm.job_id} onChange={(event) => setCreateForm((prev) => ({ ...prev, job_id: event.target.value }))} /></label>
            <label>Role*<input value={createForm.role} onChange={(event) => setCreateForm((prev) => ({ ...prev, role: event.target.value }))} /></label>
            <label>Job URL<input value={createForm.job_url} onChange={(event) => setCreateForm((prev) => ({ ...prev, job_url: event.target.value }))} /></label>
            <label>Upload Tailored Resume<input type="file" accept=".pdf,.doc,.docx" onChange={(event) => setCreateForm((prev) => ({ ...prev, tailored_resume_upload: event.target.files?.[0] || null }))} /></label>
            <label>Mailed<select value={createForm.mailed ? 'yes' : 'no'} onChange={(event) => setCreateForm((prev) => ({ ...prev, mailed: event.target.value === 'yes' }))}><option value="yes">Yes</option><option value="no">No</option></select></label>
            <label>Got Replied<select value={createForm.got_replied ? 'yes' : 'no'} onChange={(event) => setCreateForm((prev) => ({ ...prev, got_replied: event.target.value === 'yes' }))}><option value="yes">Yes</option><option value="no">No</option></select></label>
            <label>Applied Date<input type="date" value={createForm.applied_date || ''} onChange={(event) => setCreateForm((prev) => ({ ...prev, applied_date: event.target.value }))} /></label>
            <label>Posting Date<input type="date" value={createForm.posting_date || ''} onChange={(event) => setCreateForm((prev) => ({ ...prev, posting_date: event.target.value }))} /></label>
            <label>Is Open<select value={createForm.is_open ? 'yes' : 'no'} onChange={(event) => setCreateForm((prev) => ({ ...prev, is_open: event.target.value === 'yes' }))}><option value="yes">Yes</option><option value="no">No</option></select></label>
            <div className="actions">
              <button type="button" onClick={createRow}>Create</button>
              <button type="button" className="secondary" onClick={() => setCreateForm(null)}>Cancel</button>
            </div>
          </div>
        </div>
      ) : null}

      {editForm ? (
        <div className="modal-overlay">
          <div className="modal-panel">
            <h2>Edit Tracking Row</h2>
            <label>Company Name<input value={editForm.company_name} onChange={(event) => setEditForm((prev) => ({ ...prev, company_name: event.target.value }))} /></label>
            <label>Job ID<input value={editForm.job_id} onChange={(event) => setEditForm((prev) => ({ ...prev, job_id: event.target.value }))} /></label>
            <label>Role<input value={editForm.role} onChange={(event) => setEditForm((prev) => ({ ...prev, role: event.target.value }))} /></label>
            <label>Job URL<input value={editForm.job_url} onChange={(event) => setEditForm((prev) => ({ ...prev, job_url: event.target.value }))} /></label>
            <label>Current Tailored Resume File<input value={editForm.tailored_resume_file || '-'} readOnly /></label>
            <label>Upload New Tailored Resume<input type="file" accept=".pdf,.doc,.docx" onChange={(event) => setEditForm((prev) => ({ ...prev, tailored_resume_upload: event.target.files?.[0] || null }))} /></label>
            <label>Mailed<select value={editForm.mailed ? 'yes' : 'no'} onChange={(event) => setEditForm((prev) => ({ ...prev, mailed: event.target.value === 'yes' }))}><option value="yes">Yes</option><option value="no">No</option></select></label>
            <label>Applied Date<input type="date" value={editForm.applied_date || ''} onChange={(event) => setEditForm((prev) => ({ ...prev, applied_date: event.target.value }))} /></label>
            <label>Posting Date<input type="date" value={editForm.posting_date || ''} onChange={(event) => setEditForm((prev) => ({ ...prev, posting_date: event.target.value }))} /></label>
            <label>Is Open<select value={editForm.is_open ? 'yes' : 'no'} onChange={(event) => setEditForm((prev) => ({ ...prev, is_open: event.target.value === 'yes' }))}><option value="yes">Yes</option><option value="no">No</option></select></label>
            <label>
              Selected HRs
              <select
                multiple
                value={editForm.selected_hrs}
                onChange={(event) => {
                  const values = Array.from(event.target.selectedOptions).map((option) => option.value)
                  setEditForm((prev) => ({ ...prev, selected_hrs: values }))
                }}
              >
                {editForm.hrOptions.map((option) => (
                  <option key={option.id || option.name} value={option.name}>{option.name}</option>
                ))}
              </select>
            </label>
            <label>Got Replied<select value={editForm.got_replied ? 'yes' : 'no'} onChange={(event) => setEditForm((prev) => ({ ...prev, got_replied: event.target.value === 'yes' }))}><option value="yes">Yes</option><option value="no">No</option></select></label>
            <div className="actions">
              <button type="button" onClick={saveEditForm}>Save</button>
              <button type="button" className="secondary" onClick={() => setEditForm(null)}>Cancel</button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}

export default TrackingPage
