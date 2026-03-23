import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../store/useAuth'
import { useTheme } from '../contexts/useTheme'
import { useAppSelector } from '../store/hooks'

function NavBar() {
  const [open, setOpen] = useState(false)
  const { logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { theme, toggleTheme } = useTheme()
  const username = useAppSelector((state) => String(state.profile.data?.username || ''))
  const currentPath = location.pathname

  const items = useMemo(
    () => [
      { label: 'Home', path: '/' },
      { label: 'Dashboard', path: '/dashboard' },
      { label: 'Resume Builder', path: '/builder' },
    ],
    [],
  )

  const go = (path) => {
    setOpen(false)
    navigate(path)
  }

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-slate-50/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85">
      <div className="mx-auto flex max-w-7xl w-full items-center justify-between px-4 py-3 md:px-6">
        <button
          type="button"
          className="inline-flex items-center justify-center bg-transparent px-2 py-2 text-base font-black tracking-wide text-slate-900 shadow-none dark:text-slate-100"
          onClick={() => go('/')}
        >
          ResumeBuilder
        </button>

        <button
          type="button"
          className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100 dark:hover:bg-slate-800 md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open ? 'true' : 'false'}
          aria-controls="nav-links"
        >
          Menu
        </button>

        <nav
          id="nav-links"
          className={`${
            open ? 'flex' : 'hidden'
          } absolute left-0 right-0 top-[68px] flex-col items-stretch gap-3 border-b border-slate-200 bg-slate-50/95 px-4 py-4 shadow-xl backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 md:static md:flex md:flex-row md:items-center md:gap-3 md:border-b-0 md:bg-transparent md:px-0 md:py-0 md:shadow-none`}
        >
          <div className="grid gap-2 md:flex md:items-center md:gap-2">
            {items.map((item) => (
              <button
                key={item.path}
                type="button"
                className={`inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold shadow-none ${
                  currentPath === item.path
                    ? 'border border-slate-200 bg-white text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'
                    : 'border border-transparent bg-transparent text-slate-600 hover:border-slate-200 hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-900 dark:hover:text-slate-100'
                }`}
                onClick={() => go(item.path)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="grid gap-2 border-t border-slate-200 pt-3 dark:border-slate-800 md:ml-2 md:flex md:items-center md:gap-2 md:border-t-0 md:pt-0">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-600 shadow-none hover:border-blue-300 hover:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              onClick={() => {
                setOpen(false)
                toggleTheme()
              }}
              aria-label="Toggle dark mode"
            >
              {theme === 'dark' ? (
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M12 18a6 6 0 1 1 0-12a6 6 0 0 1 0 12ZM12 2h1v3h-1V2Zm0 19h1v3h-1v-3ZM4.22 5.64l.7-.7l2.12 2.12l-.7.7L4.22 5.64Zm12.62 12.62l.7-.7l2.12 2.12l-.7.7l-2.12-2.12ZM2 12h3v1H2v-1Zm19 0h3v1h-3v-1ZM4.22 18.36l2.12-2.12l.7.7l-2.12 2.12l-.7-.7ZM16.96 7.06l2.12-2.12l.7.7l-2.12 2.12l-.7-.7Z"
                  />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M12.74 2a9 9 0 0 0 0 18A9 9 0 0 1 12.74 2Zm0 20C7.37 22 3 17.63 3 12.26S7.37 2.52 12.74 2.52c.78 0 1.55.1 2.29.29a1 1 0 0 1 .29 1.82A7 7 0 0 0 12.74 22Z"
                  />
                </svg>
              )}
            </button>

            {username && (
              <div className="max-w-52 truncate rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-sm font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                {username}
              </div>
            )}

            <button
              type="button"
              className="inline-flex items-center justify-center rounded-xl border border-transparent bg-transparent px-3 py-2 text-sm font-semibold text-red-700 shadow-none hover:border-slate-200 hover:bg-white dark:text-red-300 dark:hover:border-slate-700 dark:hover:bg-slate-900"
              onClick={async () => {
                setOpen(false)
                await logout()
                navigate('/login')
              }}
            >
              Logout
            </button>
          </div>
        </nav>
      </div>
    </header>
  )
}

export default NavBar
