import { useMemo } from 'react'

import { clearProfile } from '../store/profileSlice'
import { loginSucceeded, logoutCompleted } from '../store/authSlice'
import { useAppDispatch, useAppSelector } from '../store/hooks'

function dispatchAuthChanged() {
  window.dispatchEvent(new Event('auth-changed'))
}

export function useAuth() {
  const dispatch = useAppDispatch()
  const accessToken = useAppSelector((state) => state.auth.accessToken)
  const refreshToken = useAppSelector((state) => state.auth.refreshToken)

  return useMemo(
    () => ({
      accessToken,
      refreshToken,
      isLoggedIn: Boolean(accessToken),
      login: (access, refresh) => {
        localStorage.setItem('access', access)
        localStorage.setItem('refresh', refresh)
        dispatch(loginSucceeded({ access, refresh }))
        dispatchAuthChanged()
      },
      logout: () => {
        localStorage.removeItem('access')
        localStorage.removeItem('refresh')
        dispatch(logoutCompleted())
        dispatch(clearProfile())
        dispatchAuthChanged()
      },
    }),
    [accessToken, refreshToken, dispatch],
  )
}
