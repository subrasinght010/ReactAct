import React from 'react'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="w-full rounded-3xl border border-slate-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
          <h1>Page crashed</h1>
          <p className="mb-5 text-sm text-slate-500 dark:text-slate-400">Open DevTools console for full details.</p>
          <pre className="overflow-auto rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100 whitespace-pre-wrap">
            {String(this.state.error?.stack || this.state.error)}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}

export default ErrorBoundary
