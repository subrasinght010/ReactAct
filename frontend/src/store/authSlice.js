import { createSlice } from '@reduxjs/toolkit'

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    accessToken: '',
    authReady: false,
  },
  reducers: {
    authStateChanged(state, action) {
      state.accessToken = String(action.payload || '')
    },
    authReadySet(state, action) {
      state.authReady = Boolean(action.payload)
    },
    logoutCompleted(state) {
      state.accessToken = ''
      state.authReady = true
    },
  },
})

export const { authReadySet, authStateChanged, logoutCompleted } = authSlice.actions

export default authSlice.reducer
