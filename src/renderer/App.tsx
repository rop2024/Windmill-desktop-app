import { HashRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import AppLayout from '@renderer/components/AppLayout'
import Dashboard from '@renderer/pages/Dashboard'
import Games from '@renderer/pages/Games'
import GameNew from '@renderer/pages/GameNew'
import GameDetail from '@renderer/pages/GameDetail'
import Settings from '@renderer/pages/Settings'
import Sync from '@renderer/pages/Sync'
import Engine from '@renderer/pages/Engine'
import GameExplorer from '@renderer/pages/GameExplorer'
import Analysis from '@renderer/pages/Analysis'
import Statistics from '@renderer/pages/Statistics'
import OpeningExplorer from '@renderer/pages/OpeningExplorer'
import TacticalDetector from '@renderer/pages/TacticalDetector'
import WeaknessEngine from '@renderer/pages/WeaknessEngine'
import ReportGenerator from '@renderer/pages/ReportGenerator'
import Coach from '@renderer/pages/Coach'
import BoardOfFame from '@renderer/pages/BoardOfFame'
import BoardOfShame from '@renderer/pages/BoardOfShame'
import TrainingPlanner from '@renderer/pages/TrainingPlanner'
import Achievements from '@renderer/pages/Achievements'
import Timeline from '@renderer/pages/Timeline'
import Search from '@renderer/pages/Search'
import RepertoireBuilder from '@renderer/pages/RepertoireBuilder'
import KnowledgeGraph from '@renderer/pages/KnowledgeGraph'
import PuzzleTrainer from '@renderer/pages/PuzzleTrainer'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'

function KeyboardShortcuts() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  useKeyboardShortcuts([
    {
      key: 'g',
      ctrlOrMeta: true,
      description: 'Go to games',
      handler: () => navigate('/games')
    },
    {
      key: 's',
      ctrlOrMeta: true,
      description: 'Go to settings',
      handler: () => navigate('/settings')
    },
    {
      key: 'a',
      ctrlOrMeta: true,
      description: 'Go to statistics',
      handler: () => navigate('/statistics')
    },
    {
      key: 'Escape',
      description: 'Go back / cancel',
      handler: () => {
        if (pathname === '/games/new' || pathname === '/settings') {
          navigate('/games')
        } else if (pathname.startsWith('/explorer/')) {
          navigate('/games')
        }
      }
    },
    {
      key: 'h',
      ctrlOrMeta: true,
      description: 'Go home',
      handler: () => navigate('/')
    }
  ])

  return null
}

export default function App() {
  return (
    <Router>
      <KeyboardShortcuts />
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="games" element={<Games />} />
          <Route path="games/new" element={<GameNew />} />
          <Route path="games/:id" element={<GameDetail />} />
          <Route path="settings" element={<Settings />} />
          <Route path="sync" element={<Sync />} />
          <Route path="engine" element={<Engine />} />
          <Route path="statistics" element={<Statistics />} />
          <Route path="openings" element={<OpeningExplorer />} />
          <Route path="openings/:opening" element={<OpeningExplorer />} />
          <Route path="tactics" element={<TacticalDetector />} />
          <Route path="weaknesses" element={<WeaknessEngine />} />
          <Route path="trainer" element={<PuzzleTrainer />} />
          <Route path="reports" element={<ReportGenerator />} />
          <Route path="coach" element={<Coach />} />
          <Route path="fame" element={<BoardOfFame />} />
          <Route path="shame" element={<BoardOfShame />} />
          <Route path="training" element={<TrainingPlanner />} />
          <Route path="achievements" element={<Achievements />} />
          <Route path="timeline" element={<Timeline />} />
          <Route path="search" element={<Search />} />
          <Route path="repertoire" element={<RepertoireBuilder />} />
          <Route path="graph" element={<KnowledgeGraph />} />
          <Route path="explorer/:gameId" element={<GameExplorer />} />
          <Route path="analysis/:gameId" element={<Analysis />} />
        </Route>
      </Routes>
    </Router>
  )
}
