import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  fetchAnalyses,
  fetchProfile,
  fetchResume,
  fetchResumes,
  runAnalysis,
} from '../api'
import { useAuth } from '../store/useAuth'

function formatDate(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString()
}

function getSortedAnalyses(list) {
  return [...(list || [])].sort((a, b) => {
    const ad = new Date(a.created_at || 0).getTime()
    const bd = new Date(b.created_at || 0).getTime()
    return bd - ad
  })
}

function computeStats(list) {
  const sorted = getSortedAnalyses(list)
  const bestScore = sorted.length ? Math.max(...sorted.map((a) => Number(a.ats_score || 0))) : 0
  const latest = sorted[0] || null
  return {
    bestScore,
    latestScore: latest ? Number(latest.ats_score || 0) : 0,
    checks: sorted.length,
    latest,
    sorted,
  }
}

function plainTextFromHtml(value) {
  const text = String(value || '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
  return text
}

function getResumeSnippet(resume) {
  const data = resume?.builder_data || {}
  const summary = plainTextFromHtml(data.summary || '')
  if (summary) return summary
  const skills = plainTextFromHtml(data.skills || '')
  if (skills) return skills
  const exp0 = (data.experiences || [])[0]
  if (exp0?.company || exp0?.title) {
    return `${String(exp0.company || '').trim()} ${String(exp0.title || '').trim()}`.trim()
  }
  return 'No preview content yet.'
}

function clip(value, max) {
  const s = String(value || '')
  if (s.length <= max) return s
  return `${s.slice(0, max - 1).trimEnd()}…`
}

function MiniLineChart({ values }) {
  const width = 640
  const height = 240
  const padding = { top: 18, right: 18, bottom: 28, left: 42 }
  const innerW = width - padding.left - padding.right
  const innerH = height - padding.top - padding.bottom
  const [hover, setHover] = useState(null) // { px, py, svgX, svgY, score, when }

  if (!values || values.length < 2) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
        Run at least 2 analyses to see the trend.
      </div>
    )
  }

  const formatWhen = (ts) => {
    if (!ts) return ''
    const d = new Date(ts)
    if (Number.isNaN(d.getTime())) return ''
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const ys = values.map((v) => v.y)
  const minY = Math.min(...ys, 0)
  const maxY = Math.max(...ys, 100)
  const ticks = [100, 75, 50, 25, 0]

  const xStep = innerW / (values.length - 1)

  const pts = values
    .map((v, i) => {
      const x = padding.left + i * xStep
      const yNorm = maxY === minY ? 0.5 : (v.y - minY) / (maxY - minY)
      const y = padding.top + innerH - yNorm * innerH
      return { x, y, key: v.key, ts: v.ts, score: v.y }
    })
  const points = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

  // Area fill under the line for a sharper "chart" look (no boxed svg background).
  const areaPath = (() => {
    const first = pts[0]
    const last = pts[pts.length - 1]
    const baseY = padding.top + innerH
    const line = pts.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
    return `${line} L ${last.x.toFixed(1)} ${baseY.toFixed(1)} L ${first.x.toFixed(1)} ${baseY.toFixed(1)} Z`
  })()

  const setHoverFromEvent = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    if (!rect.width || !rect.height) return

    const clientX = e.clientX ?? (e.touches && e.touches[0]?.clientX)
    const clientY = e.clientY ?? (e.touches && e.touches[0]?.clientY)
    if (clientX == null || clientY == null) return

    const mx = ((clientX - rect.left) / rect.width) * width

    let best = null
    let bestDist = Infinity
    for (const p of pts) {
      const d = Math.abs(p.x - mx)
      if (d < bestDist) {
        bestDist = d
        best = p
      }
    }
    if (!best) return

    const px = ((best.x / width) * rect.width)
    const py = ((best.y / height) * rect.height)

    const when = formatWhen(best.ts)

    // Keep tooltip anchor safely inside the container.
    const pxClamped = Math.min(rect.width - 14, Math.max(14, px))
    const pyClamped = Math.min(rect.height - 10, Math.max(10, py))

    setHover({
      px: pxClamped,
      py: pyClamped,
      svgX: best.x,
      svgY: best.y,
      score: best.score,
      when,
    })
  }

  return (
    <div className="relative overflow-hidden rounded-[1.2rem] bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(241,245,249,0.72))] px-2 py-2 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.55),rgba(15,23,42,0.18))]">
      {hover && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[115%] rounded-2xl border border-slate-200 bg-white/96 px-3 py-2 text-slate-900 shadow-[0_18px_36px_rgba(15,23,42,0.12)] dark:border-slate-800 dark:bg-slate-950/96 dark:text-slate-100"
          style={{ left: hover.px, top: hover.py }}
        >
          <div className="text-sm font-bold tracking-tight">{hover.score}</div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{hover.when}</div>
        </div>
      )}
      <svg
        className="h-auto w-full overflow-visible"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="ATS score trend"
        style={{ touchAction: 'none' }}
        onMouseLeave={() => setHover(null)}
        onMouseMove={setHoverFromEvent}
        onPointerLeave={() => setHover(null)}
        onPointerMove={setHoverFromEvent}
      >
        <defs>
          <linearGradient id="atsLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="55%" stopColor="#0f766e" />
            <stop offset="100%" stopColor="#14b8a6" />
          </linearGradient>
          <linearGradient id="atsFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(37, 99, 235, 0.22)" />
            <stop offset="100%" stopColor="rgba(37, 99, 235, 0.02)" />
          </linearGradient>
        </defs>

        {/* Ensure the full chart area captures hover/pointer events. */}
        <rect x="0" y="0" width={width} height={height} fill="transparent" />

        {ticks.map((tick) => {
          const yNorm = maxY === minY ? 0.5 : (tick - minY) / (maxY - minY)
          const y = padding.top + innerH - yNorm * innerH
          return (
            <g key={tick}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="rgba(148, 163, 184, 0.28)"
                strokeWidth="1"
                strokeDasharray={tick === 0 ? '0' : '4 5'}
              />
              <text
                x={padding.left - 10}
                y={y + 4}
                textAnchor="end"
                fontSize="11"
                fill="rgba(100, 116, 139, 0.95)"
              >
                {tick}
              </text>
            </g>
          )
        })}

        <path d={areaPath} fill="url(#atsFill)" />
        <polyline
          points={points}
          fill="none"
          stroke="url(#atsLine)"
          strokeWidth="2.8"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {hover && (
          <>
            <line
              x1={hover.svgX}
              y1={padding.top}
              x2={hover.svgX}
              y2={padding.top + innerH}
              stroke="rgba(27, 34, 48, 0.16)"
              strokeWidth="1"
            />
            <circle cx={hover.svgX} cy={hover.svgY} r="7" fill="rgba(37, 99, 235, 0.16)" />
            <circle cx={hover.svgX} cy={hover.svgY} r="3.5" fill="#2563eb" />
          </>
        )}

        {/* Highlight the latest point only (cleaner than dots everywhere). */}
        <circle
          cx={pts[pts.length - 1].x}
          cy={pts[pts.length - 1].y}
          r="4.5"
          fill="#0f172a"
        />
      </svg>
    </div>
  )
}

function DashboardPage() {
  const [profile, setProfile] = useState(null)
  const [selectedResumeId, setSelectedResumeId] = useState(null)
  const [hoverResumeId, setHoverResumeId] = useState(null)
  const [analyses, setAnalyses] = useState([])
  const [analysesByResume, setAnalysesByResume] = useState({})
  const [resumes, setResumes] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const defaultProfileKeywords = {
    frontend: 'react, javascript, typescript, redux, html, css, vite, api, ui',
    backend: 'python, django, drf, rest, api, postgres, redis, celery, auth, jwt',
    fullstack: 'react, python, django, drf, rest, api, postgres, aws, docker, git',
  }

  const [keywords, setKeywords] = useState(() => localStorage.getItem('analysisCustomKeywords') || '')
  const [scopeLoading, setScopeLoading] = useState(false)
  const navigate = useNavigate()
  const { logout, accessToken } = useAuth()
  const [profiles, setProfiles] = useState(() => {
    try {
      const raw = localStorage.getItem('analysisProfiles')
      const parsed = raw ? JSON.parse(raw) : []
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  })
  const [profileKeywords, setProfileKeywords] = useState(() => {
    try {
      const raw = localStorage.getItem('analysisProfileKeywords')
      const parsed = raw ? JSON.parse(raw) : {}
      return {
        frontend: String(parsed.frontend || defaultProfileKeywords.frontend),
        backend: String(parsed.backend || defaultProfileKeywords.backend),
        fullstack: String(parsed.fullstack || defaultProfileKeywords.fullstack),
      }
    } catch {
      return { ...defaultProfileKeywords }
    }
  })

  const has = (name) => profiles.includes(name)
  const toggleProfile = (name) => {
    setProfiles((prev) => {
      const next = prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name]
      localStorage.setItem('analysisProfiles', JSON.stringify(next))
      return next
    })
  }

  const updateProfileKeywords = (key, value) => {
    setProfileKeywords((prev) => {
      const next = { ...prev, [key]: value }
      localStorage.setItem('analysisProfileKeywords', JSON.stringify(next))
      return next
    })
  }

  useEffect(() => {
    const loadDashboard = async () => {
      if (!accessToken) return

      try {
        const [profileData, analysisData, resumeData] = await Promise.all([
          fetchProfile(),
          fetchAnalyses(),
          fetchResumes(),
        ])
        setProfile(profileData)
        setAnalyses(analysisData)
        setResumes(resumeData)
      } catch (err) {
        setError(err.message || 'Failed to load dashboard data')
      }
    }

    loadDashboard()
  }, [accessToken])

  // Analytics scope:
  // - Default: overall (all resumes)
  // - Hover: scope to hovered resume
  // - Selection is only for running analysis (does not change analytics scope)
  const activeResumeId = hoverResumeId || null
  const activeKey = activeResumeId ? String(activeResumeId) : null
  const overallStats = computeStats(analyses)
  const scopedFromGlobal = activeResumeId ? analyses.filter((a) => a.resume === activeResumeId) : analyses
  const activeAnalyses = activeKey ? (analysesByResume[activeKey] || scopedFromGlobal) : analyses
  const activeStats = activeResumeId ? computeStats(activeAnalyses) : overallStats
  const activeTitle = activeResumeId
    ? (resumes.find((r) => r.id === activeResumeId)?.title || 'Resume')
    : 'All resumes'

  // Trend chart is always overall (not affected by hover/selection).
  const trendData = overallStats.sorted
    .slice()
    .reverse()
    .map((a) => ({
      key: a.id,
      y: Number(a.ats_score || 0),
      ts: a.created_at,
    }))

  const ensureResumeAnalysesLoaded = async (resumeId) => {
    if (!resumeId) return
    const key = String(resumeId)
    if (analysesByResume[key]) return

    if (!accessToken) return

    try {
      setScopeLoading(true)
      const data = await fetchAnalyses(resumeId)
      setAnalysesByResume((prev) => ({ ...prev, [key]: data }))
    } catch (err) {
      setError(err.message || 'Failed to load resume analytics')
    } finally {
      setScopeLoading(false)
    }
  }

  const handleRunAnalysis = async () => {
    if (!selectedResumeId) {
      navigate('/builder')
      return
    }
    setError('')

    try {
      setLoading(true)
      const custom = has('custom') ? keywords : ''
      localStorage.setItem('analysisCustomKeywords', custom)
      const result = await runAnalysis(selectedResumeId, null, custom, profiles, profileKeywords)
      setAnalyses((prev) => [result, ...prev])
      setAnalysesByResume((prev) => {
        const next = { ...prev }
        const key = String(selectedResumeId)
        const existing = next[key] || []
        next[key] = [result, ...existing]
        return next
      })
    } catch (err) {
      setError(err.message || 'Analysis failed')
    } finally {
      setLoading(false)
    }
  }

  const handleEditResumeInBuilder = async (id) => {
    setError('')
    try {
      setLoading(true)
      const full = await fetchResume(id)
      sessionStorage.setItem('builderImport', JSON.stringify(full.builder_data || {}))
      sessionStorage.setItem('builderResumeId', String(id))
      navigate('/builder')
    } catch (err) {
      setError(err.message || 'Failed to open resume in builder')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="w-full max-w-7xl">
      <h1>Dashboard</h1>
      <p className="mb-5 text-sm text-slate-500 dark:text-slate-400">
        {profile ? `Welcome ${profile.username}` : 'Loading profile...'}
      </p>

      <section className="mt-5 rounded-[2rem] border border-slate-200/90 bg-white/88 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-900/62">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-[1.35rem] font-semibold tracking-tight">ATS Overview</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
              Showing <strong>{activeTitle}</strong>
              {activeResumeId && scopeLoading ? ' (loading...)' : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:border-sky-900/70 dark:bg-sky-950/60 dark:text-sky-300">
              Trend: Overall
            </span>
          </div>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
          <div className="rounded-[1.7rem] border border-slate-200 bg-white p-5 shadow-[0_12px_28px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-950/60">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-base font-semibold tracking-tight">Score Trend</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Last {Math.min(trendData.length, 20)} runs</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-right dark:border-slate-800 dark:bg-slate-900/70">
                <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Current scope</span>
                <strong>{activeTitle}</strong>
              </div>
            </div>
            <MiniLineChart values={trendData.slice(-20).map((v) => ({ key: v.key, y: v.y, ts: v.ts }))} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-950/60">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Best</div>
              <div className="mt-2 text-[2.25rem] font-black tracking-tight text-slate-900 dark:text-slate-50">{activeStats.bestScore}</div>
              <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">All time</div>
            </div>
            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-950/60">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Latest</div>
              <div className="mt-2 text-[2.25rem] font-black tracking-tight text-slate-900 dark:text-slate-50">{activeStats.latestScore}</div>
              <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">Most recent check</div>
            </div>
            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-950/60">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Checks</div>
              <div className="mt-2 text-[2.25rem] font-black tracking-tight text-slate-900 dark:text-slate-50">{activeStats.checks}</div>
              <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">Total runs</div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-[2rem] border border-slate-200/90 bg-white/88 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-900/62">
        <h2>Saved Resumes</h2>
        {resumes.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No saved resumes yet. Build one in Resume Builder first.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {resumes.slice(0, 6).map((r) => {
              const isHovered = hoverResumeId === r.id
              const isSelected = selectedResumeId === r.id
              const resumeKey = String(r.id)
              const resumeAnalyses = analysesByResume[resumeKey] || analyses.filter((a) => a.resume === r.id)
              const resumeLatest = resumeAnalyses && resumeAnalyses.length ? resumeAnalyses[0] : null
              const pillTitle = resumeLatest
                ? `Latest ATS ${resumeLatest.ats_score} | Keywords ${resumeLatest.keyword_score}`
                : 'No analysis yet'
              const snippet = clip(getResumeSnippet(r), 140)

              return (
              <article
                key={r.id}
                className={`grid min-h-44 gap-2 rounded-3xl border bg-white p-4 shadow-sm transition dark:bg-slate-950/60 ${
                  isSelected
                    ? 'border-blue-500 shadow-lg dark:border-sky-500'
                    : isHovered
                      ? 'border-slate-300 shadow-md dark:border-slate-700 -translate-y-0.5'
                      : 'border-slate-200 dark:border-slate-800'
                }`}
                onMouseEnter={() => {
                  setHoverResumeId(r.id)
                  ensureResumeAnalysesLoaded(r.id)
                }}
                onMouseLeave={() => setHoverResumeId((prev) => (prev === r.id ? null : prev))}
                onClick={() => setSelectedResumeId((prev) => (prev === r.id ? null : r.id))}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setSelectedResumeId((prev) => (prev === r.id ? null : r.id))
                  }
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-base leading-5">
                    <strong>{r.title}</strong>
                  </p>
                  {(isHovered || isSelected) && (
                    <span
                      className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:border-sky-900/70 dark:bg-sky-950/60 dark:text-sky-300"
                      title={pillTitle}
                    >
                      {resumeLatest ? `ATS ${resumeLatest.ats_score}` : 'No checks'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Updated: {formatDate(r.updated_at)}</p>
                <p className="overflow-hidden text-sm leading-6 text-slate-700 dark:text-slate-200 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3]">{snippet}</p>

                <div className="mt-auto flex items-center gap-2">
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-700 shadow-none hover:border-blue-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleEditResumeInBuilder(r.id)
                    }}
                    disabled={loading}
                    title="Edit in builder"
                    aria-label="Edit in builder"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="currentColor" d="M3 17.25V21h3.75L17.8 9.95l-3.75-3.75L3 17.25zm2.92 2.33H5v-.92l9.06-9.06.92.92L5.92 19.58zM20.71 7.04a1 1 0 0 0 0-1.41L18.37 3.29a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-700 shadow-none hover:border-blue-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/preview/${r.id}`)
                    }}
                    title="Preview"
                    aria-label="Preview"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="currentColor" d="M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />
                    </svg>
                  </button>
                </div>
              </article>
            )
            })}
          </div>
        )}
      </section>

      <section className="mt-5 rounded-[2rem] border border-slate-200/90 bg-white/88 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-900/62">
        <h2>Run Analysis</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Select a resume above, then run analysis.
        </p>
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="grid items-center gap-3 border-t-0 bg-slate-50 p-3 text-sm font-semibold dark:bg-slate-900/80 md:grid-cols-[80px_140px_minmax(0,1fr)]">
            <div>Use</div>
            <div>Profile</div>
            <div>Keywords</div>
          </div>

          <div className="grid items-center gap-3 border-t border-slate-200 bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-950/50 md:grid-cols-[80px_140px_minmax(0,1fr)]">
            <div>
              <input type="checkbox" checked={has('frontend')} onChange={() => toggleProfile('frontend')} />
            </div>
            <div className="font-medium">Frontend</div>
            <div>
              <input
                type="text"
                value={profileKeywords.frontend || ''}
                onChange={(e) => updateProfileKeywords('frontend', e.target.value)}
                placeholder="comma separated keywords"
              />
            </div>
          </div>

          <div className="grid items-center gap-3 border-t border-slate-200 bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-950/50 md:grid-cols-[80px_140px_minmax(0,1fr)]">
            <div>
              <input type="checkbox" checked={has('backend')} onChange={() => toggleProfile('backend')} />
            </div>
            <div className="font-medium">Backend</div>
            <div>
              <input
                type="text"
                value={profileKeywords.backend || ''}
                onChange={(e) => updateProfileKeywords('backend', e.target.value)}
                placeholder="comma separated keywords"
              />
            </div>
          </div>

          <div className="grid items-center gap-3 border-t border-slate-200 bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-950/50 md:grid-cols-[80px_140px_minmax(0,1fr)]">
            <div>
              <input type="checkbox" checked={has('fullstack')} onChange={() => toggleProfile('fullstack')} />
            </div>
            <div className="font-medium">Fullstack</div>
            <div>
              <input
                type="text"
                value={profileKeywords.fullstack || ''}
                onChange={(e) => updateProfileKeywords('fullstack', e.target.value)}
                placeholder="comma separated keywords"
              />
            </div>
          </div>

          <div className="grid items-center gap-3 border-t border-slate-200 bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-950/50 md:grid-cols-[80px_140px_minmax(0,1fr)]">
            <div>
              <input type="checkbox" checked={has('custom')} onChange={() => toggleProfile('custom')} />
            </div>
            <div className="font-medium">Custom</div>
            <div>
              <input
                type="text"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="comma separated keywords"
                disabled={!has('custom')}
              />
            </div>
          </div>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          If you select no profile, ATS uses basic checks (length ~800+ chars + numbers in experience bullets).
        </p>
        <button type="button" onClick={handleRunAnalysis} disabled={loading || !selectedResumeId}>
          {loading ? 'Processing...' : 'Analyze Resume'}
        </button>
      </section>

      {error && <p className="text-sm font-medium text-red-700 dark:text-red-300">{error}</p>}

      <div className="mt-3 flex flex-wrap gap-3">
        <button
          type="button"
          className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100 dark:hover:bg-slate-800"
          onClick={() => {
            logout()
            navigate('/login')
          }}
        >
          Logout
        </button>
      </div>
    </main>
  )
}

export default DashboardPage
