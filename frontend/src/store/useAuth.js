import { useMemo } from 'react'

import { clearAccessToken, logoutUser, setAccessToken } from '../api'
import { authStateChanged, logoutCompleted } from './authSlice'
import { clearProfile } from './profileSlice'
import { useAppDispatch, useAppSelector } from './hooks'

export function useAuth() {
  const dispatch = useAppDispatch()
  const accessToken = useAppSelector((state) => state.auth.accessToken)
  const authReady = useAppSelector((state) => state.auth.authReady)

  return useMemo(
    () => ({
      accessToken,
      authReady,
      isLoggedIn: Boolean(accessToken),
      login: (access) => {
        setAccessToken(access)
        dispatch(authStateChanged(access))
      },
      logout: async () => {
        try {
          await logoutUser()
        } catch {
          clearAccessToken()
        }
        dispatch(logoutCompleted())
        dispatch(clearProfile())
      },
    }),
    [accessToken, authReady, dispatch],
  )
}
