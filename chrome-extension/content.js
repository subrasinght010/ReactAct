(function () {

  function getText(sel) {
    const el = document.querySelector(sel)
    return el ? el.innerText.trim() : ''
  }

const jobTitle = (() => {
  // 🎯 ONLY pick Workday job title node
  const el = document.querySelector('[data-automation-id="jobPostingHeader"]')

  if (!el) return ''

  // Clean text (remove junk lines if any)
  const lines = el.innerText
    .split('\n')
    .map(t => t.trim())
    .filter(Boolean)

  // Pick first meaningful line
  for (const line of lines) {
    if (!/apply|remote|location|time type|posted|job requisition/i.test(line)) {
      return line
    }
  }

  return lines[0] || ''
})()

    const companyName =
      getText('[data-automation-id="companyName"]') ||
      'Workday' // fallback

    const location =
      getText('[data-automation-id="location"]')

    const postedDate =
      getText('[data-automation-id="postedOn"]')

    // 🧠 Extract Job ID (Workday pattern)
    let jobId = ''
    
    // Example URL:
    // .../job/IND-Chennai/Software-Engineer_JR-0105664
    const match = window.location.href.match(/_(JR-[A-Z0-9]+)/i)
    if (match) jobId = match[1]

    return {
      jobTitle,
      companyName,
      location,
      postedDate,
      jobId,
      jobUrl: window.location.href,
    }
  }

  function extractJobDescription() {
    const el = document.querySelector('[data-automation-id="jobPostingDescription"]')
    if (el) return el.innerText.trim()

    // fallback (rare)
    return document.body.innerText.slice(0, 5000)
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'EXTRACT_JD') {
      const meta = extractJobMeta()

      sendResponse({
        jdText: extractJobDescription(),
        ...meta
      })
    }
  })

})()