import { useEffect } from 'react'

import { useAppDispatch, useAppSelector } from '../store/hooks'
import { syncFromStorage } from '../store/authSlice'
import { clearProfile, loadProfile } from '../store/profileSlice'

function AppStateSync() {
  const dispatch = useAppDispatch()
  const accessToken = useAppSelector((state) => state.auth.accessToken)
  const theme = useAppSelector((state) => state.theme.value)

  useEffect(() => {
    const sync = () => dispatch(syncFromStorage())

    window.addEventListener('storage', sync)
    window.addEventListener('auth-changed', sync)

    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener('auth-changed', sync)
    }
  }, [dispatch])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    if (!accessToken) {
      dispatch(clearProfile())
      return
    }

    dispatch(loadProfile(accessToken))
  }, [accessToken, dispatch])

  return null
}

export default AppStateSync
