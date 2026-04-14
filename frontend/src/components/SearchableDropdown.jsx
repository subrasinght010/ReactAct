import { useEffect, useRef, useState } from 'react'

export function SingleSelectDropdown({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  clearLabel = 'Please select',
}) {
  const wrapRef = useRef(null)
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const found = (options || []).find((opt) => String(opt.value) === String(value || ''))
    setText(found ? String(found.label || '') : '')
    setSearchQuery('')
  }, [options, value])

  useEffect(() => {
    const onDocMouseDown = (event) => {
      if (!wrapRef.current) return
      if (!wrapRef.current.contains(event.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [])

  const filtered = (options || []).filter((opt) => {
    const label = String(opt.label || '').toLowerCase()
    const query = String(searchQuery || '').toLowerCase().trim()
    return !query || label.includes(query)
  })

  return (
    <div ref={wrapRef} className={`search-dd ${disabled ? 'is-disabled' : ''}`}>
      <div className="search-dd-input-wrap">
        <input
          className="search-dd-input"
          value={text}
          disabled={disabled}
          placeholder={placeholder}
          onFocus={() => {
            if (!disabled) {
              setOpen(true)
              setSearchQuery('')
            }
          }}
          onChange={(event) => {
            const nextText = event.target.value
            setText(nextText)
            setSearchQuery(nextText)
            setOpen(true)
          }}
        />
        <button
          type="button"
          className="search-dd-toggle"
          disabled={disabled}
          onClick={() => setOpen((prev) => !prev)}
          aria-label="Toggle options"
        >
          {open ? '▴' : '▾'}
        </button>
      </div>
      {open && !disabled ? (
        <div className="search-dd-menu" role="listbox">
          <button
            type="button"
            className={`search-dd-item ${String(value || '') ? '' : 'is-active'}`}
            onClick={() => {
              setText('')
              setSearchQuery('')
              setOpen(false)
              onChange('')
            }}
          >
            {clearLabel}
          </button>
          {filtered.length ? (
            filtered.map((opt) => (
              <button
                key={String(opt.value)}
                type="button"
                className={`search-dd-item ${String(value || '') === String(opt.value) ? 'is-active' : ''}`}
                onClick={() => {
                  setText(String(opt.label || ''))
                  setSearchQuery('')
                  setOpen(false)
                  onChange(String(opt.value))
                }}
              >
                {String(opt.label || '')}
              </button>
            ))
          ) : (
            <div className="search-dd-empty">No results</div>
          )}
        </div>
      ) : null}
    </div>
  )
}

export function MultiSelectDropdown({
  values,
  onChange,
  options,
  placeholder,
  disabled = false,
  searchPlaceholder = 'Search',
}) {
  const wrapRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const safeValues = Array.isArray(values) ? values.map((v) => String(v)) : []
  const selectedSet = new Set(safeValues)
  const selectedLabels = (options || [])
    .filter((opt) => selectedSet.has(String(opt.value)))
    .map((opt) => String(opt.label || ''))
    .filter(Boolean)

  useEffect(() => {
    const onDocMouseDown = (event) => {
      if (!wrapRef.current) return
      if (!wrapRef.current.contains(event.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [])

  const filtered = (options || []).filter((opt) => {
    const label = String(opt.label || '').toLowerCase()
    const text = String(query || '').trim().toLowerCase()
    return !text || label.includes(text)
  })

  const summary = selectedLabels.length
    ? `${selectedLabels.slice(0, 2).join(', ')}${selectedLabels.length > 2 ? ` +${selectedLabels.length - 2}` : ''}`
    : ''

  return (
    <div ref={wrapRef} className={`search-dd ${disabled ? 'is-disabled' : ''}`}>
      <button
        type="button"
        className="search-dd-multi-trigger"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className={summary ? '' : 'search-dd-placeholder'}>{summary || placeholder}</span>
        <span>{open ? '▴' : '▾'}</span>
      </button>
      {open && !disabled ? (
        <div className="search-dd-menu">
          <input
            className="search-dd-input"
            value={query}
            placeholder={searchPlaceholder}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="search-dd-multi-list">
            {filtered.length ? (
              filtered.map((opt) => {
                const id = String(opt.value)
                const checked = selectedSet.has(id)
                return (
                  <label key={id} className="search-dd-multi-item">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => {
                        const next = new Set(safeValues)
                        if (event.target.checked) next.add(id)
                        else next.delete(id)
                        onChange(Array.from(next))
                      }}
                    />
                    <span>{String(opt.label || '')}</span>
                  </label>
                )
              })
            ) : (
              <div className="search-dd-empty">No results</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

