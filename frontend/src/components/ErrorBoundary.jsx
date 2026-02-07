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
        <div className="page">
          <h1>Page crashed</h1>
          <p className="subtitle">Open DevTools console for full details.</p>
          <pre className="error-box">{String(this.state.error?.stack || this.state.error)}</pre>
        </div>
      )
    }
    return this.props.children
  }
}

export default ErrorBoundary

