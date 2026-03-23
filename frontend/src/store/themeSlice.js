import { createSlice } from '@reduxjs/toolkit'

const themeSlice = createSlice({
  name: 'theme',
  initialState: {
    value: localStorage.getItem('theme') || 'light',
  },
  reducers: {
    setTheme(state, action) {
      state.value = action.payload === 'dark' ? 'dark' : 'light'
    },
    toggleTheme(state) {
      state.value = state.value === 'dark' ? 'light' : 'dark'
    },
  },
})

export const { setTheme, toggleTheme } = themeSlice.actions

export default themeSlice.reducer
