import { createSlice } from '@reduxjs/toolkit'

function readTokens() {
  return {
    access: localStorage.getItem('access') || '',
    refresh: localStorage.getItem('refresh') || '',
  }
}

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    accessToken: readTokens().access,
    refreshToken: readTokens().refresh,
  },
  reducers: {
    syncFromStorage(state) {
      const next = readTokens()
      state.accessToken = next.access
      state.refreshToken = next.refresh
    },
    loginSucceeded(state, action) {
      state.accessToken = String(action.payload?.access || '')
      state.refreshToken = String(action.payload?.refresh || '')
    },
    logoutCompleted(state) {
      state.accessToken = ''
      state.refreshToken = ''
    },
  },
})

export const { loginSucceeded, logoutCompleted, syncFromStorage } = authSlice.actions

export default authSlice.reducer
