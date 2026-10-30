import { Component, ErrorInfo, ReactNode } from 'react'

type Props = {
  children: ReactNode
  fallback?: (error: Error, reset: () => void) => ReactNode
}

type State = {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Log error in production
    console.error('ErrorBoundary caught:', _error, _info)
  }

  reset = () => {
    this.setState({ hasError: false, error: null })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error!, this.reset)
      }
      return (
        <div className="flex flex-col items-center justify-center p-6 text-center">
          <h2 className="text-lg font-bold text-gray-900 mb-2">Something went wrong</h2>
          <p className="text-sm text-gray-600 mb-4">{this.state.error?.message}</p>
          <button
            onClick={this.reset}
            className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded"
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
