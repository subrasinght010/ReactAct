import { buildResumeViewModel } from './resumeShared'

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function plainTextFromHtml(value) {
  return String(value || '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function sanitizeInlineHtml(value) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(`<div>${String(value || '')}</div>`, 'text/html')
  const root = doc.body.firstElementChild
  if (!root) return ''

  const allowed = new Set(['MARK', 'STRONG', 'EM', 'B', 'I', 'U', 'A', 'BR', 'SPAN'])
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT)
  const nodes = []
  let node = walker.nextNode()
  while (node) {
    nodes.push(node)
    node = walker.nextNode()
  }

  nodes.forEach((el) => {
    if (!allowed.has(el.tagName)) {
      const parent = el.parentNode
      while (el.firstChild) parent?.insertBefore(el.firstChild, el)
      parent?.removeChild(el)
      return
    }
    // Keep links safe and minimal.
    if (el.tagName === 'A') {
      const href = String(el.getAttribute('href') || '').trim()
      const safe = /^https?:\/\//i.test(href) ? href : ''
      el.setAttribute('href', safe)
      el.removeAttribute('target')
      el.removeAttribute('rel')
    }
    // Drop style/event attrs to avoid broken markup.
    Array.from(el.attributes || []).forEach((attr) => {
      const name = String(attr.name || '').toLowerCase()
      if (name === 'href') return
      el.removeAttribute(attr.name)
    })
  })

  return root.innerHTML
}

function htmlToBulletList(htmlValue, options = {}) {
  const preserveInline = Boolean(options.preserveInline)
  const raw = String(htmlValue || '')
  if (!raw.trim()) return ''

  const parser = new DOMParser()
  const doc = parser.parseFromString(raw, 'text/html')
  const listItems = Array.from(doc.querySelectorAll('li')).map((li) => {
    if (preserveInline) {
      const html = sanitizeInlineHtml(li.innerHTML)
      const text = String(li.textContent || '').replace(/\s+/g, ' ').trim()
      return text ? { text, html } : null
    }
    const text = String(li.textContent || '').replace(/\s+/g, ' ').trim()
    return text ? { text, html: '' } : null
  }).filter(Boolean)

  if (listItems.length) {
    return `<ul>${listItems.map((item) => `<li>${preserveInline ? item.html : escapeHtml(item.text)}</li>`).join('')}</ul>`
  }

  const text = plainTextFromHtml(raw)
  if (!text) return ''
  return `<p>${escapeHtml(text)}</p>`
}

function renderExperienceItem(exp) {
  const title = escapeHtml([exp.company, exp.title].filter(Boolean).join(' - '))
  const dates = escapeHtml([exp.startDate, exp.isCurrent ? 'Present' : exp.endDate].filter(Boolean).join(' - '))
  const bullets = htmlToBulletList(exp.highlights)

  return `
    <div class="entry">
      <div class="entry-head">
        <span>${title}</span>
        <span class="entry-dates">${dates}</span>
      </div>
      ${bullets}
    </div>
  `
}

function renderProjectItem(project) {
  const name = escapeHtml(project.name || '')
  const link = project.normalizedUrl
    ? `<a class="entry-link project-link" href="${escapeHtml(project.normalizedUrl)}">link</a>`
    : ''
  const bullets = htmlToBulletList(project.highlights)

  return `
    <div class="entry">
      <div class="entry-head">
        <span>${name}${link}</span>
      </div>
      ${bullets}
    </div>
  `
}

function renderEducationItem(edu) {
  const dateLine = [edu.startDate, edu.isCurrent ? 'Present' : edu.endDate].filter(Boolean).join(' - ')

  return `
    <div class="entry">
      <div class="entry-head entry-head--edu">
        <div class="entry-head-main">
          ${edu.institution ? `<div class="edu-inst">${escapeHtml(edu.institution)}</div>` : ''}
          ${edu.program || edu.scoreText
            ? `<div class="edu-meta">${edu.program ? `<span>${escapeHtml(edu.program)}</span>` : ''}${
                edu.program && edu.scoreText ? '<span class="edu-sep"> | </span>' : ''
              }${edu.scoreText ? `<span>${escapeHtml(edu.scoreText)}</span>` : ''}</div>`
            : ''}
        </div>
        ${dateLine ? `<span class="entry-dates">${escapeHtml(dateLine)}</span>` : ''}
      </div>
    </div>
  `
}

function renderCustomSection(section, sectionClass) {
  const title = escapeHtml(section.title || 'Custom section')
  const content = htmlToBulletList(section.content) || `<p>${escapeHtml(plainTextFromHtml(section.content))}</p>`
  return `
    <section class="${sectionClass}">
      <h2>${title}</h2>
      <div class="section-body">${content}</div>
    </section>
  `
}

function renderExperienceItemPreserveInline(exp) {
  const title = escapeHtml([exp.company, exp.title].filter(Boolean).join(' - '))
  const dates = escapeHtml([exp.startDate, exp.isCurrent ? 'Present' : exp.endDate].filter(Boolean).join(' - '))
  const bullets = htmlToBulletList(exp.highlights, { preserveInline: true })

  return `
    <div class="entry">
      <div class="entry-head">
        <span>${title}</span>
        <span class="entry-dates">${dates}</span>
      </div>
      ${bullets}
    </div>
  `
}

function renderProjectItemPreserveInline(project) {
  const name = escapeHtml(project.name || '')
  const link = project.normalizedUrl
    ? `<a class="entry-link project-link" href="${escapeHtml(project.normalizedUrl)}">link</a>`
    : ''
  const bullets = htmlToBulletList(project.highlights, { preserveInline: true })

  return `
    <div class="entry">
      <div class="entry-head">
        <span>${name}${link}</span>
      </div>
      ${bullets}
    </div>
  `
}

export function buildAtsPdfHtml(form) {
  const model = buildResumeViewModel(form, { forceEducationScoreWhenValue: true })
  const sectionClass = model.sectionUnderline ? 'section has-underline' : 'section'
  const bodyClass = 'compact'
  const headerClass = model.sectionUnderline ? 'header' : 'header has-underline'
  const linksHtml = model.links
    .map((item) => `<a href="${escapeHtml(item.url)}">${escapeHtml(item.label)}</a>`)
    .join(' | ')

  const getCustomByKey = (key) => {
    if (!key.startsWith(model.customKeyPrefix)) return null
    const id = key.slice(model.customKeyPrefix.length)
    return model.customSections.find((section) => section.id === id) || null
  }

  const sections = []
  model.orderedKeys.forEach((key) => {
    if (key === 'summary') {
      if (!model.summaryEnabled || !model.summaryHtml.trim()) return
      sections.push(`
        <section class="${sectionClass}">
          <h2>${escapeHtml(model.summaryHeading || 'Summary')}</h2>
          <div class="section-body">${model.summaryHtml}</div>
        </section>
      `)
      return
    }

    if (key === 'skills') {
      if (!model.skillsHtml.trim()) return
      sections.push(`
        <section class="${sectionClass}">
          <h2>Skills</h2>
          <div class="section-body">${model.skillsHtml}</div>
        </section>
      `)
      return
    }

    if (key === 'experience') {
      if (!model.experiences.length) return
      sections.push(`
        <section class="${sectionClass}">
          <h2>Experience</h2>
          ${model.experiences.map((exp) => renderExperienceItem(exp)).join('')}
        </section>
      `)
      return
    }

    if (key === 'projects') {
      if (!model.projects.length) return
      sections.push(`
        <section class="${sectionClass}">
          <h2>Projects</h2>
          ${model.projects.map((project) => renderProjectItem(project)).join('')}
        </section>
      `)
      return
    }

    if (key === 'education') {
      if (!model.educations.length) return
      sections.push(`
        <section class="${sectionClass}">
          <h2>Education</h2>
          ${model.educations.map((edu) => renderEducationItem(edu)).join('')}
        </section>
      `)
      return
    }

    if (key.startsWith(model.customKeyPrefix)) {
      const custom = getCustomByKey(key)
      if (!custom) return
      sections.push(renderCustomSection(custom, sectionClass))
    }
  })

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(model.fullName || 'Resume')}</title>
  <style>
    @page {
      size: A4;
      margin: ${model.pageMarginIn}in;
    }

    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #111827;
      font-family: Arial, Helvetica, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    body {
      padding: ${model.topPagePaddingIn}in ${model.pageMarginIn}in ${model.pageMarginIn}in;
      font-size: 10pt;
      line-height: 1.35;
    }

    body.compact {
      font-size: 9.5pt;
      line-height: 1.25;
    }

    h1 {
      margin: 0;
      font-size: 20pt;
      font-weight: 700;
      text-align: center;
      letter-spacing: 0.02em;
    }

    .contact {
      margin-top: 1pt;
      text-align: center;
      font-size: 9.5pt;
    }

    .contact a {
      color: inherit;
      text-decoration: none;
    }

    .header {
      margin-bottom: 4pt;
      padding-bottom: 2pt;
      text-align: center;
    }

    .header.has-underline {
      border-bottom: 1px solid #d1d5db;
    }

    .section {
      margin-top: 8pt;
      margin-bottom: 3pt;
    }

    body.compact .section {
      margin-top: 4pt;
      margin-bottom: 2pt;
    }

    .section h2 {
      margin: 0 0 2pt;
      font-size: 11pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .section.has-underline h2 {
      border-bottom: 1px solid #d1d5db;
      padding-bottom: 1pt;
    }

    body.compact .section h2 {
      margin: 0 0 1pt;
    }

    .section p {
      margin: 2pt 0 0;
      font-size: 9.5pt;
      line-height: 1.35;
    }

    body.compact .section p {
      margin: 1pt 0 0;
      line-height: 1.25;
    }

    .entry {
      margin-top: 4pt;
    }

    body.compact .entry {
      margin-top: 2pt;
    }

    .entry-head {
      display: flex;
      justify-content: space-between;
      gap: 12pt;
      align-items: baseline;
      font-size: 9.75pt;
      font-weight: 700;
    }

    .entry-head--edu {
      align-items: flex-start;
    }

    .entry-head-main {
      min-width: 0;
    }

    .entry-dates,
    .entry-link {
      font-weight: 400;
      font-size: 9pt;
      color: #374151;
      text-decoration: none;
      white-space: nowrap;
    }

    .edu-inst {
      font-weight: 700;
      color: #111827;
    }

    .edu-meta {
      margin-top: 1pt;
      font-size: 9.5pt;
      font-weight: 400;
      color: #111827;
    }

    .edu-sep {
      color: #4b5563;
    }

    .project-link {
      margin-left: 3pt;
      display: inline-block;
      text-decoration: none;
    }

    ul {
      margin: 4pt 0 0;
      padding-left: 16pt;
    }

    body.compact ul {
      margin-top: 2pt;
    }

    li {
      margin: 1.5pt 0;
      font-size: 9.5pt;
      line-height: 1.3;
    }

    body.compact li {
      margin: 1pt 0;
      line-height: 1.2;
    }

    .plain-links {
      margin-top: 2pt;
      text-align: center;
      font-size: 9pt;
      word-break: break-word;
    }

    .plain-links a {
      color: inherit;
      text-decoration: none;
    }

    * {
      box-shadow: none !important;
      text-shadow: none !important;
      filter: none !important;
    }
  </style>
</head>
<body class="${bodyClass}">
  <header class="${headerClass}">
    <h1>${escapeHtml(model.fullName || '')}</h1>
    <div class="contact">${escapeHtml(model.contactLine)}</div>
    ${linksHtml ? `<div class="plain-links">${linksHtml}</div>` : ''}
  </header>
  ${sections.join('')}
</body>
</html>`
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildHighlightRegex(words) {
  const normalized = Array.from(
    new Set(
      (Array.isArray(words) ? words : [])
        .map((w) => String(w || '').trim())
        .filter(Boolean),
    ),
  )
    .sort((a, b) => b.length - a.length)
    .slice(0, 120)

  if (!normalized.length) return null
  const pattern = normalized.map((w) => escapeRegex(w)).join('|')
  return new RegExp(`\\b(${pattern})\\b`, 'gi')
}

function applyKeywordHighlightsToHtml(baseHtml, words) {
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') return baseHtml
  const regex = buildHighlightRegex(words)
  if (!regex) return baseHtml

  const parser = new DOMParser()
  const doc = parser.parseFromString(String(baseHtml || ''), 'text/html')
  const skipTags = new Set(['SCRIPT', 'STYLE', 'MARK', 'A'])
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
  const nodes = []
  let current = walker.nextNode()
  while (current) {
    nodes.push(current)
    current = walker.nextNode()
  }

  nodes.forEach((node) => {
    const parentTag = node.parentElement?.tagName || ''
    if (!node.nodeValue || skipTags.has(parentTag)) return
    const source = String(node.nodeValue || '')
    regex.lastIndex = 0
    if (!regex.test(source)) return

    regex.lastIndex = 0
    const frag = doc.createDocumentFragment()
    let last = 0
    let match = regex.exec(source)
    while (match) {
      const start = match.index
      const end = start + String(match[0]).length
      if (start > last) {
        frag.appendChild(doc.createTextNode(source.slice(last, start)))
      }
      const mark = doc.createElement('mark')
      mark.className = 'kw-highlight'
      mark.textContent = source.slice(start, end)
      frag.appendChild(mark)
      last = end
      match = regex.exec(source)
    }
    if (last < source.length) {
      frag.appendChild(doc.createTextNode(source.slice(last)))
    }
    node.parentNode?.replaceChild(frag, node)
  })

  const style = doc.createElement('style')
  style.textContent = `
    .kw-highlight {
      background: #fff3a3 !important;
      color: #111827 !important;
      padding: 0 1px;
      border-radius: 2px;
    }
  `
  doc.head.appendChild(style)
  return `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`
}

export function buildAtsPdfHtmlPreserveHighlights(form) {
  const model = buildResumeViewModel(form, { forceEducationScoreWhenValue: true })
  const sectionClass = model.sectionUnderline ? 'section has-underline' : 'section'
  const bodyClass = 'compact'
  const headerClass = model.sectionUnderline ? 'header' : 'header has-underline'
  const linksHtml = model.links
    .map((item) => `<a href="${escapeHtml(item.url)}">${escapeHtml(item.label)}</a>`)
    .join(' | ')

  const getCustomByKey = (key) => {
    if (!key.startsWith(model.customKeyPrefix)) return null
    const id = key.slice(model.customKeyPrefix.length)
    return model.customSections.find((section) => section.id === id) || null
  }

  const sections = []
  model.orderedKeys.forEach((key) => {
    if (key === 'summary') {
      if (!model.summaryEnabled || !model.summaryHtml.trim()) return
      sections.push(`
        <section class="${sectionClass}">
          <h2>${escapeHtml(model.summaryHeading || 'Summary')}</h2>
          <div class="section-body">${model.summaryHtml}</div>
        </section>
      `)
      return
    }
    if (key === 'skills') {
      if (!model.skillsHtml.trim()) return
      sections.push(`
        <section class="${sectionClass}">
          <h2>Skills</h2>
          <div class="section-body">${model.skillsHtml}</div>
        </section>
      `)
      return
    }
    if (key === 'experience') {
      if (!model.experiences.length) return
      sections.push(`
        <section class="${sectionClass}">
          <h2>Experience</h2>
          ${model.experiences.map((exp) => renderExperienceItemPreserveInline(exp)).join('')}
        </section>
      `)
      return
    }
    if (key === 'projects') {
      if (!model.projects.length) return
      sections.push(`
        <section class="${sectionClass}">
          <h2>Projects</h2>
          ${model.projects.map((project) => renderProjectItemPreserveInline(project)).join('')}
        </section>
      `)
      return
    }
    if (key === 'education') {
      if (!model.educations.length) return
      sections.push(`
        <section class="${sectionClass}">
          <h2>Education</h2>
          ${model.educations.map((edu) => renderEducationItem(edu)).join('')}
        </section>
      `)
      return
    }
    if (key.startsWith(model.customKeyPrefix)) {
      const custom = getCustomByKey(key)
      if (!custom) return
      const title = escapeHtml(custom.title || 'Custom section')
      const content = htmlToBulletList(custom.content, { preserveInline: true }) || `<p>${escapeHtml(plainTextFromHtml(custom.content))}</p>`
      sections.push(`
        <section class="${sectionClass}">
          <h2>${title}</h2>
          <div class="section-body">${content}</div>
        </section>
      `)
    }
  })

  const html = buildAtsPdfHtml(form)
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const body = doc.body
  if (body) {
    body.innerHTML = `
      <header class="${headerClass}">
        <h1>${escapeHtml(model.fullName || '')}</h1>
        <div class="contact">${escapeHtml(model.contactLine)}</div>
        ${linksHtml ? `<div class="plain-links">${linksHtml}</div>` : ''}
      </header>
      ${sections.join('')}
    `
  }
  const style = doc.createElement('style')
  style.textContent = `
    mark, .kw-highlight {
      background: #fff3a3 !important;
      color: #111827 !important;
      padding: 0 1px;
      border-radius: 2px;
    }
  `
  doc.head.appendChild(style)
  return `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`
}

export function buildAtsPdfHtmlWithHighlights(form, highlightWords = []) {
  const baseHtml = buildAtsPdfHtml(form)
  return applyKeywordHighlightsToHtml(baseHtml, highlightWords)
}

export function printAtsPdf(form) {
  const html = buildAtsPdfHtml(form)
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  iframe.style.visibility = 'hidden'

  let printed = false
  let cleanupTimer = null
  let pollTimer = null

  const cleanup = () => {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
    if (cleanupTimer) {
      clearTimeout(cleanupTimer)
      cleanupTimer = null
    }
    cleanupTimer = setTimeout(() => {
      iframe.remove()
    }, 1000)
  }

  const triggerPrint = () => {
    if (printed) return
    const win = iframe.contentWindow
    const doc = iframe.contentDocument
    const bodyHtml = String(doc?.body?.innerHTML || '').trim()
    if (!win || !bodyHtml) return

    printed = true
    const finish = () => cleanup()
    win.onafterprint = finish
    win.focus()
    try {
      win.print()
    } catch {
      finish()
    }
  }

  document.body.appendChild(iframe)
  iframe.srcdoc = html

  pollTimer = setInterval(() => {
    triggerPrint()
    if (printed && pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }, 80)
}
