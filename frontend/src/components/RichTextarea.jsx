import { useEffect, useMemo, useRef, useState } from 'react'

const ALLOWED_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'P', 'BR', 'UL', 'OL', 'LI'])

function IconListBulleted(props) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" {...props}>
      <circle cx="5" cy="6" r="1.5" fill="currentColor" />
      <circle cx="5" cy="12" r="1.5" fill="currentColor" />
      <circle cx="5" cy="18" r="1.5" fill="currentColor" />
      <rect x="9" y="5" width="12" height="2" rx="1" fill="currentColor" />
      <rect x="9" y="11" width="12" height="2" rx="1" fill="currentColor" />
      <rect x="9" y="17" width="12" height="2" rx="1" fill="currentColor" />
    </svg>
  )
}

function IconListNumbered(props) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" {...props}>
      <text x="3" y="7.5" fontSize="6" fontFamily="ui-monospace, Menlo, monospace" fill="currentColor">
        1
      </text>
      <text x="3" y="13.5" fontSize="6" fontFamily="ui-monospace, Menlo, monospace" fill="currentColor">
        2
      </text>
      <text x="3" y="19.5" fontSize="6" fontFamily="ui-monospace, Menlo, monospace" fill="currentColor">
        3
      </text>
      <rect x="9" y="5" width="12" height="2" rx="1" fill="currentColor" />
      <rect x="9" y="11" width="12" height="2" rx="1" fill="currentColor" />
      <rect x="9" y="17" width="12" height="2" rx="1" fill="currentColor" />
    </svg>
  )
}

function sanitizeHtml(inputHtml) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(String(inputHtml || ''), 'text/html')

  const sanitizeNode = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      return document.createTextNode(node.nodeValue || '')
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return document.createTextNode('')
    }

    const tag = node.tagName

    // Map some tags into allowed equivalents.
    if (tag === 'DIV') {
      const p = document.createElement('p')
      node.childNodes.forEach((child) => p.appendChild(sanitizeNode(child)))
      return p
    }

    // Unwrap spans/unknown tags (keep children).
    if (!ALLOWED_TAGS.has(tag)) {
      const frag = document.createDocumentFragment()
      node.childNodes.forEach((child) => frag.appendChild(sanitizeNode(child)))
      return frag
    }

    const el = document.createElement(tag.toLowerCase())
    node.childNodes.forEach((child) => el.appendChild(sanitizeNode(child)))
    return el
  }

  const container = document.createElement('div')
  doc.body.childNodes.forEach((child) => container.appendChild(sanitizeNode(child)))

  // If content ends up empty, keep it truly empty (helps placeholder).
  const text = (container.textContent || '').trim()
  if (!text) return ''

  return container.innerHTML
}

function RichTextarea({ id, label, value, onChange, placeholder }) {
  const ref = useRef(null)
  const lastExternalValue = useRef(value)
  const [isEmpty, setIsEmpty] = useState(!(value || '').trim())

  const sanitizedValue = useMemo(() => sanitizeHtml(value), [value])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Initial mount should paint the value into the editor.
    // Avoid clobbering while the user is actively typing.
    if (document.activeElement !== el) {
      if (el.innerHTML !== sanitizedValue) el.innerHTML = sanitizedValue
    }
    setIsEmpty(!(el.textContent || '').trim())
    lastExternalValue.current = sanitizedValue
  }, [sanitizedValue, value])

  const exec = (command) => {
    const el = ref.current
    if (!el) return
    el.focus()
    document.execCommand(command)
    const next = sanitizeHtml(el.innerHTML)
    el.innerHTML = next
    setIsEmpty(!(el.textContent || '').trim())
    lastExternalValue.current = next
    onChange(next)
  }

  const handleInput = () => {
    const el = ref.current
    if (!el) return
    const next = sanitizeHtml(el.innerHTML)
    if (next !== el.innerHTML) el.innerHTML = next
    setIsEmpty(!(el.textContent || '').trim())
    lastExternalValue.current = next
    onChange(next)
  }

  return (
    <div className="rich-field">
      {label && <label htmlFor={id}>{label}</label>}
      <div className="rich-toolbar" role="toolbar" aria-label={`${label || 'Text'} formatting`}>
        <button type="button" className="toolbar-btn" onClick={() => exec('bold')} title="Bold">
          <span className="toolbar-letter" aria-hidden="true">
            B
          </span>
        </button>
        <button type="button" className="toolbar-btn" onClick={() => exec('italic')} title="Italic">
          <span className="toolbar-letter" aria-hidden="true">
            I
          </span>
        </button>
        <button type="button" className="toolbar-btn" onClick={() => exec('underline')} title="Underline">
          <span className="toolbar-letter" aria-hidden="true">
            U
          </span>
        </button>
        <span className="toolbar-sep" aria-hidden="true" />
        <button
          type="button"
          className="toolbar-btn"
          onClick={() => exec('insertUnorderedList')}
          title="Bulleted list"
        >
          <IconListBulleted className="toolbar-icon" />
        </button>
        <button
          type="button"
          className="toolbar-btn"
          onClick={() => exec('insertOrderedList')}
          title="Numbered list"
        >
          <IconListNumbered className="toolbar-icon" />
        </button>
      </div>
      <div
        id={id}
        ref={ref}
        className="rich-editor"
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder || ''}
        data-empty={isEmpty ? 'true' : 'false'}
        onInput={handleInput}
        onBlur={handleInput}
      />
    </div>
  )
}

export default RichTextarea
