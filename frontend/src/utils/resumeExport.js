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

function htmlToBulletList(htmlValue) {
  const raw = String(htmlValue || '')
  if (!raw.trim()) return ''

  const parser = new DOMParser()
  const doc = parser.parseFromString(raw, 'text/html')
  const listItems = Array.from(doc.querySelectorAll('li'))
    .map((li) => String(li.textContent || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  if (listItems.length) {
    return `<ul>${listItems.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>`
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
      text-transform: uppercase;
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
    }

    body.compact .section {
      margin-top: 4pt;
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
