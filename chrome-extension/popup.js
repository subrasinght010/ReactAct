const els = {
  apiBase: document.getElementById('apiBase'),
  companyName: document.getElementById('companyName'),
  jobTitle: document.getElementById('jobTitle'),
  jobId: document.getElementById('jobId'),
  jobUrl: document.getElementById('jobUrl'),
  jdText: document.getElementById('jdText'),
  resumeFile: document.getElementById('resumeFile'),
  predefinedAnswers: document.getElementById('predefinedAnswers'),
  useAi: document.getElementById('useAi'),
  questionsOut: document.getElementById('questionsOut'),
  status: document.getElementById('status'),
  fetchJdBtn: document.getElementById('fetchJdBtn'),
  tailorBtn: document.getElementById('tailorBtn'),
  scanQuestionsBtn: document.getElementById('scanQuestionsBtn'),
  autofillBtn: document.getElementById('autofillBtn'),
  fetchLinkedInBtn: document.getElementById('fetchLinkedInBtn'),
  sendLinkedInBtn: document.getElementById('sendLinkedInBtn'),
  liBadge: document.getElementById('liBadge'),
  liAvatar: document.getElementById('liAvatar'),
  liName: document.getElementById('liName'),
  liRole: document.getElementById('liRole'),
  liLocation: document.getElementById('liLocation'),
  liCompany: document.getElementById('liCompany'),
  liCompanyUrl: document.getElementById('liCompanyUrl'),
  liUrl: document.getElementById('liUrl'),
  liAbout: document.getElementById('liAbout'),
  liDept: document.getElementById('liDept'),
}

if (window.self !== window.top) document.body.classList.add('embedded')

let currentLinkedInProfile = null

function setStatus(message, isError = false) {
  els.status.textContent = message || ''
  els.status.classList.toggle('error', Boolean(isError))
}

function normalizeBase(base) {
  return String(base || '').trim().replace(/\/+$/, '') || 'http://127.0.0.1:8000/api'
}

function parsePredefinedMap(raw) {
  const text = String(raw || '').trim()
  if (!text) return {}
  try {
    const parsed = JSON.parse(text)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out = {}
    Object.entries(parsed).forEach(([k, v]) => {
      if (!k) return
      out[String(k).trim()] = String(v ?? '').trim()
    })
    return out
  } catch { return {} }
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      resolve(result.includes(',') ? result.split(',')[1] : result)
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

async function getActiveTab() {
  const stored = await new Promise((resolve) =>
    chrome.storage.local.get(['panelSourceTabId'], (v) => resolve(Number(v.panelSourceTabId || 0)))
  )
  if (stored > 0) {
    try {
      const tab = await chrome.tabs.get(stored)
      if (tab?.id) return tab
    } catch {}
  }
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  return tabs[0] || null
}

function detectJobPlatform(url) {
  const v = String(url || '').toLowerCase()
  if (v.includes('myworkdayjobs.com') || v.includes('/workday/')) return 'workday'
  if (v.includes('boards.greenhouse.io') || v.includes('/greenhouse/')) return 'greenhouse'
  if (v.includes('linkedin.com/jobs') || v.includes('linkedin.com/easy-apply')) return 'linkedin'
  return ''
}

async function sendToActiveTab(type, payload = {}) {
  const tab = await getActiveTab()
  if (!tab?.id) throw new Error('No active tab found')
  return (await chrome.tabs.sendMessage(tab.id, { type, ...payload })) || {}
}

async function apiFetch(url, options = {}) {
  const response = await fetch(url, options)
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.detail || data.message || `Request failed (${response.status})`)
  return data
}

function setBadge(state, text) {
  els.liBadge.textContent = text
  els.liBadge.className = 'li-badge' + (state ? ' ' + state : '')
}

function setDot(fieldName, hasValue) {
  const dot = document.getElementById('dot-' + fieldName)
  if (!dot) return
  dot.className = 'li-dot ' + (hasValue ? 'ok' : 'miss')
  dot.title = hasValue ? fieldName + ': extracted' : fieldName + ': not found'
}

function setLink(el, url, shortLabel) {
  if (url) {
    el.href = url
    el.textContent = shortLabel || url
    el.classList.remove('empty')
  } else {
    el.href = '#'
    el.textContent = '—'
    el.classList.add('empty')
  }
}

function renderLinkedInProfile(profile) {
  currentLinkedInProfile = profile

  const initials = (profile.name || '?')
    .split(/\s+/).slice(0, 2).map((w) => (w[0] || '').toUpperCase()).join('') || '?'
  els.liAvatar.textContent = initials

  els.liName.textContent = profile.name || '—'
  els.liRole.textContent = profile.role || '—'
  els.liLocation.textContent = profile.location || '—'
  els.liCompany.textContent = profile.companyName || '—'
  els.liAbout.textContent = profile.about || '—'

  setLink(els.liCompanyUrl, profile.companyProfileUrl,
    profile.companyProfileUrl ? profile.companyProfileUrl.replace('https://www.linkedin.com', '') : '')
  setLink(els.liUrl, profile.linkedinUrl,
    profile.linkedinUrl ? profile.linkedinUrl.replace('https://www.linkedin.com', '') : '')

  const dept = profile.department || 'Other'
  els.liDept.textContent = dept
  els.liDept.setAttribute('data-dept', dept)

  const status = profile.extractionStatus || {}
  Object.keys(status).forEach((k) => setDot(k, status[k]))

  els.sendLinkedInBtn.disabled = false
  setBadge('detected', 'Detected ✓')
}

async function fetchLinkedInProfile() {
  try {
    setStatus('Fetching LinkedIn profile from page...')
    setBadge('', 'Fetching…')
    els.sendLinkedInBtn.disabled = true

    const result = await sendToActiveTab('EXTRACT_LINKEDIN_PROFILE')
    if (result.error) throw new Error(result.error)
    if (!result.profile) throw new Error('No profile data returned')

    renderLinkedInProfile(result.profile)
    const status = result.profile.extractionStatus || {}
    const found = Object.values(status).filter(Boolean).length
    const total = Object.keys(status).length
    setStatus(`Profile fetched — ${found}/${total} fields extracted`)
  } catch (err) {
    setBadge('error', 'Error')
    setStatus(err.message || 'Failed to fetch LinkedIn profile', true)
    currentLinkedInProfile = null
    els.sendLinkedInBtn.disabled = true
  }
}

async function sendLinkedInProfile() {
  if (!currentLinkedInProfile) return setStatus('No profile. Fetch first.', true)
  const apiBase = normalizeBase(els.apiBase.value)
  try {
    els.sendLinkedInBtn.disabled = true
    setStatus('Sending profile to backend…')
    await apiFetch(`${apiBase}/linkedin-profile/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(currentLinkedInProfile),
    })
    setBadge('sent', 'Sent ✓')
    setStatus(`Sent: ${currentLinkedInProfile.name || 'profile'}`)
  } catch (err) {
    setBadge('error', 'Send failed')
    setStatus(err.message || 'Failed to send profile', true)
  } finally {
    els.sendLinkedInBtn.disabled = false
  }
}

async function fetchJdFromPage() {
  try {
    setStatus('Fetching JD from active page...')
    const result = await sendToActiveTab('EXTRACT_JD')
    const jd = String(result.jdText || '').trim()
    if (!jd) throw new Error('No JD text found on this page')
    els.jdText.value = jd
    if (!els.jobUrl.value.trim()) {
      const tab = await getActiveTab()
      els.jobUrl.value = tab?.url || ''
    }
    if (!els.jobTitle.value.trim()) els.jobTitle.value = String(result.jobTitle || '').trim()
    if (!els.companyName.value.trim()) els.companyName.value = String(result.companyName || '').trim()
    setStatus(`Fetched JD (${jd.length} chars)`)
    saveSettings()
  } catch (err) {
    setStatus(err.message || 'Failed to fetch JD', true)
  }
}

async function tailorResume() {
  const apiBase = normalizeBase(els.apiBase.value)
  const jdText = String(els.jdText.value || '').trim()
  const resumeFile = els.resumeFile.files?.[0]
  if (jdText.length < 40) return setStatus('Paste/fetch full JD (min 40 chars)', true)
  if (!resumeFile) return setStatus('Upload reference resume PDF', true)
  try {
    els.tailorBtn.disabled = true
    setStatus('Parsing resume PDF...')
    const parseFd = new FormData()
    parseFd.append('file', resumeFile)
    const parsed = await apiFetch(`${apiBase}/parse-resume/`, { method: 'POST', body: parseFd })
    setStatus('Tailoring resume...')
    const fd = new FormData()
    fd.append('job_description', jdText)
    fd.append('job_role', String(els.jobTitle.value || '').trim())
    fd.append('company_name', String(els.companyName.value || '').trim())
    fd.append('job_title', String(els.jobTitle.value || '').trim())
    fd.append('job_id', String(els.jobId.value || '').trim())
    fd.append('job_url', String(els.jobUrl.value || '').trim())
    fd.append('builder_data', JSON.stringify(parsed || {}))
    fd.append('preview_only', 'true')
    fd.append('force_rewrite', 'true')
    fd.append('ai_model', 'gpt-4o')
    fd.append('tailor_mode', 'complete')
    const result = await apiFetch(`${apiBase}/tailor-resume/`, { method: 'POST', body: fd })
    const score = Number(result?.match_score)
    setStatus(`Tailored (match: ${Number.isFinite(score) ? Math.round(score * 100) + '%' : 'n/a'})`)
  } catch (err) {
    setStatus(err.message || 'Tailor failed', true)
  } finally {
    els.tailorBtn.disabled = false
  }
}

async function scanQuestions() {
  try {
    setStatus('Scanning form questions...')
    const result = await sendToActiveTab('SCAN_FORM_QUESTIONS')
    const questions = Array.isArray(result.questions) ? result.questions : []
    els.questionsOut.value = questions.join('\n')
    setStatus(`Found ${questions.length} questions`)
  } catch (err) {
    setStatus(err.message || 'Failed to scan questions', true)
  }
}

async function autofillForm() {
  const apiBase = normalizeBase(els.apiBase.value)
  const predefined = parsePredefinedMap(els.predefinedAnswers.value)
  const resumeFile = els.resumeFile.files?.[0]
  try {
    els.autofillBtn.disabled = true
    setStatus('Collecting page questions...')
    const scan = await sendToActiveTab('SCAN_FORM_QUESTIONS')
    const questions = Array.isArray(scan.questions) ? scan.questions : []
    const unanswered = questions.filter((q) => !predefined[q] && !predefined[q.toLowerCase()])
    let aiMap = {}
    if (els.useAi.checked && unanswered.length) {
      setStatus(`Getting AI answers for ${unanswered.length} questions...`)
      const aiResp = await apiFetch(`${apiBase}/autofill-answers/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questions: unanswered,
          profile_context: String(els.jdText.value || '').trim().slice(0, 3000),
        }),
      })
      ;(Array.isArray(aiResp.answers) ? aiResp.answers : []).forEach((row) => {
        const q = String(row?.question || '').trim()
        const a = String(row?.answer || '').trim()
        if (q && a) aiMap[q] = a
      })
    }
    let resumeFileData = null
    if (resumeFile) {
      resumeFileData = { name: resumeFile.name, type: resumeFile.type || 'application/pdf', base64: await readFileAsBase64(resumeFile) }
    }
    setStatus('Filling form on page...')
    const fillResp = await sendToActiveTab('FILL_FORM', { answers: { ...predefined, ...aiMap }, resumeFile: resumeFileData })
    setStatus(`Filled ${fillResp.filledCount || 0} fields`)
  } catch (err) {
    setStatus(err.message || 'Autofill failed', true)
  } finally {
    els.autofillBtn.disabled = false
  }
}

function loadSettings() {
  chrome.storage.local.get(
    ['apiBase', 'companyName', 'jobTitle', 'jobId', 'jobUrl', 'predefinedAnswers', 'useAi'],
    (saved) => {
      els.apiBase.value = saved.apiBase || els.apiBase.value
      els.companyName.value = saved.companyName || ''
      els.jobTitle.value = saved.jobTitle || ''
      els.jobId.value = saved.jobId || ''
      els.jobUrl.value = saved.jobUrl || ''
      els.predefinedAnswers.value = saved.predefinedAnswers || ''
      els.useAi.checked = saved.useAi !== false
    }
  )
}

function saveSettings() {
  chrome.storage.local.set({
    apiBase: normalizeBase(els.apiBase.value),
    companyName: String(els.companyName.value || '').trim(),
    jobTitle: String(els.jobTitle.value || '').trim(),
    jobId: String(els.jobId.value || '').trim(),
    jobUrl: String(els.jobUrl.value || '').trim(),
    predefinedAnswers: String(els.predefinedAnswers.value || ''),
    useAi: Boolean(els.useAi.checked),
  })
}

async function autoInitForJobPage() {
  try {
    const tab = await getActiveTab()
    const url = String(tab?.url || '')
    if (/linkedin\.com\/in\//i.test(url)) {
      setBadge('detected', 'LinkedIn')
      setStatus('LinkedIn profile detected — click "Fetch Profile"')
      return
    }
    const platform = detectJobPlatform(url)
    if (!platform) { setStatus('Open a job page or LinkedIn profile to begin.'); return }
    if (!els.jobUrl.value.trim()) els.jobUrl.value = url
    setStatus(`Detected ${platform}. Auto-fetching JD...`)
    if (!els.jdText.value.trim()) await fetchJdFromPage()
    else setStatus(`Detected ${platform} page.`)
  } catch (err) {
    setStatus(err.message || 'Auto-detect failed', true)
  }
}

;[els.apiBase, els.companyName, els.jobTitle, els.jobId, els.jobUrl, els.predefinedAnswers, els.useAi]
  .forEach((el) => el.addEventListener('change', saveSettings))

els.fetchJdBtn.addEventListener('click', fetchJdFromPage)
els.tailorBtn.addEventListener('click', tailorResume)
els.scanQuestionsBtn.addEventListener('click', scanQuestions)
els.autofillBtn.addEventListener('click', autofillForm)
els.fetchLinkedInBtn.addEventListener('click', fetchLinkedInProfile)
els.sendLinkedInBtn.addEventListener('click', sendLinkedInProfile)

loadSettings()
autoInitForJobPage()

setTimeout(() => {
  const urlHash = String(window.location.hash || '').toLowerCase()
  if (urlHash) { focusSection(urlHash); return }
  chrome.storage.local.get(['panelHash'], (saved) => {
    focusSection(String(saved.panelHash || '').toLowerCase() || '#tailor')
    chrome.storage.local.set({ panelHash: '' })
  })
}, 60)

function focusSection(hash) {
  const map = { '#autofill': 'autofillSection', '#linkedin': 'linkedinSection', '#tailor': 'tailorSection' }
  const id = map[hash] || 'tailorSection'
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}