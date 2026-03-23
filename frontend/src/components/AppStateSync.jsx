import { useEffect } from 'react'

import { restoreSession, subscribeToAuth } from '../api'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { authReadySet, authStateChanged } from '../store/authSlice'
import { clearProfile, loadProfile } from '../store/profileSlice'

function AppStateSync() {
  const dispatch = useAppDispatch()
  const accessToken = useAppSelector((state) => state.auth.accessToken)
  const theme = useAppSelector((state) => state.theme.value)

  useEffect(() => {
    let active = true
    const unsubscribe = subscribeToAuth((token) => {
      if (active) {
        dispatch(authStateChanged(token))
      }
    })

    const bootstrapAuth = async () => {
      try {
        await restoreSession()
      } finally {
        if (active) {
          dispatch(authReadySet(true))
        }
      }
    }

    bootstrapAuth()

    return () => {
      active = false
      unsubscribe()
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

    dispatch(loadProfile())
  }, [accessToken, dispatch])

  return null
}

export default AppStateSync
