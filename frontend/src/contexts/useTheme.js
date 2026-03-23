import { useMemo } from 'react'

import { useAppDispatch, useAppSelector } from '../store/hooks'
import { setTheme as setThemeAction, toggleTheme as toggleThemeAction } from '../store/themeSlice'

export function useTheme() {
  const dispatch = useAppDispatch()
  const theme = useAppSelector((state) => state.theme.value)

  return useMemo(
    () => ({
      theme,
      setTheme: (value) => dispatch(setThemeAction(value)),
      toggleTheme: () => dispatch(toggleThemeAction()),
    }),
    [theme, dispatch],
  )
}
