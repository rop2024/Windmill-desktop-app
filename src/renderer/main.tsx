import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { ThemeProvider } from './context/ThemeContext'
import { BoardThemeProvider } from './context/BoardThemeContext'
import { DebugProvider } from './context/DebugContext'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider initialTheme="system">
      <BoardThemeProvider>
        <DebugProvider>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </DebugProvider>
      </BoardThemeProvider>
    </ThemeProvider>
  </React.StrictMode>
)
