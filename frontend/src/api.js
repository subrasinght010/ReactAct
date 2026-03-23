const API_HOST = typeof window !== 'undefined' ? window.location.hostname : 'localhost'
const API_PROTOCOL = typeof window !== 'undefined' ? window.location.protocol : 'http:'
const API_BASE_URL = `${API_PROTOCOL}//${API_HOST}:8000/api`

let accessTokenMemory = ''
let csrfTokenMemory = ''
let refreshPromise = null
let csrfPromise = null
const authSubscribers = new Set()

function normalizeError(message, status = 0, data = {}) {
  const error = new Error(message || 'Request failed')
  error.status = status
  error.data = data
  return error
}

async function parseResponse(response) {
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    let message = data.detail || data.message || 'Request failed'
    if (typeof message === 'string' && message.toLowerCase().includes('token not valid')) {
      message = 'Session expired. Please log in again.'
    }
    throw normalizeError(message, response.status, data)
  }
  return data
}

function notifyAuthSubscribers() {
  authSubscribers.forEach((listener) => {
    try {
      listener(accessTokenMemory)
    } catch {
      // Ignore listener errors to keep auth propagation resilient.
    }
  })
}

export function subscribeToAuth(listener) {
  authSubscribers.add(listener)
  listener(accessTokenMemory)
  return () => authSubscribers.delete(listener)
}

export function getAccessToken() {
  return accessTokenMemory
}

export function setAccessToken(token) {
  accessTokenMemory = String(token || '')
  notifyAuthSubscribers()
  return accessTokenMemory
}

export function clearAccessToken() {
  accessTokenMemory = ''
  notifyAuthSubscribers()
}

async function ensureCsrfCookie() {
  if (!csrfPromise) {
    csrfPromise = fetch(`${API_BASE_URL}/csrf/`, {
      method: 'GET',
      credentials: 'include',
    })
      .then(parseResponse)
      .then((data) => {
        csrfTokenMemory = String(data?.csrfToken || '')
        return csrfTokenMemory
      })
      .finally(() => {
        csrfPromise = null
      })
  }

  return csrfPromise
}

function buildHeaders(headers = {}, { withJson = false, withAuth = true, withCsrf = false } = {}) {
  const next = { ...headers }

  if (withJson && !next['Content-Type']) {
    next['Content-Type'] = 'application/json'
  }

  if (withAuth) {
    const token = getAccessToken()
    if (token) {
      next.Authorization = `Bearer ${token}`
    }
  }

  if (withCsrf && csrfTokenMemory) {
    next['X-CSRFToken'] = csrfTokenMemory
  }

  return next
}

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      await ensureCsrfCookie()
      const response = await fetch(`${API_BASE_URL}/token/refresh/`, {
        method: 'POST',
        credentials: 'include',
        headers: buildHeaders({}, { withJson: true, withAuth: false, withCsrf: true }),
        body: JSON.stringify({}),
      })
      const data = await parseResponse(response)
      const nextToken = String(data?.access || '')
      if (!nextToken) {
        throw normalizeError('Session expired. Please log in again.', 401, data)
      }
      setAccessToken(nextToken)
      return nextToken
    })()
      .catch((error) => {
        clearAccessToken()
        throw error
      })
      .finally(() => {
        refreshPromise = null
      })
  }

  return refreshPromise
}

async function authFetch(path, options = {}) {
  const method = String(options.method || 'GET').toUpperCase()
  const needsCsrf = !['GET', 'HEAD', 'OPTIONS'].includes(method)

  if (needsCsrf) {
    await ensureCsrfCookie()
  }

  const first = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: buildHeaders(options.headers, {
      withJson: options.withJson !== false,
      withAuth: options.withAuth !== false,
      withCsrf: needsCsrf,
    }),
  })

  if (first.status !== 401 || path.startsWith('/token/')) {
    return parseResponse(first)
  }

  await refreshAccessToken()

  const second = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: buildHeaders(options.headers, {
      withJson: options.withJson !== false,
      withAuth: options.withAuth !== false,
      withCsrf: needsCsrf,
    }),
  })

  return parseResponse(second)
}

export async function restoreSession() {
  try {
    await ensureCsrfCookie()
    return await refreshAccessToken()
  } catch {
    return null
  }
}

export async function loginUser(username, password) {
  await ensureCsrfCookie()
  return authFetch('/token/', {
    method: 'POST',
    withAuth: false,
    body: JSON.stringify({ username, password }),
  })
}

export async function logoutUser() {
  await ensureCsrfCookie()
  try {
    return await authFetch('/token/logout/', {
      method: 'POST',
      withAuth: false,
      body: JSON.stringify({}),
    })
  } finally {
    clearAccessToken()
  }
}

export async function signupUser(username, email, password) {
  await ensureCsrfCookie()
  return authFetch('/signup/', {
    method: 'POST',
    withAuth: false,
    body: JSON.stringify({ username, email, password }),
  })
}

export async function fetchProfile() {
  return authFetch('/profile/', { method: 'GET', withJson: false })
}

export async function createJobRole(payload) {
  return authFetch('/job-roles/', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function createResume(payload) {
  return authFetch('/resumes/', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function runAnalysis(resumeId, jobRoleId, keywords, profiles, profileKeywords) {
  return authFetch('/run-analysis/', {
    method: 'POST',
    body: JSON.stringify({
      resume_id: resumeId,
      job_role_id: jobRoleId || null,
      keywords,
      profiles: profiles || [],
      profile_keywords: profileKeywords || null,
    }),
  })
}

export async function fetchAnalyses(resumeId) {
  const query = resumeId ? `?resume_id=${encodeURIComponent(resumeId)}` : ''
  return authFetch(`/analyses/${query}`, { method: 'GET', withJson: false })
}

export async function fetchResumes() {
  return authFetch('/resumes/', { method: 'GET', withJson: false })
}

export async function fetchResume(resumeId) {
  return authFetch(`/resumes/${resumeId}/`, { method: 'GET', withJson: false })
}

export async function updateResume(resumeId, payload) {
  return authFetch(`/resumes/${resumeId}/`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}
