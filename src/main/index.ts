import { app, BrowserWindow, Menu, dialog } from 'electron'
import type { MenuItemConstructorOptions } from 'electron'
import path from 'node:path'
import { initDB, closeDB } from '@main/services/database/connection'
import { registerHandlers, setProgressSender, setSyncProgressSender, setAnalysisWebContents } from '@main/ipc'
import { runMigrations } from '@main/services/database/migrator'
import { engineService } from '@main/services/stockfish/EngineService'
import { SyncService } from '@main/services/sync/SyncService'
import { settingsService } from '@main/services/settings'

let mainWindow: BrowserWindow | null = null
let timedSyncTimer: ReturnType<typeof setInterval> | null = null

function stopTimedSync(): void {
  if (timedSyncTimer) {
    clearInterval(timedSyncTimer)
    timedSyncTimer = null
  }
}

const menuTemplate: MenuItemConstructorOptions[] = [
  {
    label: 'Chess Desktop',
    submenu: [
      { label: 'Settings', accelerator: 'CmdOrCtrl+S', click: () => mainWindow?.webContents.send('menu.settings') },
      { type: 'separator' },
      { label: 'Quit', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() }
    ]
  },
  {
    label: 'File',
    submenu: [
      {
        label: 'Import PGN',
        accelerator: 'CmdOrCtrl+I',
        click: async () => {
          const result = await dialog.showOpenDialog(mainWindow!, {
            title: 'Import PGN',
            filters: [{ name: 'PGN', extensions: ['pgn', 'txt'] }],
            properties: ['openFile']
          })
          if (!result.canceled && result.filePaths.length > 0) {
            mainWindow?.webContents.send('menu.import-pgn')
          }
        }
      },
      {
        label: 'Export All PGN',
        accelerator: 'CmdOrCtrl+E',
        click: async () => {
          const result = await dialog.showSaveDialog(mainWindow!, {
            title: 'Export All Games',
            defaultPath: 'chess-games.pgn',
            filters: [{ name: 'PGN', extensions: ['pgn'] }]
          })
          if (!result.canceled && result.filePath) {
            mainWindow?.webContents.send('menu.export-pgn', result.filePath)
          }
        }
      },
      { type: 'separator' },
      {
        label: 'Backup Database',
        click: async () => {
          const result = await dialog.showSaveDialog(mainWindow!, {
            title: 'Backup Database',
            defaultPath: 'chess-backup.db',
            filters: [{ name: 'SQLite', extensions: ['db'] }]
          })
          if (!result.canceled && result.filePath) {
            mainWindow?.webContents.send('menu.backup-db')
          }
        }
      },
      {
        label: 'Restore Database',
        click: async () => {
          const result = await dialog.showOpenDialog(mainWindow!, {
            title: 'Restore Database',
            filters: [{ name: 'SQLite', extensions: ['db'] }],
            properties: ['openFile']
          })
          if (!result.canceled && result.filePaths.length > 0) {
            mainWindow?.webContents.send('menu.restore-db')
          }
        }
      }
    ]
  },
  {
    label: 'Navigate',
    submenu: [
      { label: 'Home', accelerator: 'CmdOrCtrl+H', click: () => mainWindow?.webContents.send('navigate.home') },
      { label: 'Games', accelerator: 'CmdOrCtrl+G', click: () => mainWindow?.webContents.send('navigate.games') },
      { label: 'Statistics', accelerator: 'CmdOrCtrl+A', click: () => mainWindow?.webContents.send('navigate.statistics') }
    ]
  },
  {
    label: 'View',
    submenu: [
      { role: 'zoomIn' },
      { role: 'zoomOut' },
      { role: 'resetZoom' }
    ]
  },
  {
    label: 'Help',
    submenu: [
      {
        label: 'Keyboard Shortcuts',
        click: () => {
          dialog.showMessageBox(mainWindow!, {
            title: 'Keyboard Shortcuts',
            message: 'Keyboard Shortcuts',
            detail: 'Ctrl/Cmd + G: Games\nCtrl/Cmd + S: Settings\nCtrl/Cmd + A: Statistics\nCtrl/Cmd + H: Home\nEsc: Go back / cancel'
          })
        }
      },
      {
        label: 'About',
        click: () => {
          dialog.showMessageBox(mainWindow!, {
            title: 'About Chess Desktop',
            message: 'Chess Desktop v1.0.1',
            detail: 'A desktop chess application built with Electron, React, and TypeScript.\n\nFeatures:\n- PGN import/export\n- Stockfish engine analysis\n- Game statistics\n- Database backup/restore\n\nStockfish is licensed under GPLv3.'
          })
        }
      }
    ]
  }
]

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  const rendererUrl = process.env.ELECTRON_RENDERER_URL ?? process.env.VITE_DEV_SERVER_URL
  if (rendererUrl) {
    mainWindow.loadURL(rendererUrl)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/renderer/index.html'))
  }

  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools({ mode: 'detach' })
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.control && input.shift && input.key.toLowerCase() === 'i') {
        event.preventDefault()
        mainWindow?.webContents.toggleDevTools()
      }
    })
  }

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('will-navigate', (event) => {
    event.preventDefault()
  })
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('Renderer failed to load', { errorCode, errorDescription, validatedURL })
  })
  if (!app.isPackaged) {
    mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
      console.log('Renderer console', { level, message, line, sourceId })
    })
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(async () => {
  await initDB()
  await runMigrations()
  registerHandlers()
  createWindow()

  const menu = Menu.buildFromTemplate(menuTemplate)
  Menu.setApplicationMenu(menu)

  setProgressSender((progress) => {
    if (mainWindow) mainWindow.webContents.send('pgn:import:progress', progress)
  })

  setSyncProgressSender((progress) => {
    if (mainWindow) mainWindow.webContents.send('sync:progress', progress)
  })

  setAnalysisWebContents(mainWindow!.webContents)

  // Timed/auto sync: runs periodically when autoSync is enabled and a username is set
  const SYNC_INTERVAL_MS = 30 * 60 * 1000 // 30 minutes
  let isSyncing = false

  async function runTimedSync(): Promise<void> {
    if (isSyncing) return
    const settings = await settingsService.get()
    if (!settings.autoSync || !settings.chessComUsername) return
    isSyncing = true
    try {
      const sync = new SyncService((progress) => {
        if (mainWindow) mainWindow.webContents.send('sync:progress', { ...progress, username: settings.chessComUsername })
      })
      await sync.sync(settings.chessComUsername)
    } catch {
      // timed sync failures are non-fatal; log and continue
    } finally {
      isSyncing = false
    }
  }

  function startTimedSync(): void {
    if (timedSyncTimer) clearInterval(timedSyncTimer)
    timedSyncTimer = setInterval(runTimedSync, SYNC_INTERVAL_MS)
    // Run once shortly after startup
    setTimeout(runTimedSync, 5000)
  }

  startTimedSync()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', async () => {
  await closeDB()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', async () => {
  stopTimedSync()
  await closeDB()
  await engineService.quit()
})
