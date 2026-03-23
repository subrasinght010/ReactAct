import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { fetchResume } from '../api'
import ResumeSheet from '../components/ResumeSheet'
import { useAuth } from '../store/useAuth'

function ResumePreviewPage() {
  const [resume, setResume] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const { resumeId = '' } = useParams()
  const { accessToken } = useAuth()
  const secondaryButtonClass =
    'inline-flex cursor-pointer items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100 dark:hover:bg-slate-800'

  useEffect(() => {
    const load = async () => {
      if (!accessToken || !resumeId) return
      setError('')
      try {
        setLoading(true)
        const data = await fetchResume(resumeId)
        setResume(data)
      } catch (err) {
        setError(err.message || 'Failed to load resume')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [accessToken, resumeId])

  const handleEdit = async () => {
    if (!accessToken) {
      navigate('/login')
      return
    }
    try {
      setLoading(true)
      const full = await fetchResume(resumeId)
      sessionStorage.setItem('builderImport', JSON.stringify(full.builder_data || {}))
      sessionStorage.setItem('builderResumeId', String(resumeId))
      navigate('/builder')
    } catch (err) {
      setError(err.message || 'Failed to open resume in builder')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="w-full max-w-7xl">
      <div className="preview-header-print-hide mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="mb-1 text-3xl font-bold">Preview</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {resume?.title ? resume.title : 'Resume'}
          </p>
        </div>
        <div className="mt-3 flex flex-wrap gap-3">
          <button type="button" className={secondaryButtonClass} onClick={() => navigate('/dashboard')}>
            Back
          </button>
          <button type="button" onClick={handleEdit} disabled={loading || !resumeId}>
            Edit
          </button>
          <button type="button" className={secondaryButtonClass} onClick={() => window.print()}>
            Exact PDF (Print)
          </button>
        </div>
      </div>

      {error && <p className="text-sm font-medium text-red-700 dark:text-red-300">{error}</p>}
      {loading && !resume && <p className="text-sm text-slate-500 dark:text-slate-400">Loading...</p>}

      {resume && (
        <section className="preview-only-print rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
          <ResumeSheet form={resume.builder_data || {}} />
        </section>
      )}
    </main>
  )
}

export default ResumePreviewPage
