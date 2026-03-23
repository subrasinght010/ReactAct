# Routing, Context, and Redux Toolkit Guide

This file explains how the frontend evolved in this project:

1. routing
2. shared state with Context API
3. shared state with Redux Toolkit

It is written against the current code in this project.

## 1. Router: what was needed

The app now uses `react-router-dom`.

Main files:
- `./ReactAct/frontend/src/main.jsx`
- `./ReactAct/frontend/src/App.jsx`

### Why router was needed

We have multiple pages:
- `/`
- `/login`
- `/register`
- `/dashboard`
- `/builder`
- `/preview/:resumeId`

Without a router, page switching becomes manual and hard to scale.

### What changed

In `./ReactAct/frontend/src/main.jsx`:
- wrapped the app with `BrowserRouter`

In `./ReactAct/frontend/src/App.jsx`:
- added `Routes`
- added `Route`
- added `Navigate`
- added protected route logic with:
  - `RequireAuth`
  - `PublicOnly`

### What this gives you

- proper page-based navigation
- protected pages for logged-in users only
- redirect to login if token is missing
- redirect back after login using `sessionStorage`

## 2. Context API: what it was doing before Redux

Before Redux Toolkit, shared state was handled with Context API.

Old files that existed:
- `./ReactAct/frontend/src/contexts/AuthContext.jsx`
- `./ReactAct/frontend/src/contexts/ThemeContext.jsx`
- `./ReactAct/frontend/src/contexts/auth-context.js`
- `./ReactAct/frontend/src/contexts/theme-context.js`

Consumer hooks:
- `./ReactAct/frontend/src/contexts/useAuth.js`
- `./ReactAct/frontend/src/contexts/useTheme.js`

### Why Context was used

Some values were needed in many places:
- auth tokens
- `isLoggedIn`
- `login()`
- `logout()`
- theme
- `toggleTheme()`

Instead of passing these through props everywhere, Context exposed them globally.

### What AuthContext used to do

It stored:
- `accessToken`
- `refreshToken`
- `isLoggedIn`

It also provided:
- `login(access, refresh)`
- `logout()`

It synced values from `localStorage` and listened to:
- `storage`
- `auth-changed`

### What ThemeContext used to do

It stored:
- `theme`

It also provided:
- `setTheme()`
- `toggleTheme()`

It synced theme into:
- `document.documentElement.dataset.theme`
- `localStorage`

### Limitation of Context here

Context worked, but it had limits:
- auth state logic lived in one provider
- theme logic lived in another provider
- profile data was fetched separately in components
- state transitions were less explicit than Redux actions
- scaling shared state to dashboard analytics/resume state would become messy

## 3. Redux Toolkit: what changed

Now the app uses Redux Toolkit for shared app state.

New files:
- `./ReactAct/frontend/src/store/index.js`
- `./ReactAct/frontend/src/store/hooks.js`
- `./ReactAct/frontend/src/store/authSlice.js`
- `./ReactAct/frontend/src/store/themeSlice.js`
- `./ReactAct/frontend/src/store/profileSlice.js`
- `./ReactAct/frontend/src/components/AppStateSync.jsx`

### Why Redux Toolkit was a better fit

Redux Toolkit gives:
- central store
- explicit state slices
- reducers for state changes
- async handling with `createAsyncThunk`
- predictable shared state flow

For learning, this is better than Context because you can clearly see:
- where state lives
- which action changes it
- which components read it

## 4. What each slice does

### `authSlice`

File:
- `./ReactAct/frontend/src/store/authSlice.js`

State:
- `accessToken`
- `refreshToken`

Reducers:
- `syncFromStorage`
- `loginSucceeded`
- `logoutCompleted`

Use:
- app reads auth from one place
- login/logout updates Redux and `localStorage`

### `themeSlice`

File:
- `./ReactAct/frontend/src/store/themeSlice.js`

State:
- `value`

Reducers:
- `setTheme`
- `toggleTheme`

Use:
- dark mode is now store-driven

### `profileSlice`

File:
- `./ReactAct/frontend/src/store/profileSlice.js`

State:
- `data`
- `status`
- `error`

Async thunk:
- `loadProfile`

Use:
- navbar and home page now read profile from Redux
- no duplicate local `fetchProfile()` logic in each component

## 5. AppStateSync: why it exists

File:
- `./ReactAct/frontend/src/components/AppStateSync.jsx`

This component connects Redux with browser-side side effects.

It does 3 important jobs:

### Auth sync

Listens for:
- `storage`
- `auth-changed`

Then dispatches:
- `syncFromStorage()`

### Theme sync

Whenever theme changes, it writes:
- `document.documentElement.dataset.theme`
- `localStorage`

### Profile sync

When `accessToken` exists:
- dispatches `loadProfile(accessToken)`

When user logs out:
- dispatches `clearProfile()`

This is important because reducers should stay pure. Browser effects belong outside reducers.

## 6. What changed in the hooks

### `useAuth`

File:
- `./ReactAct/frontend/src/contexts/useAuth.js`

Before:
- read from React Context

Now:
- reads from Redux with `useAppSelector`
- dispatches Redux actions with `useAppDispatch`

It still returns the same API:
- `accessToken`
- `refreshToken`
- `isLoggedIn`
- `login()`
- `logout()`

This was intentional so the rest of the app needed minimal changes.

### `useTheme`

File:
- `./ReactAct/frontend/src/contexts/useTheme.js`

Before:
- read from ThemeContext

Now:
- reads from Redux
- dispatches `setTheme` and `toggleTheme`

It still returns:
- `theme`
- `setTheme()`
- `toggleTheme()`

Again, same external API, new internal implementation.

## 7. What changed in components

### `main.jsx`

File:
- `./ReactAct/frontend/src/main.jsx`

Before:
- wrapped app with `AuthProvider`
- wrapped app with `ThemeProvider`

Now:
- wraps app with Redux `Provider`
- renders `AppStateSync`
- keeps `BrowserRouter`

### `NavBar.jsx`

File:
- `./ReactAct/frontend/src/components/NavBar.jsx`

Before:
- fetched profile locally
- used Context for auth/theme

Now:
- uses Redux-backed `useAuth()`
- uses Redux-backed `useTheme()`
- reads username from Redux `profile`

### `HomePage.jsx`

File:
- `./ReactAct/frontend/src/pages/HomePage.jsx`

Before:
- fetched profile locally

Now:
- reads username from Redux `profile`

## 8. Why this is a good learning pattern

This project now shows a practical progression:

### Step 1: Router

Use router when app has multiple pages.

### Step 2: Context

Use Context when global shared state is small:
- auth
- theme

### Step 3: Redux Toolkit

Use Redux Toolkit when:
- shared state grows
- async state matters
- many components need the same data
- you want more explicit state transitions

## 9. Mental model

### Router

Router answers:
- which page should render?

### Context

Context answers:
- how can many components read the same small shared value?

### Redux Toolkit

Redux answers:
- where does shared app state live?
- which action changed it?
- how does async data enter the app?

## 10. Current architecture in this project

### Routing

Handled by:
- `react-router-dom`

### Shared global state

Handled by:
- Redux Toolkit

Current slices:
- `auth`
- `theme`
- `profile`

### Local component state

Still handled with `useState` when state is local only:
- form fields
- hover state
- modal/panel open state
- builder section editing

That is correct. Not all state should go to Redux.

## 11. What to study next

If you want to learn Redux Toolkit properly in this same project, study in this order:

1. `./ReactAct/frontend/src/store/index.js`
2. `./ReactAct/frontend/src/store/authSlice.js`
3. `./ReactAct/frontend/src/store/themeSlice.js`
4. `./ReactAct/frontend/src/store/profileSlice.js`
5. `./ReactAct/frontend/src/components/AppStateSync.jsx`
6. `./ReactAct/frontend/src/contexts/useAuth.js`
7. `./ReactAct/frontend/src/contexts/useTheme.js`
8. `./ReactAct/frontend/src/App.jsx`

If you want, next I can create one more file:
- a simpler beginner version that explains Redux Toolkit in very basic React terms with small code examples
