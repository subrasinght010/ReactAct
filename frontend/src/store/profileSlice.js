import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'

import { fetchProfile } from '../api'

export const loadProfile = createAsyncThunk('profile/loadProfile', async (_, { rejectWithValue }) => {
  try {
    return await fetchProfile()
  } catch (error) {
    return rejectWithValue(error.message || 'Failed to load profile')
  }
})

const profileSlice = createSlice({
  name: 'profile',
  initialState: {
    data: null,
    status: 'idle',
    error: '',
  },
  reducers: {
    clearProfile(state) {
      state.data = null
      state.status = 'idle'
      state.error = ''
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadProfile.pending, (state) => {
        state.status = 'loading'
        state.error = ''
      })
      .addCase(loadProfile.fulfilled, (state, action) => {
        state.data = action.payload
        state.status = 'succeeded'
        state.error = ''
      })
      .addCase(loadProfile.rejected, (state, action) => {
        state.data = null
        state.status = 'failed'
        state.error = String(action.payload || action.error?.message || 'Failed to load profile')
      })
  },
})

export const { clearProfile } = profileSlice.actions

export default profileSlice.reducer
