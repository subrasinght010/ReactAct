import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ResumeSheet from '../components/ResumeSheet'

import {
  createAchievement,
  createInterview,
  deleteAchievement,
  deleteInterview,
  deleteResume,
  fetchAchievements,
  fetchInterviews,
  fetchProfile,
  fetchProfileInfo,
  fetchResumes,
  updateAchievement,
  updateInterview,
  updateProfileInfo,
} from '../api'

const EMPTY_PROFILE = {
  full_name: '',
  email: '',
  contact_number: '',
  linkedin_url: '',
  github_url: '',
  portfolio_url: '',
  current_employer: '',
  years_of_experience: '',
  location: '',
  summary: '',
}

const EMPTY_ACH = {
  name: '',
  achievement: '',
  skills: '',
}

const STAGES = [
  { value: 'received_call', label: 'Received Call' },
  { value: 'assignment', label: 'Assignment' },
  { value: 'round_1', label: 'Round 1' },
  { value: 'round_2', label: 'Round 2' },
  { value: 'round_3', label: 'Round 3' },
  { value: 'round_4', label: 'Round 4' },
  { value: 'round_5', label: 'Round 5' },
  { value: 'round_6', label: 'Round 6' },
  { value: 'round_7', label: 'Round 7' },
  { value: 'round_8', label: 'Round 8' },
  { value: 'landed_job', label: 'Landed Job' },
  { value: 'hold', label: 'Hold' },
  { value: 'no_response', label: 'No Response' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'skipped', label: 'Skipped' },
]

const EMPTY_INTERVIEW = {
  company_name: '',
  job_role: '',
  stage: 'received_call',
  interview_at: '',
  notes: '',
}

function profileRows(profile) {
  const rows = [
    ['Full Name', profile.full_name],
    ['Email', profile.email],
    ['Contact Number', profile.contact_number],
    ['LinkedIn', profile.linkedin_url],
    ['GitHub', profile.github_url],
    ['Portfolio', profile.portfolio_url],
    ['Current Employer', profile.current_employer],
    ['Years of Experience', profile.years_of_experience],
    ['Location', profile.location],
    ['Summary', profile.summary],
  ]
  return rows.filter(([, value]) => String(value || '').trim())
}

function toInputDateTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 16)
}

function displayStage(value) {
  return STAGES.find((item) => item.value === value)?.label || value || '-'
}

function ProfilePage() {
  const access = localStorage.getItem('access') || ''
  const navigate = useNavigate()

  const [profile, setProfile] = useState(EMPTY_PROFILE)
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileForm, setProfileForm] = useState(EMPTY_PROFILE)
  const [profileUsername, setProfileUsername] = useState('')

  const [resumes, setResumes] = useState([])
  const [previewResume, setPreviewResume] = useState(null)

  const [achievements, setAchievements] = useState([])
  const [showAchForm, setShowAchForm] = useState(false)
  const [editingAchId, setEditingAchId] = useState(null)
  const [achForm, setAchForm] = useState(EMPTY_ACH)

  const [interviews, setInterviews] = useState([])
  const [showInterviewForm, setShowInterviewForm] = useState(false)
  const [editingInterviewId, setEditingInterviewId] = useState(null)
  const [interviewForm, setInterviewForm] = useState(EMPTY_INTERVIEW)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  const stageIndexMap = useMemo(() => {
    const map = {}
    STAGES.forEach((item, index) => {
      map[item.value] = index
    })
    return map
  }, [])

  const loadAll = async () => {
    setLoading(true)
    setError('')
    try {
      const [profileBase, info, resumeRows, achRows, interviewRows] = await Promise.all([
        fetchProfile(access),
        fetchProfileInfo(access),
        fetchResumes(access),
        fetchAchievements(access),
        fetchInterviews(access),
      ])
      const nextProfile = { ...EMPTY_PROFILE, ...(info || {}) }
      if (!String(nextProfile.full_name || '').trim()) {
        nextProfile.full_name = String(profileBase?.username || '')
      }
      setProfile(nextProfile)
      setProfileForm(nextProfile)
      setProfileUsername(String(profileBase?.username || ''))
      setResumes(Array.isArray(resumeRows) ? resumeRows : [])
      setAchievements(Array.isArray(achRows) ? achRows : [])
      setInterviews(Array.isArray(interviewRows) ? interviewRows : [])
    } catch (err) {
      setError(err.message || 'Could not load profile data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!access) return
    loadAll()
  }, [access])

  const saveProfile = async () => {
    try {
      setError('')
      setOk('')
      const payload = { ...profileForm }
      const updated = await updateProfileInfo(access, payload)
      setProfile({ ...EMPTY_PROFILE, ...(updated || {}) })
      setProfileForm({ ...EMPTY_PROFILE, ...(updated || {}) })
      setEditingProfile(false)
      setOk('Personal info updated.')
    } catch (err) {
      setError(err.message || 'Could not save personal info.')
    }
  }

  const removeResume = async (resumeId) => {
    try {
      setError('')
      setOk('')
      await deleteResume(access, resumeId)
      setResumes((prev) => prev.filter((row) => row.id !== resumeId))
      setOk('Resume deleted.')
    } catch (err) {
      setError(err.message || 'Could not delete resume.')
    }
  }

  const openResumeInBuilder = (resumeId) => {
    sessionStorage.setItem('builderResumeId', String(resumeId))
    navigate('/builder')
  }

  const saveAchievement = async () => {
    try {
      setError('')
      setOk('')
      const payload = {
        name: String(achForm.name || '').trim(),
        achievement: String(achForm.achievement || '').trim(),
        skills: String(achForm.skills || '').trim(),
      }
      if (!payload.name || !payload.achievement) {
        setError('Achievement needs name and achievement text.')
        return
      }
      if (editingAchId) {
        const updated = await updateAchievement(access, editingAchId, payload)
        setAchievements((prev) => prev.map((row) => (row.id === editingAchId ? updated : row)))
        setOk('Achievement updated.')
      } else {
        const created = await createAchievement(access, payload)
        setAchievements((prev) => [created, ...prev])
        setOk('Achievement added.')
      }
      setAchForm(EMPTY_ACH)
      setEditingAchId(null)
      setShowAchForm(false)
    } catch (err) {
      setError(err.message || 'Could not save achievement.')
    }
  }

  const editAchievement = (row) => {
    setEditingAchId(row.id)
    setAchForm({
      name: row.name || '',
      achievement: row.achievement || '',
      skills: row.skills || '',
    })
    setShowAchForm(true)
  }

  const removeAchievement = async (id) => {
    try {
      await deleteAchievement(access, id)
      setAchievements((prev) => prev.filter((row) => row.id !== id))
    } catch (err) {
      setError(err.message || 'Could not delete achievement.')
    }
  }

  const saveInterview = async () => {
    try {
      setError('')
      setOk('')
      const payload = {
        company_name: String(interviewForm.company_name || '').trim(),
        job_role: String(interviewForm.job_role || '').trim(),
        stage: String(interviewForm.stage || 'received_call').trim(),
        interview_at: interviewForm.interview_at || null,
        notes: String(interviewForm.notes || '').trim(),
      }
      if (!payload.company_name || !payload.job_role) {
        setError('Interview needs company and job role.')
        return
      }
      if (editingInterviewId) {
        const updated = await updateInterview(access, editingInterviewId, payload)
        setInterviews((prev) => prev.map((row) => (row.id === editingInterviewId ? updated : row)))
        setOk('Interview updated.')
      } else {
        const created = await createInterview(access, payload)
        setInterviews((prev) => [created, ...prev])
        setOk('Interview added.')
      }
      setInterviewForm(EMPTY_INTERVIEW)
      setEditingInterviewId(null)
      setShowInterviewForm(false)
    } catch (err) {
      setError(err.message || 'Could not save interview.')
    }
  }

  const editInterview = (row) => {
    setEditingInterviewId(row.id)
    setInterviewForm({
      company_name: row.company_name || '',
      job_role: row.job_role || '',
      stage: row.stage || 'received_call',
      interview_at: toInputDateTime(row.interview_at),
      notes: row.notes || '',
    })
    setShowInterviewForm(true)
  }

  const removeInterview = async (id) => {
    try {
      await deleteInterview(access, id)
      setInterviews((prev) => prev.filter((row) => row.id !== id))
    } catch (err) {
      setError(err.message || 'Could not delete interview.')
    }
  }

  return (
    <main className="page page-wide mx-auto w-full">
      <div className="tracking-head">
        <div>
          <h1>Profile</h1>
          <p className="subtitle">Personal info, achievements, resumes, and interview milestones.</p>
        </div>
        <div className="actions">
          <button type="button" className="secondary" onClick={() => navigate('/builder')}>Resume Builder</button>
          <button type="button" className="secondary" onClick={() => navigate('/profile/templates')}>Templates</button>
        </div>
      </div>

      {loading ? <p className="hint">Loading profile...</p> : null}

      <section className="dash-card">
        <div className="tracking-head">
          <h2>Resumes</h2>
          <div className="actions">
            <button type="button" className="secondary" onClick={() => navigate('/builder')}>Add Resume</button>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {resumes.map((row) => (
            <article key={row.id} className="rounded-xl border border-slate-200 p-4">
              <p><strong>{row.title || `Resume #${row.id}`}</strong></p>
              <p className="hint">Updated: {row.updated_at ? new Date(row.updated_at).toLocaleString() : '-'}</p>
              <div className="actions">
                <button type="button" className="secondary" onClick={() => setPreviewResume(row)}>Preview</button>
                <button type="button" className="secondary" onClick={() => openResumeInBuilder(row.id)}>Edit</button>
                <button type="button" className="secondary" onClick={() => removeResume(row.id)}>Delete</button>
              </div>
            </article>
          ))}
          {!resumes.length ? <p className="hint">No resumes yet.</p> : null}
        </div>
      </section>

      <section className="dash-card">
        <div className="tracking-head">
          <h2>Personal Info</h2>
          <div className="actions">
            {!editingProfile ? (
              <button type="button" className="secondary" onClick={() => setEditingProfile(true)}>Edit</button>
            ) : null}
          </div>
        </div>
        {!editingProfile ? (
          <div className="grid gap-3 md:grid-cols-2">
            {profileRows(profile).map(([label, value]) => (
              <p key={label}><strong>{label}:</strong> {String(value)}</p>
            ))}
            {!profileRows(profile).length ? <p><strong>Full Name:</strong> {profileUsername || '-'}</p> : null}
          </div>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              <label>Full Name<input value={profileForm.full_name} onChange={(e) => setProfileForm((p) => ({ ...p, full_name: e.target.value }))} /></label>
              <label>Email<input value={profileForm.email} onChange={(e) => setProfileForm((p) => ({ ...p, email: e.target.value }))} /></label>
              <label>Contact Number<input value={profileForm.contact_number} onChange={(e) => setProfileForm((p) => ({ ...p, contact_number: e.target.value }))} /></label>
              <label>Location<input value={profileForm.location} onChange={(e) => setProfileForm((p) => ({ ...p, location: e.target.value }))} /></label>
              <label>Current Employer<input value={profileForm.current_employer} onChange={(e) => setProfileForm((p) => ({ ...p, current_employer: e.target.value }))} /></label>
              <label>Years of Experience<input value={profileForm.years_of_experience} onChange={(e) => setProfileForm((p) => ({ ...p, years_of_experience: e.target.value }))} /></label>
              <label>LinkedIn URL<input value={profileForm.linkedin_url} onChange={(e) => setProfileForm((p) => ({ ...p, linkedin_url: e.target.value }))} /></label>
              <label>GitHub URL<input value={profileForm.github_url} onChange={(e) => setProfileForm((p) => ({ ...p, github_url: e.target.value }))} /></label>
              <label>Portfolio URL<input value={profileForm.portfolio_url} onChange={(e) => setProfileForm((p) => ({ ...p, portfolio_url: e.target.value }))} /></label>
              <label>Summary<textarea rows={3} value={profileForm.summary} onChange={(e) => setProfileForm((p) => ({ ...p, summary: e.target.value }))} /></label>
            </div>
            <div className="actions">
              <button type="button" onClick={saveProfile}>Save</button>
              <button type="button" className="secondary" onClick={() => { setProfileForm(profile); setEditingProfile(false) }}>Cancel</button>
            </div>
          </>
        )}
      </section>

      <section className="dash-card">
        <div className="tracking-head">
          <h2>Achievements</h2>
          <div className="actions">
            <button type="button" className="secondary" onClick={() => { setShowAchForm((v) => !v); setEditingAchId(null); setAchForm(EMPTY_ACH) }}>Add</button>
          </div>
        </div>
        {showAchForm ? (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              <label>Name<input value={achForm.name} onChange={(e) => setAchForm((p) => ({ ...p, name: e.target.value }))} /></label>
              <label>Skills<input value={achForm.skills} onChange={(e) => setAchForm((p) => ({ ...p, skills: e.target.value }))} placeholder="Python, React, AWS" /></label>
              <label className="md:col-span-2">Achievement<textarea rows={3} value={achForm.achievement} onChange={(e) => setAchForm((p) => ({ ...p, achievement: e.target.value }))} /></label>
            </div>
            <div className="actions">
              <button type="button" onClick={saveAchievement}>{editingAchId ? 'Update' : 'Create'}</button>
              <button type="button" className="secondary" onClick={() => { setShowAchForm(false); setEditingAchId(null); setAchForm(EMPTY_ACH) }}>Cancel</button>
            </div>
          </>
        ) : null}
        <div className="grid gap-3 md:grid-cols-2">
          {achievements.map((row) => (
            <article key={row.id} className="rounded-xl border border-slate-200 p-4">
              <p><strong>{row.name || '-'}</strong></p>
              <p className="hint">{row.skills || '-'}</p>
              <p>{row.achievement || '-'}</p>
              <div className="actions">
                <button type="button" className="secondary" onClick={() => editAchievement(row)}>Edit</button>
                <button type="button" className="secondary" onClick={() => removeAchievement(row.id)}>Delete</button>
              </div>
            </article>
          ))}
          {!achievements.length ? <p className="hint">No achievements yet.</p> : null}
        </div>
      </section>

      <section className="dash-card">
        <div className="tracking-head">
          <h2>Interview Section</h2>
          <div className="actions">
            <button type="button" className="secondary" onClick={() => { setShowInterviewForm((v) => !v); setEditingInterviewId(null); setInterviewForm(EMPTY_INTERVIEW) }}>Add Interview</button>
          </div>
        </div>
        {showInterviewForm ? (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              <label>Company<input value={interviewForm.company_name} onChange={(e) => setInterviewForm((p) => ({ ...p, company_name: e.target.value }))} /></label>
              <label>Job Role<input value={interviewForm.job_role} onChange={(e) => setInterviewForm((p) => ({ ...p, job_role: e.target.value }))} /></label>
              <label>Stage
                <select value={interviewForm.stage} onChange={(e) => setInterviewForm((p) => ({ ...p, stage: e.target.value }))}>
                  {STAGES.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </label>
              <label>Interview At<input type="datetime-local" value={interviewForm.interview_at} onChange={(e) => setInterviewForm((p) => ({ ...p, interview_at: e.target.value }))} /></label>
              <label className="md:col-span-2">Notes<textarea rows={3} value={interviewForm.notes} onChange={(e) => setInterviewForm((p) => ({ ...p, notes: e.target.value }))} /></label>
            </div>
            <div className="actions">
              <button type="button" onClick={saveInterview}>{editingInterviewId ? 'Update' : 'Create'}</button>
              <button type="button" className="secondary" onClick={() => { setShowInterviewForm(false); setEditingInterviewId(null); setInterviewForm(EMPTY_INTERVIEW) }}>Cancel</button>
            </div>
          </>
        ) : null}

        <div className="grid gap-4">
          {interviews.map((row) => {
            const currentStageIndex = Number(stageIndexMap[row.stage] ?? 0)
            return (
              <article key={row.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p><strong>{row.company_name}</strong> | {row.job_role}</p>
                  <div className="tracking-actions-compact">
                    <button type="button" className="secondary" onClick={() => editInterview(row)}>Edit</button>
                    <button type="button" className="secondary" onClick={() => removeInterview(row.id)}>Delete</button>
                  </div>
                </div>
                <p className="hint">{displayStage(row.stage)} {row.interview_at ? `| ${new Date(row.interview_at).toLocaleString()}` : ''}</p>
                <div className="profile-milestone-wrap">
                  {STAGES.map((stage, index) => (
                    <div key={`${row.id}-${stage.value}`} className="profile-milestone-node">
                      <span className={`profile-milestone-dot ${index <= currentStageIndex ? 'is-active' : ''}`} />
                      <span className="profile-milestone-label">{stage.label}</span>
                      {index < STAGES.length - 1 ? <span className={`profile-milestone-line ${index < currentStageIndex ? 'is-active' : ''}`} /> : null}
                    </div>
                  ))}
                </div>
                {row.notes ? <p>{row.notes}</p> : null}
              </article>
            )
          })}
          {!interviews.length ? <p className="hint">No interview entries yet.</p> : null}
        </div>
      </section>

      {previewResume ? (
        <div className="modal-overlay" onClick={() => setPreviewResume(null)}>
          <div className="modal-panel" style={{ width: 'min(920px, 96vw)' }} onClick={(event) => event.stopPropagation()}>
            <h2>Resume Preview</h2>
            <p className="subtitle">{previewResume.title || 'Resume'}</p>
            {previewResume.builder_data && Object.keys(previewResume.builder_data).length ? (
              <section className="preview-only" style={{ maxHeight: '80vh', overflow: 'auto' }}>
                <ResumeSheet form={previewResume.builder_data} />
              </section>
            ) : (
              <p className="hint">No builder data available for preview.</p>
            )}
            <div className="actions">
              <button type="button" className="secondary" onClick={() => setPreviewResume(null)}>Close</button>
            </div>
          </div>
        </div>
      ) : null}

      {error ? <p className="error">{error}</p> : null}
      {ok ? <p className="success">{ok}</p> : null}
    </main>
  )
}

export default ProfilePage
