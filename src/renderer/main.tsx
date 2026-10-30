import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { ThemeProvider } from './context/ThemeContext'
import { BoardThemeProvider } from './context/BoardThemeContext'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider initialTheme="system">
      <BoardThemeProvider>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </BoardThemeProvider>
    </ThemeProvider>
  </React.StrictMode>
)
