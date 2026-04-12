(function () {
  function norm(value) {
    return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim()
  }

  function getVisible(el) {
    if (!el) return false
    const style = window.getComputedStyle(el)
    return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null
  }

  function getFieldLabel(el) {
    const id = el.id ? String(el.id) : ''
    if (id) {
      const byFor = document.querySelector(`label[for="${CSS.escape(id)}"]`)
      if (byFor) return byFor.textContent || ''
    }
    const parentLabel = el.closest('label')
    if (parentLabel) return parentLabel.textContent || ''
    const aria = el.getAttribute('aria-label') || ''
    if (aria) return aria
    const ph = el.getAttribute('placeholder') || ''
    if (ph) return ph
    const name = el.getAttribute('name') || ''
    return name
  }

  function extractJobDescription() {
    const candidates = [
      document.querySelector('article'),
      document.querySelector('[data-testid*="job"]'),
      document.querySelector('[class*="job"]'),
      document.querySelector('main'),
      document.body,
    ].filter(Boolean)
    let best = ''
    candidates.forEach((node) => {
      const text = String(node.innerText || '').trim()
      if (text.length > best.length) best = text
    })
    return best
  }

  function extractJobMeta() {
    const titleCandidates = [
      document.querySelector('h1'),
      document.querySelector('[data-test*="job-title"]'),
      document.querySelector('[class*="job-title"]'),
      document.querySelector('meta[property="og:title"]'),
    ].filter(Boolean)
    const companyCandidates = [
      document.querySelector('[data-test*="company"]'),
      document.querySelector('[class*="company"]'),
      document.querySelector('a[href*="/company/"]'),
      document.querySelector('meta[property="og:site_name"]'),
    ].filter(Boolean)

    const getText = (node) => {
      if (!node) return ''
      if (node.tagName === 'META') return String(node.getAttribute('content') || '').trim()
      return String(node.textContent || '').replace(/\s+/g, ' ').trim()
    }

    let jobTitle = ''
    for (const node of titleCandidates) {
      const t = getText(node)
      if (t && t.length >= 2) { jobTitle = t; break }
    }
    let companyName = ''
    for (const node of companyCandidates) {
      const t = getText(node)
      if (t && t.length >= 2) { companyName = t; break }
    }
    return { jobTitle, companyName }
  }

  function collectFields() {
    const fields = Array.from(document.querySelectorAll('input, textarea, select')).filter((el) => getVisible(el))
    return fields
      .filter((el) => {
        const type = norm(el.getAttribute('type') || '')
        return type !== 'hidden' && type !== 'submit' && type !== 'button'
      })
      .map((el) => ({
        el,
        type: norm(el.tagName === 'SELECT' ? 'select' : el.getAttribute('type') || el.tagName),
        label: String(getFieldLabel(el) || '').replace(/\s+/g, ' ').trim(),
        name: String(el.getAttribute('name') || '').trim(),
        id: String(el.id || '').trim(),
      }))
  }

  function questionList() {
    const fields = collectFields()
    const out = []
    const seen = new Set()
    fields.forEach((f) => {
      const q = f.label || f.name || f.id
      const key = norm(q)
      if (!key || seen.has(key)) return
      seen.add(key)
      out.push(q)
    })
    return out
  }

  function bestAnswer(field, answers) {
    const entries = Object.entries(answers || {})
    if (!entries.length) return ''
    const targets = [norm(field.label), norm(field.name), norm(field.id)].filter(Boolean)
    for (const t of targets) {
      for (const [k, v] of entries) {
        const nk = norm(k)
        if (!nk) continue
        if (t === nk || t.includes(nk) || nk.includes(t)) return String(v || '')
      }
    }
    return ''
  }

  function trigger(el) {
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }

  function parseBool(value) {
    const v = norm(value)
    return ['yes', 'true', '1', 'y', 'checked'].includes(v)
  }

  function pickSelectOption(selectEl, answer) {
    const desired = norm(answer)
    if (!desired) return false
    const options = Array.from(selectEl.options || [])
    let match = options.find((o) => norm(o.textContent) === desired || norm(o.value) === desired)
    if (!match) {
      match = options.find((o) => norm(o.textContent).includes(desired) || desired.includes(norm(o.textContent)))
    }
    if (!match) return false
    selectEl.value = match.value
    trigger(selectEl)
    return true
  }

  async function uploadResumeToMatchingFileInputs(fileData) {
    if (!fileData?.base64) return 0
    const bytes = Uint8Array.from(atob(String(fileData.base64)), (c) => c.charCodeAt(0))
    const file = new File([bytes], fileData.name || 'resume.pdf', { type: fileData.type || 'application/pdf' })
    const dt = new DataTransfer()
    dt.items.add(file)
    const fileInputs = Array.from(document.querySelectorAll('input[type="file"]')).filter((el) => getVisible(el))
    let uploaded = 0
    fileInputs.forEach((input) => {
      const meta = norm(`${getFieldLabel(input)} ${input.name || ''} ${input.id || ''}`)
      if (!meta || (!meta.includes('resume') && !meta.includes('cv') && !meta.includes('upload'))) return
      input.files = dt.files
      trigger(input)
      uploaded += 1
    })
    return uploaded
  }

  async function fillForm(answers, resumeFile) {
    const fields = collectFields()
    let filled = 0
    for (const field of fields) {
      const answer = bestAnswer(field, answers)
      if (!answer) continue
      if (field.type === 'select') {
        if (pickSelectOption(field.el, answer)) filled += 1
        continue
      }
      if (field.type === 'checkbox') {
        field.el.checked = parseBool(answer)
        trigger(field.el)
        filled += 1
        continue
      }
      if (field.type === 'radio') {
        const groupName = field.el.name
        if (!groupName) continue
        const radios = Array.from(document.querySelectorAll(`input[type="radio"][name="${CSS.escape(groupName)}"]`))
        const desired = norm(answer)
        let chosen = radios.find((r) => {
          const text = norm(`${getFieldLabel(r)} ${r.value || ''}`)
          return text === desired || text.includes(desired) || desired.includes(text)
        })
        if (!chosen && radios.length) chosen = radios[0]
        if (chosen) {
          chosen.checked = true
          trigger(chosen)
          filled += 1
        }
        continue
      }
      if (field.type !== 'file') {
        field.el.value = answer
        trigger(field.el)
        filled += 1
      }
    }
    const uploaded = await uploadResumeToMatchingFileInputs(resumeFile)
    return { filledCount: filled + uploaded }
  }

  function inferDepartment(title, about) {
    const src = norm(`${title} ${about}`)
    if (/\b(hr|human resources?|talent|recruiter|recruiting|people ops|people partner)\b/.test(src)) return 'HR'
    if (/\b(engineer|engineering|developer|dev|software|frontend|backend|fullstack|full.stack|swe|sde|devops|data|ml|ai|infra|platform|cloud|architect)\b/.test(src)) return 'Engineering'
    if (/\b(product manager|product owner|pm\b|product lead|product head)\b/.test(src)) return 'Product'
    if (/\b(design|ux|ui|visual|brand|creative)\b/.test(src)) return 'Design'
    if (/\b(market|growth|seo|content|social media|demand gen)\b/.test(src)) return 'Marketing'
    if (/\b(sales|account exec|business dev|bd\b|revenue|bdr|sdr|ae\b)\b/.test(src)) return 'Sales'
    if (/\b(finance|accounting|cfo|controller|fp&a|financial)\b/.test(src)) return 'Finance'
    if (/\b(legal|counsel|compliance|attorney|lawyer)\b/.test(src)) return 'Legal'
    if (/\b(ops|operations|supply chain|logistics)\b/.test(src)) return 'Operations'
    return 'Other'
  }

  function pickText() {
    for (var i = 0; i < arguments.length; i++) {
      try {
        var el = document.querySelector(arguments[i])
        if (!el) continue
        var t = (el.getAttribute('content') || el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim()
        if (t.length >= 2) return t
      } catch (_) {}
    }
    return ''
  }

  function extractLinkedInProfile() {
    var name = pickText(
      'h1.text-heading-xlarge',
      'h1.inline.t-24',
      'h1[class*="heading"]',
      '.top-card-layout__title',
      'h1'
    ).replace(/\s*[·|].*$/, '').trim()

    var linkedinUrl = (function () {
      var canonical = document.querySelector('link[rel="canonical"]')
      if (canonical && canonical.href && canonical.href.includes('/in/')) return canonical.href.split('?')[0]
      var m = window.location.href.match(/(https:\/\/(?:www\.)?linkedin\.com\/in\/[^/?#]+)/)
      return m ? m[1] : window.location.href.split('?')[0]
    })()

    var role = pickText(
      '.text-body-medium.break-words',
      '.pv-top-card--experience-list-item',
      '.top-card-layout__headline',
      '[class*="headline"]'
    )

    var location = pickText(
      '.pv-text-details__left-panel span.text-body-small:not([class*="hidden"]):not(.inline)',
      '.pb2 span.text-body-small',
      '.top-card-layout__first-subline .top-card__subline-item',
      '[class*="top-card__subline-item"]'
    )

    var about = (function () {
      var anchorIds = ['#about', '#about-section']
      for (var i = 0; i < anchorIds.length; i++) {
        try {
          var anchor = document.querySelector(anchorIds[i])
          if (!anchor) continue
          var section = anchor.closest('section') || (anchor.parentElement && anchor.parentElement.parentElement)
          if (!section) continue
          var visibleSpan = section.querySelector('span[aria-hidden="true"]')
          if (visibleSpan) {
            var t = (visibleSpan.innerText || '').trim()
            if (t.length > 30) return t.slice(0, 1200)
          }
          var sharedText = section.querySelector('.pv-shared-text-with-see-more')
          if (sharedText) {
            var st = (sharedText.innerText || '').trim()
            if (st.length > 30) return st.slice(0, 1200)
          }
        } catch (_) {}
      }
      var allSpans = document.querySelectorAll('span[aria-hidden="true"]')
      for (var j = 0; j < allSpans.length; j++) {
        var st2 = (allSpans[j].innerText || '').trim()
        if (st2.length > 150 && st2.length < 2000 && st2.indexOf('\n\n\n') === -1) return st2.slice(0, 1200)
      }
      return ''
    })()

    var companyName = ''
    var companyProfileUrl = ''
    var skipRe = /full.?time|part.?time|contract|freelance|internship|self.?employ|\d+\s*(yr|mo|year|month)/i

    var expAnchor = document.querySelector('#experience')
    if (expAnchor) {
      var expSection = expAnchor.closest('section') || (expAnchor.parentElement && expAnchor.parentElement.parentElement)
      var firstLi = expSection && expSection.querySelector('li')
      if (firstLi) {
        var compLink = firstLi.querySelector('a[href*="/company/"]')
        if (compLink) {
          var href = compLink.getAttribute('href') || ''
          var cm = href.match(/(\/company\/[^/?#]+)/)
          if (cm) companyProfileUrl = 'https://www.linkedin.com' + cm[1]
          var cspan = compLink.querySelector('span[aria-hidden="true"]')
          var linkText = ((cspan ? cspan.textContent : compLink.textContent) || '').replace(/\s+/g, ' ').trim()
          if (linkText && !skipRe.test(linkText)) companyName = linkText
        }
        if (!companyName) {
          var spans = firstLi.querySelectorAll('span[aria-hidden="true"]')
          for (var k = 0; k < spans.length; k++) {
            var st3 = (spans[k].textContent || '').replace(/\s+/g, ' ').trim()
            if (st3.length >= 2 && !skipRe.test(st3) && st3 !== role.trim()) { companyName = st3; break }
          }
        }
      }
    }

    if (!companyProfileUrl) {
      var anyCompLink = document.querySelector('a[href*="/company/"]')
      if (anyCompLink) {
        var ah = anyCompLink.getAttribute('href') || ''
        var am = ah.match(/(\/company\/[^/?#]+)/)
        if (am) companyProfileUrl = 'https://www.linkedin.com' + am[1]
        if (!companyName) {
          var as2 = anyCompLink.querySelector('span[aria-hidden="true"]')
          companyName = ((as2 ? as2.textContent : anyCompLink.textContent) || '').replace(/\s+/g, ' ').trim()
        }
      }
    }

    var department = inferDepartment(role, about)

    var extractionStatus = {
      name: name.length > 0,
      role: role.length > 0,
      location: location.length > 0,
      about: about.length > 0,
      companyName: companyName.length > 0,
      companyProfileUrl: companyProfileUrl.length > 0,
      linkedinUrl: linkedinUrl.length > 0,
    }

    return {
      name: name,
      linkedinUrl: linkedinUrl,
      role: role,
      location: location,
      about: about,
      companyName: companyName,
      companyProfileUrl: companyProfileUrl,
      department: department,
      extractionStatus: extractionStatus,
      extractedAt: new Date().toISOString(),
    }
  }

  function isLinkedInProfile() {
    return /linkedin\.com\/in\//i.test(window.location.href)
  }

  function ensureFloatingLaunchers() {
    if (!chrome.runtime || !chrome.runtime.id) return

    var iconUrl = chrome.runtime.getURL('assets/icon64.png')
    var popupUrl = chrome.runtime.getURL('popup.html?embedded=1')

    document.querySelectorAll(
      '#resume-tailor-floating-root, .rt-launcher, .rt-tailor, .rt-autofill, .rt-launcher-single, #rtTip, .rt-tip, #resume-tailor-panel, .rt-panel-head, .rt-panel-iframe'
    ).forEach(function (node) { node.remove() })

    var style = document.createElement('style')
    style.textContent = [
      '#resume-tailor-floating-root { position: static; z-index: 2147483000; }',
      '.rt-launcher-single {',
      '  position: fixed; right: 0; top: 50%;',
      '  width: 64px; height: 74px; border: 0;',
      '  border-radius: 18px 0 0 18px; margin: 0;',
      '  transform: translate(84%, -50%);',
      '  transition: transform .16s ease, box-shadow .16s ease;',
      '  cursor: pointer; box-shadow: 0 10px 24px rgba(15,23,42,0.24);',
      '  display: flex; align-items: center; justify-content: center;',
      '  color: #fff; background: rgba(41,37,36,0.92);',
      '}',
      '.rt-launcher-single:hover { transform: translate(72%, -50%); box-shadow: 0 14px 32px rgba(15,23,42,0.28); }',
      '.rt-launcher-single img { width: 24px; height: 24px; border-radius: 6px; pointer-events: none; }',
      '.rt-launcher-single.hidden { opacity: 0; pointer-events: none; }',
      '#resume-tailor-panel {',
      '  position: fixed; top: 0; right: 0;',
      '  width: min(430px, 94vw); height: 100vh;',
      '  z-index: 2147483001; background: #f8fbff;',
      '  border-left: 1px solid #dbe6f3;',
      '  box-shadow: 0 22px 48px rgba(15,23,42,0.18);',
      '  overflow: hidden; opacity: 0; pointer-events: none;',
      '  transform: translateX(calc(100% + 24px));',
      '  transition: transform .2s ease, opacity .2s ease;',
      '}',
      '#resume-tailor-panel.open { opacity: 1; pointer-events: auto; transform: translateX(0); }',
      '.rt-panel-head {',
      '  height: 44px; display: flex; align-items: center;',
      '  justify-content: space-between; padding: 0 12px;',
      '  background: #0f172a; color: #e2e8f0;',
      '  border-bottom: 1px solid #1e293b;',
      '  font: 600 13px/1.2 "Segoe UI","SF Pro Text",-apple-system,sans-serif;',
      '}',
      '.rt-panel-close {',
      '  width: 26px; height: 26px; border: 0; border-radius: 999px;',
      '  background: #334155; color: #f8fafc; cursor: pointer;',
      '  font: 700 14px/1 "Segoe UI",sans-serif;',
      '}',
      '.rt-panel-close:hover { background: #475569; }',
      '.rt-panel-iframe { width: 100%; height: calc(100% - 44px); border: 0; background: #f1f5f9; }',
    ].join('\n')

    var root = document.createElement('div')
    root.id = 'resume-tailor-floating-root'
    root.appendChild(style)

    var launcher = document.createElement('button')
    launcher.className = 'rt-launcher-single'
    launcher.title = 'Open Resume Tailor Panel'
    launcher.type = 'button'
    var icon = document.createElement('img')
    icon.alt = 'Tailor'
    icon.src = iconUrl
    launcher.appendChild(icon)
    root.appendChild(launcher)

    var panel = document.createElement('aside')
    panel.id = 'resume-tailor-panel'
    panel.setAttribute('aria-hidden', 'true')

    var head = document.createElement('div')
    head.className = 'rt-panel-head'
    var headTitle = document.createElement('span')
    headTitle.textContent = 'Resume Tailor + AutoFill'
    var closeBtn = document.createElement('button')
    closeBtn.className = 'rt-panel-close'
    closeBtn.type = 'button'
    closeBtn.textContent = '×'
    head.appendChild(headTitle)
    head.appendChild(closeBtn)

    var iframe = document.createElement('iframe')
    iframe.className = 'rt-panel-iframe'
    iframe.loading = 'lazy'
    iframe.src = popupUrl

    panel.appendChild(head)
    panel.appendChild(iframe)
    root.appendChild(panel)

    var setPanelOpen = function (isOpen) {
      panel.classList.toggle('open', Boolean(isOpen))
      panel.setAttribute('aria-hidden', isOpen ? 'false' : 'true')
      launcher.classList.toggle('hidden', Boolean(isOpen))
    }

    launcher.addEventListener('click', function () { setPanelOpen(true) })
    closeBtn.addEventListener('click', function () { setPanelOpen(false) })

    document.documentElement.appendChild(root)
  }

  chrome.runtime.onMessage.addListener(function (msg, _sender, sendResponse) {
    var type = msg && msg.type

    if (type === 'EXTRACT_JD') {
      var meta = extractJobMeta()
      sendResponse({ jdText: extractJobDescription(), jobTitle: meta.jobTitle, companyName: meta.companyName })
      return
    }

    if (type === 'SCAN_FORM_QUESTIONS') {
      sendResponse({ questions: questionList() })
      return
    }

    if (type === 'FILL_FORM') {
      fillForm(msg.answers || {}, msg.resumeFile || null)
        .then(function (result) { sendResponse(result) })
        .catch(function (err) { sendResponse({ filledCount: 0, error: (err && err.message) || 'fill failed' }) })
      return true
    }

    if (type === 'EXTRACT_LINKEDIN_PROFILE') {
      if (!isLinkedInProfile()) {
        sendResponse({ error: 'Not a LinkedIn profile page' })
        return
      }
      sendResponse({ profile: extractLinkedInProfile() })
      return
    }
  })

  ensureFloatingLaunchers()
})()