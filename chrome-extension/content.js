(function () {

  function getText(sel) {
    const el = document.querySelector(sel)
    return el ? el.innerText.trim() : ''
  }

  function getTextFromSelectors(selectors) {
    for (const sel of selectors) {
      const value = getText(sel)
      if (value) return value
    }
    return ''
  }

  function extractJobTitle() {
    const el = document.querySelector('[data-automation-id="jobPostingHeader"]')
    if (!el) return ''
    const lines = el.innerText
      .split('\n')
      .map((t) => t.trim())
      .filter(Boolean)
    for (const line of lines) {
      if (!/apply|remote|location|time type|posted|job requisition/i.test(line)) {
        return line
      }
    }
    return lines[0] || ''
  }

  function parseDaysAgoToIsoDate(text) {
    const raw = String(text || '').trim()
    if (!raw) return ''
    const m = raw.match(/posted\s+(\d+)\s+day/i)
    if (!m) return ''
    const days = Number(m[1] || 0)
    if (!Number.isFinite(days)) return ''
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - days)
    return d.toISOString().slice(0, 10)
  }

  function textFromLabel(bodyText, label) {
    const rx = new RegExp(`${label}\\s*\\n\\s*([^\\n]+)`, 'i')
    const m = bodyText.match(rx)
    return m ? String(m[1] || '').trim() : ''
  }

  function getBodyLines(bodyText) {
    return String(bodyText || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
  }

  function valueFromLabeledLines(lines, labelPattern) {
    const rx = new RegExp(`^${labelPattern}\\s*:?\\s*(.*)$`, 'i')
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i]
      const m = line.match(rx)
      if (!m) continue
      const inlineValue = String(m[1] || '').trim()
      if (inlineValue) return inlineValue
      return String(lines[i + 1] || '').trim()
    }
    return ''
  }

  function normalizeCompanyToken(token) {
    const cleaned = String(token || '')
      .replace(/[^a-z0-9]+/gi, ' ')
      .trim()
      .toLowerCase()
    if (!cleaned) return ''
    if (cleaned === 'flextronics') return 'Flex'
    return cleaned
      .split(' ')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  }

  function inferCompanyFromHost() {
    const host = String(window.location.hostname || '').toLowerCase()
    if (!host) return ''
    const parts = host.split('.').filter(Boolean)
    if (!parts.length) return ''

    const blocked = new Set(['www', 'wd1', 'wd2', 'wd3', 'wd4', 'wd5', 'wd6', 'wd7', 'wd8', 'wd9', 'myworkdayjobs', 'workday'])
    const token = parts.find((part) => !blocked.has(part)) || ''
    return normalizeCompanyToken(token)
  }

  function inferCompanyFromDocument(lines) {
    const ogSiteName = String(document.querySelector('meta[property="og:site_name"]')?.content || '').trim()
    const fromMeta = normalizeCompanyToken(ogSiteName)
    if (fromMeta) return fromMeta

    const title = String(document.title || '').trim()
    const titleMatch = title.match(/([A-Za-z][A-Za-z0-9&.\- ]{1,50})\s+Careers?/i)
    if (titleMatch) {
      const fromTitle = normalizeCompanyToken(titleMatch[1])
      if (fromTitle && !/^workday$/i.test(fromTitle)) return fromTitle
    }

    const fromLabel = valueFromLabeledLines(lines, 'company|organization|employer')
    return normalizeCompanyToken(fromLabel)
  }

  function inferLocationFromUrl() {
    const url = String(window.location.href || '')
    const m = url.match(/\/job\/([^/]+)\//i)
    if (!m) return ''
    return decodeURIComponent(String(m[1] || '').trim())
  }

  function extractJobMeta() {
    const bodyText = String(document.body?.innerText || '')
    const lines = getBodyLines(bodyText)
    const jobTitle = extractJobTitle()
    const remoteType =
      valueFromLabeledLines(lines, 'remote type') ||
      textFromLabel(bodyText, 'remote type')

    let companyName =
      getTextFromSelectors([
        '[data-automation-id="companyName"]',
        '[data-automation-id="company-name"]',
        '[data-automation-id*="company"]',
        '[data-automation-id*="employer"]',
      ]) ||
      inferCompanyFromDocument(lines) ||
      inferCompanyFromHost()

    if (!companyName) {
      const maybeCompany = normalizeCompanyToken(remoteType)
      if (maybeCompany && !/^(remote|hybrid|onsite|on site)$/i.test(maybeCompany)) {
        companyName = maybeCompany
      }
    }

    const location =
      getText('[data-automation-id="location"]') ||
      getText('[data-automation-id*="locations"]') ||
      getText('[data-automation-id*="location"]') ||
      valueFromLabeledLines(lines, 'locations?') ||
      textFromLabel(bodyText, 'locations?') ||
      inferLocationFromUrl()

    const postedDate =
      getText('[data-automation-id="postedOn"]') ||
      valueFromLabeledLines(lines, 'posted on') ||
      textFromLabel(bodyText, 'posted on')

    const timeType =
      valueFromLabeledLines(lines, 'time type') ||
      textFromLabel(bodyText, 'time type')

    // 🧠 Extract Job ID (Workday pattern)
    let jobId = ''
    
    // Example URL:
    // .../job/IND-Chennai/Software-Engineer_JR-0105664
    const match = window.location.href.match(/_(JR-[A-Z0-9]+)/i)
    if (match) jobId = match[1]
    if (!jobId) {
      const fromLines = valueFromLabeledLines(lines, 'job requisition id')
      if (fromLines && /JR-[A-Z0-9-]+/i.test(fromLines)) {
        jobId = String(fromLines.match(/JR-[A-Z0-9-]+/i)?.[0] || '').trim()
      }
    }
    if (!jobId) {
      const bodyMatch = bodyText.match(/job requisition id\s*[\n: ]+\s*(JR-[A-Z0-9-]+)/i)
      if (bodyMatch) jobId = String(bodyMatch[1] || '').trim()
    }

    const postedDateIso = parseDaysAgoToIsoDate(postedDate)

    return {
      jobTitle,
      companyName,
      location,
      postedDate,
      postedDateIso,
      remoteType,
      timeType,
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

  function firstNonEmpty(values) {
    for (const value of values) {
      const text = String(value || '').trim()
      if (text) return text
    }
    return ''
  }

  function sanitizeName(value) {
    const raw = String(value || '').replace(/\s+/g, ' ').trim()
    return raw.replace(/\s*\|\s*LinkedIn$/i, '').trim()
  }

  function textContent(sel) {
    const el = document.querySelector(sel)
    return el ? String(el.textContent || '').trim() : ''
  }

  function parseJsonLdPerson() {
    const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
    for (const script of scripts) {
      const raw = String(script.textContent || '').trim()
      if (!raw) continue
      try {
        const data = JSON.parse(raw)
        const items = Array.isArray(data) ? data : [data]
        for (const item of items) {
          const type = String(item?.['@type'] || '').toLowerCase()
          if (type === 'person') {
            return {
              name: String(item?.name || '').trim(),
              description: String(item?.description || '').trim(),
              url: String(item?.url || '').trim(),
            }
          }
        }
      } catch {
        // ignore invalid json-ld blocks
      }
    }
    return { name: '', description: '', url: '' }
  }

  function parseHeadlineFromTitle(title) {
    const raw = String(title || '').trim()
    if (!raw) return ''
    const left = raw.split('|')[0] || ''
    if (!left.includes('-')) return ''
    const parts = left.split('-').map((x) => x.trim()).filter(Boolean)
    return parts.length >= 2 ? parts[1] : ''
  }

  function parseCompanyFromTitle(title) {
    const raw = String(title || '').trim()
    if (!raw) return ''
    const left = raw.split('|')[0] || ''
    const parts = left.split('-').map((x) => x.trim()).filter(Boolean)
    if (parts.length >= 3) return parts[2]
    if (parts.length >= 2) {
      const candidate = parts[1]
      if (/\bat\b/i.test(candidate)) {
        return String(candidate.split(/\bat\b/i).slice(-1)[0] || '').trim()
      }
    }
    return ''
  }

  function cleanCompanyName(value) {
    let text = String(value || '').replace(/\s+/g, ' ').trim()
    if (!text) return ''
    text = text
      .replace(/\s*-\s*LinkedIn.*$/i, '')
      .replace(/\s*\|\s*LinkedIn.*$/i, '')
      .replace(/^[|,\-:\s]+|[|,\-:\s]+$/g, '')
      .trim()
    return text
  }

  function parseCompanyFromHeadline(headline) {
    const raw = String(headline || '').trim()
    if (!raw) return ''
    const m = raw.match(/\bat\s+(.+?)(?:\s*[|,•·-]\s*.*)?$/i)
    return cleanCompanyName(m ? m[1] : '')
  }

  function parseCompanyFromMetaDescription(description) {
    const raw = String(description || '').trim()
    if (!raw) return ''
    const atMatch = raw.match(/\bat\s+([^|,.\n]+)/i)
    if (atMatch) return cleanCompanyName(atMatch[1])
    const dashParts = raw.split('-').map((x) => x.trim()).filter(Boolean)
    if (dashParts.length >= 3) return cleanCompanyName(dashParts[2])
    return ''
  }

  function extractCompanyFromExperienceSection() {
    const section =
      document.querySelector('section[id*="experience"]') ||
      document.querySelector('section[data-section="experience"]')
    if (!section) return ''
    const nodes = Array.from(section.querySelectorAll('li span[aria-hidden="true"], li .t-14'))
    for (const node of nodes) {
      const text = String(node.textContent || '').replace(/\s+/g, ' ').trim()
      if (!text) continue
      if (text.length < 2 || text.length > 80) continue
      if (/(yrs|mos|full-time|part-time|contract|internship|present|remote|on-site)/i.test(text)) continue
      if (/^\d/.test(text)) continue
      return text
    }
    return ''
  }

  function extractEmployeeMeta() {
    const bodyText = String(document.body?.innerText || '')
    const lines = getBodyLines(bodyText)
    const currentUrl = String(window.location.href || '').split('?')[0].trim()
    const jsonLd = parseJsonLdPerson()
    const isLinkedIn = /(^|\.)linkedin\.com$/i.test(String(window.location.hostname || ''))
    const metaDescription = String(document.querySelector('meta[name="description"]')?.content || '').trim()

    const name = sanitizeName(firstNonEmpty([
      textContent('h1'),
      textContent('main h1'),
      textContent('h1.text-heading-xlarge'),
      getText('[data-anonymize="person-name"]'),
      jsonLd.name,
      document.querySelector('meta[property="og:title"]')?.content,
      document.title,
    ]))

    const headline = firstNonEmpty([
      textContent('.text-body-medium.break-words'),
      textContent('.text-body-medium'),
      getText('.text-body-medium.break-words'),
      getText('.pv-text-details__left-panel .text-body-medium'),
      parseHeadlineFromTitle(document.title),
      jsonLd.description,
      valueFromLabeledLines(lines, 'headline|title|role|position'),
    ])

    let companyName = firstNonEmpty([
      extractCompanyFromExperienceSection(),
      parseCompanyFromHeadline(headline),
      textContent('.pv-entity__secondary-title'),
      textContent('section[id*="experience"] li .t-14.t-normal span[aria-hidden="true"]'),
      parseCompanyFromTitle(document.title),
      parseCompanyFromMetaDescription(metaDescription),
      valueFromLabeledLines(lines, 'company|organization|employer|current company'),
      getText('[data-field="experience_company_logo"] + div span'),
    ])
    if (!companyName && /\bat\s+/i.test(headline)) {
      companyName = String(headline.split(/\bat\s+/i).slice(-1)[0] || '').trim()
    }
    if (!companyName) {
      const fromHost = inferCompanyFromHost()
      if (!/^linkedin$/i.test(fromHost)) companyName = fromHost
    }
    if (!companyName && /\bat\s+/i.test(metaDescription)) {
      companyName = String(metaDescription.split(/\bat\s+/i).slice(-1)[0] || '').split(/[,.|]/)[0].trim()
    }
    companyName = cleanCompanyName(companyName)

    const location = firstNonEmpty([
      textContent('.text-body-small.inline.t-black--light.break-words'),
      textContent('.pv-text-details__left-panel .text-body-small'),
      getText('.text-body-small.inline.t-black--light.break-words'),
      valueFromLabeledLines(lines, 'location'),
      /in\s+([^,|]+(?:,\s*[^,|]+)?)/i.exec(metaDescription)?.[1] || '',
      valueFromLabeledLines(lines, 'location|based in|city'),
    ])

    const about = firstNonEmpty([
      textContent('section[id*="about"] .display-flex.ph5.pv3 .full-width'),
      textContent('section[id*="about"] span[aria-hidden="true"]'),
      getText('[data-generated-suggestion-target]'),
      getText('#about ~ div'),
      valueFromLabeledLines(lines, 'about|summary|bio'),
      headline,
    ])

    const role = headline || parseHeadlineFromTitle(document.title)
    const department = /hr|human resources|recruit/i.test(headline) ? 'HR' : 'Engineering'
    const linkedinUrl = /linkedin\.com\/in\//i.test(currentUrl)
      ? currentUrl
      : (/linkedin\.com\/in\//i.test(jsonLd.url) ? jsonLd.url : '')

    const safeName = isLinkedIn ? name.replace(/\s*-\s*LinkedIn$/i, '').trim() : name

    return {
      name: safeName,
      role,
      department,
      companyName,
      location,
      about,
      linkedinUrl,
    }
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.type === 'EXTRACT_JD') {
      const meta = extractJobMeta()

      sendResponse({
        jdText: extractJobDescription(),
        ...meta,
      })
      return true
    }
    if (msg?.type === 'EXTRACT_EMPLOYEE') {
      sendResponse(extractEmployeeMeta())
      return true
    }
    if (msg?.type === 'GET_LOCAL_ACCESS_TOKEN') {
      try {
        const token = String(localStorage.getItem('access') || '').trim()
        sendResponse({ token })
      } catch {
        sendResponse({ token: '' })
      }
      return true
    }
    return false
  })

})()
