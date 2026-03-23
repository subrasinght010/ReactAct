import { configureStore } from '@reduxjs/toolkit'

import authReducer from './authSlice'
import profileReducer from './profileSlice'
import themeReducer from './themeSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    theme: themeReducer,
    profile: profileReducer,
  },
})
