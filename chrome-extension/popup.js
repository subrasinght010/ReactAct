const els = {
  apiBase: document.getElementById('apiBase'),
  companyName: document.getElementById('companyName'),
  jobTitle: document.getElementById('jobTitle'),
  jobId: document.getElementById('jobId'),
  location: document.getElementById('location'),
  postedDate: document.getElementById('postedDate'),
  jobUrl: document.getElementById('jobUrl'),
  jdText: document.getElementById('jdText'),
  status: document.getElementById('status'),

  fetchJdBtn: document.getElementById('fetchJdBtn'),
  saveJobBtn: document.getElementById('saveJobBtn'),
}

function setStatus(msg, isError = false) {
  els.status.textContent = msg
  els.status.style.color = isError ? 'red' : 'green'
}

function normalizeBase(base) {
  return base.replace(/\/+$/, '')
}

function getToken() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['token'], (res) => {
      resolve((res.token || '').trim())
    })
  })
}

async function apiFetch(url, options = {}) {
  const token = await getToken()

  if (!token) throw new Error('Missing auth token')

  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) throw new Error(data.detail || 'API error')

  return data
}

async function sendToActiveTab(type) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return chrome.tabs.sendMessage(tab.id, { type })
}



async function fetchJd() {
  try {
    const res = await sendToActiveTab('EXTRACT_JD')

    els.jdText.value = res.jdText || ''
    els.companyName.value = res.companyName || ''
    els.jobTitle.value = res.jobTitle || ''
    els.jobId.value = res.jobId || ''
    els.location.value = res.location || ''
    els.postedDate.value = res.postedDate || ''
    els.jobUrl.value = res.jobUrl || ''

    setStatus('Fetched ✓')
  } catch (err) {
    setStatus(err.message, true)
  }
}



async function saveJob() {
  const apiBase = normalizeBase(els.apiBase.value)

  const payload = {
    company_name: els.companyName.value,
    job_title: els.jobTitle.value,
    job_id: els.jobId.value,
    location: els.location.value,
    posted_date: els.postedDate.value,
    job_url: els.jobUrl.value,
    job_description: els.jdText.value,
  }

  try {
    setStatus('Saving job...')

    await apiFetch(`${apiBase}/jobs/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })

    setStatus('Saved ✓')
  } catch (err) {
    setStatus(err.message, true)
  }
}


els.fetchJdBtn.onclick = fetchJd
els.saveJobBtn.onclick = saveJob