import { useNavigate } from 'react-router-dom'

import { useAuth } from '../store/useAuth'
import { useAppSelector } from '../store/hooks'

function HomePage() {
  const navigate = useNavigate()
  const { isLoggedIn } = useAuth()
  const username = useAppSelector((state) => String(state.profile.data?.username || ''))

  return (
    <main className="w-full">
      {username && (
        <div className="pb-3">
          <div className="mx-auto flex max-w-7xl justify-center">
            <p className="text-center text-[clamp(1.375rem,2.2vw+0.5rem,2.3rem)] font-extrabold text-slate-800 dark:text-slate-100">
              Welcome {username} 🖐🏻!
            </p>
          </div>
        </div>
      )}

      <div className="mx-auto w-full max-w-7xl rounded-3xl border border-slate-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
        <div className="grid items-start gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="flex flex-col gap-4">
          <h1 className="mb-2 text-4xl font-bold leading-tight tracking-tight md:text-5xl">Resume Builder + ATS Score</h1>
          <p className="mb-5 text-sm text-slate-500 dark:text-slate-400">
            Build an A4 resume, preview it live, export to PDF, and score it against role keywords.
          </p>
            <div className="mt-3 flex flex-wrap gap-3">
              {!isLoggedIn && (
                <>
                  <button type="button" onClick={() => navigate('/login')}>
                    Login
                  </button>
                  <button
                    type="button"
                    className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100 dark:hover:bg-slate-800"
                    onClick={() => navigate('/register')}
                  >
                    Register
                  </button>
                </>
              )}
              <button type="button" onClick={() => navigate('/dashboard')}>
                Dashboard
              </button>
              <button
                type="button"
                className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100 dark:hover:bg-slate-800"
                onClick={() => navigate('/builder')}
              >
                Resume Builder
              </button>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
              <h2 className="mb-2 text-lg font-semibold">What you get</h2>
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-200">
                <li>A4 resume preview that matches print</li>
                <li>Section ordering + custom sections</li>
                <li>ATS score (0–100) using keyword profiles</li>
                <li>Experience/project bullets quality checks</li>
              </ul>
            </div>
            <div className="rounded-3xl border border-blue-200 bg-gradient-to-b from-blue-100/70 to-white p-5 shadow-sm dark:border-sky-900/70 dark:from-sky-950/60 dark:to-slate-900/60">
              <h2 className="mb-2 text-lg font-semibold">Tip</h2>
              <p className="text-sm leading-6 text-slate-700 dark:text-slate-200">
                Write 3+ bullets per experience/project, keep each bullet 50–100 characters, and add numbers.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

export default HomePage
