import { dialog } from 'electron'
import { writeFile } from 'node:fs/promises'
import { statisticsService } from '../statistics/StatisticsService'
import { weaknessEngine } from '../analysis/WeaknessEngine'
import { tacticalDetector } from '../analysis/TacticalDetector'
import { logger } from '../logger'
import type { GameFilters, GameOutcome } from '@shared/game'

export type ReportType = 'weekly' | 'monthly' | 'opening' | 'tournament'
export type ReportFormat = 'html' | 'markdown'

export type ReportPayload = {
  path: string
  type: ReportType
  format: ReportFormat
  gamesAnalyzed: number
}

function dateRange(days: number): { from: number; to: number } {
  const to = Date.now()
  const from = to - days * 86400000
  return { from, to }
}

function fmtDate(ms: number | null): string {
  if (!ms) return '—'
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtNumber(n: number): string {
  return n.toLocaleString()
}

function pct(n: number): string {
  return n.toFixed(1) + '%'
}

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

class ReportGenerator {
  private filterGamesByRange<T extends { playedAt: number | null; outcome?: GameOutcome | null }>(
    games: T[],
    from: number,
    to: number
  ): T[] {
    return games.filter((g) => g.playedAt != null && g.playedAt >= from && g.playedAt <= to)
  }

  private async generateWeekly(filters: GameFilters): Promise<ReportPayload> {
    const { from, to } = dateRange(7)
    const rangeFilters = { ...filters, _rangeFrom: from, _rangeTo: to } as GameFilters & { _rangeFrom?: number; _rangeTo?: number }
    const games = statisticsService.fetchGames(rangeFilters)
    const weeklyGames = this.filterGamesByRange(games, from, to)

    const overview = statisticsService.overview(rangeFilters)
    const ratingHist = statisticsService.ratingHistory(rangeFilters)
    const openings = statisticsService.openings(rangeFilters).slice(0, 10)
    const tactics = tacticalDetector.summary(rangeFilters)

    const wins = weeklyGames.filter((g) => g.outcome === 'win').length
    const losses = weeklyGames.filter((g) => g.outcome === 'loss').length
    const draws = weeklyGames.filter((g) => g.outcome === 'draw').length
    const blunders = tactics.filter((t) => t.label === 'missed' && (t.tacticType === 'fork' || t.tacticType === 'pin' || t.tacticType === 'hanging')).reduce((s, t) => s + t.count, 0)

    const html = this.renderHtml({
      title: 'Weekly Chess Report',
      subtitle: `Week of ${fmtDate(from)} – ${fmtDate(to)}`,
      sections: [
        {
          heading: 'Overview',
          rows: [
            ['Games played', fmtNumber(weeklyGames.length)],
            ['Wins / Losses / Draws', `${wins} / ${losses} / ${draws}`],
            ['Win rate', pct(overview.winRate)],
            ['Rating change', ratingHist.length > 0 ? `${ratingHist[0].rating} → ${ratingHist[ratingHist.length - 1].rating}` : '—'],
            ['Tactics missed', fmtNumber(blunders)]
          ]
        },
        {
          heading: 'Top Openings This Week',
          rows: openings.map((o) => [o.opening, `${o.games} games`, pct(o.winRate)])
        },
        {
          heading: 'Weakness Profile',
          rows: weaknessEngine.profile(rangeFilters).categories.map((c) => [c.category.charAt(0).toUpperCase() + c.category.slice(1), `${c.stars}★`, c.label])
        },
        {
          heading: 'Key Insights',
          rows: [
            [blunders > 0 ? `You missed ${blunders} tactical opportunities this week.` : 'Clean week — no major tactical misses detected.'],
            [weeklyGames.length > 0 ? `Played ${weeklyGames.length} game${weeklyGames.length !== 1 ? 's' : ''} this week.` : 'No games recorded this week.']
          ]
        }
      ]
    })

    const md = this.renderMarkdown({
      title: 'Weekly Chess Report',
      subtitle: `Week of ${fmtDate(from)} – ${fmtDate(to)}`,
      sections: [
        { heading: 'Overview', rows: [['Games played', fmtNumber(weeklyGames.length)], ['Wins / Losses / Draws', `${wins} / ${losses} / ${draws}`], ['Win rate', pct(overview.winRate)], ['Rating change', ratingHist.length > 0 ? `${ratingHist[0].rating} → ${ratingHist[ratingHist.length - 1].rating}` : '—'], ['Tactics missed', fmtNumber(blunders)]] },
        { heading: 'Top Openings This Week', rows: openings.map((o) => [o.opening, `${o.games} games`, pct(o.winRate)]) },
        { heading: 'Weakness Profile', rows: weaknessEngine.profile(rangeFilters).categories.map((c) => [c.category, `${c.stars}★`, c.label]) },
        { heading: 'Key Insights', rows: [[blunders > 0 ? `You missed ${blunders} tactical opportunities this week.` : 'Clean week — no major tactical misses detected.'], [weeklyGames.length > 0 ? `Played ${weeklyGames.length} game${weeklyGames.length !== 1 ? 's' : ''} this week.` : 'No games recorded this week.']] }
      ]
    })

    return this.saveReport('weekly', html, md, weeklyGames.length)
  }

  private async generateMonthly(filters: GameFilters): Promise<ReportPayload> {
    const { from, to } = dateRange(30)
    const rangeFilters = { ...filters, _rangeFrom: from, _rangeTo: to } as GameFilters & { _rangeFrom?: number; _rangeTo?: number }
    const games = statisticsService.fetchGames(rangeFilters)
    const monthlyGames = this.filterGamesByRange(games, from, to)

    const overview = statisticsService.overview(rangeFilters)
    const ratingHist = statisticsService.ratingHistory(rangeFilters)
    const timeControls = statisticsService.timeControls(rangeFilters)
    const streaks = statisticsService.streaks(rangeFilters)

    const wins = monthlyGames.filter((g) => g.outcome === 'win').length
    const losses = monthlyGames.filter((g) => g.outcome === 'loss').length
    const draws = monthlyGames.filter((g) => g.outcome === 'draw').length

    const html = this.renderHtml({
      title: 'Monthly Progress Report',
      subtitle: `Last 30 days: ${fmtDate(from)} – ${fmtDate(to)}`,
      sections: [
        {
          heading: 'Overview',
          rows: [
            ['Games played', fmtNumber(monthlyGames.length)],
            ['Wins / Losses / Draws', `${wins} / ${losses} / ${draws}`],
            ['Win rate', pct(overview.winRate)],
            ['Current rating', overview.currentRating != null ? String(overview.currentRating) : '—'],
            ['Best rating', overview.bestRating != null ? String(overview.bestRating) : '—'],
            ['Current win streak', String(streaks.currentWin)],
            ['Longest win streak', String(streaks.longestWin)]
          ]
        },
        {
          heading: 'Time Control Breakdown',
          rows: timeControls.map((t) => [t.timeClass.charAt(0).toUpperCase() + t.timeClass.slice(1), `${t.games} games`, pct(t.winRate)])
        },
        {
          heading: 'Rating Trend (recent)',
          rows: ratingHist.slice(-10).map((r) => [r.date, String(r.rating)])
        },
        {
          heading: 'Streaks',
          rows: [
            ['Current win streak', String(streaks.currentWin)],
            ['Longest win streak', String(streaks.longestWin)],
            ['Current unbeaten', String(streaks.currentUnbeaten)],
            ['Longest unbeaten', String(streaks.longestUnbeaten)]
          ]
        }
      ]
    })

    const md = this.renderMarkdown({
      title: 'Monthly Progress Report',
      subtitle: `Last 30 days: ${fmtDate(from)} – ${fmtDate(to)}`,
      sections: [
        { heading: 'Overview', rows: [['Games played', fmtNumber(monthlyGames.length)], ['Wins / Losses / Draws', `${wins} / ${losses} / ${draws}`], ['Win rate', pct(overview.winRate)], ['Current rating', overview.currentRating != null ? String(overview.currentRating) : '—'], ['Best rating', overview.bestRating != null ? String(overview.bestRating) : '—'], ['Current win streak', String(streaks.currentWin)], ['Longest win streak', String(streaks.longestWin)]] },
        { heading: 'Time Control Breakdown', rows: timeControls.map((t) => [t.timeClass.charAt(0).toUpperCase() + t.timeClass.slice(1), `${t.games} games`, pct(t.winRate)]) },
        { heading: 'Rating Trend (recent)', rows: ratingHist.slice(-10).map((r) => [r.date, String(r.rating)]) },
        { heading: 'Streaks', rows: [['Current win streak', String(streaks.currentWin)], ['Longest win streak', String(streaks.longestWin)], ['Current unbeaten', String(streaks.currentUnbeaten)], ['Longest unbeaten', String(streaks.longestUnbeaten)]] }
      ]
    })

    return this.saveReport('monthly', html, md, monthlyGames.length)
  }

  private async generateOpening(filters: GameFilters): Promise<ReportPayload> {
    const games = statisticsService.fetchGames(filters)
    const openings = statisticsService.openings(filters)

    const totalGames = games.length
    const totalWins = games.filter((g) => g.outcome === 'win').length
    const overallWinRate = totalGames > 0 ? Math.round((totalWins / totalGames) * 1000) / 10 : 0

    const html = this.renderHtml({
      title: 'Opening Report',
      subtitle: `Based on ${fmtNumber(totalGames)} games`,
      sections: [
        {
          heading: 'Overall',
          rows: [['Total games', fmtNumber(totalGames)], ['Overall win rate', pct(overallWinRate)], ['Openings played', String(openings.length)]]
        },
        {
          heading: 'Opening Performance',
          rows: openings.slice(0, 15).map((o) => [o.opening, `${o.games} games`, pct(o.winRate), `${o.wins}W / ${o.losses}L / ${o.draws}D`])
        }
      ]
    })

    const md = this.renderMarkdown({
      title: 'Opening Report',
      subtitle: `Based on ${fmtNumber(totalGames)} games`,
      sections: [
        { heading: 'Overall', rows: [['Total games', fmtNumber(totalGames)], ['Overall win rate', pct(overallWinRate)], ['Openings played', String(openings.length)]] },
        { heading: 'Opening Performance', rows: openings.slice(0, 15).map((o) => [o.opening, `${o.games} games`, pct(o.winRate), `${o.wins}W / ${o.losses}L / ${o.draws}D`]) }
      ]
    })

    return this.saveReport('opening', html, md, totalGames)
  }

  private async generateTournament(filters: GameFilters): Promise<ReportPayload> {
    const games = statisticsService.fetchGames(filters)
    const total = games.length
    const wins = games.filter((g) => g.outcome === 'win').length
    const losses = games.filter((g) => g.outcome === 'loss').length
    const draws = games.filter((g) => g.outcome === 'draw').length
    const winRate = total > 0 ? Math.round((wins / total) * 1000) / 10 : 0

    const rated = games.filter((g) => g.opponentRating != null)
    const avgOpponent = rated.length > 0 ? Math.round(rated.reduce((s, g) => s + (g.opponentRating!), 0) / rated.length) : 0
    const perfRating = rated.length > 0 ? Math.round(avgOpponent + 400 * (wins - losses) / total) : 0

    const html = this.renderHtml({
      title: 'Tournament Summary',
      subtitle: `Based on ${fmtNumber(total)} games`,
      sections: [
        {
          heading: 'Tournament Results',
          rows: [
            ['Total games', fmtNumber(total)],
            ['Wins / Losses / Draws', `${wins} / ${losses} / ${draws}`],
            ['Win rate', pct(winRate)],
            ['Avg opponent rating', avgOpponent > 0 ? String(avgOpponent) : '—'],
            ['Performance rating (est.)', perfRating > 0 ? String(perfRating) : '—']
          ]
        },
        {
          heading: 'Opponents',
          rows: statisticsService.opponents(filters).slice(0, 10).map((o) => [o.opponent, `${o.games} games`, pct(o.winRate)])
        },
        {
          heading: 'Time Controls',
          rows: statisticsService.timeControls(filters).map((t) => [t.timeClass.charAt(0).toUpperCase() + t.timeClass.slice(1), `${t.games} games`, pct(t.winRate)])
        }
      ]
    })

    const md = this.renderMarkdown({
      title: 'Tournament Summary',
      subtitle: `Based on ${fmtNumber(total)} games`,
      sections: [
        { heading: 'Tournament Results', rows: [['Total games', fmtNumber(total)], ['Wins / Losses / Draws', `${wins} / ${losses} / ${draws}`], ['Win rate', pct(winRate)], ['Avg opponent rating', avgOpponent > 0 ? String(avgOpponent) : '—'], ['Performance rating (est.)', perfRating > 0 ? String(perfRating) : '—']] },
        { heading: 'Opponents', rows: statisticsService.opponents(filters).slice(0, 10).map((o) => [o.opponent, `${o.games} games`, pct(o.winRate)]) },
        { heading: 'Time Controls', rows: statisticsService.timeControls(filters).map((t) => [t.timeClass.charAt(0).toUpperCase() + t.timeClass.slice(1), `${t.games} games`, pct(t.winRate)]) }
      ]
    })

    return this.saveReport('tournament', html, md, total)
  }

  private renderHtml(opts: { title: string; subtitle: string; sections: Array<{ heading: string; rows: string[][] }> }): string {
    const style = `
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.5; color: #111; padding: 40px; max-width: 900px; margin: 0 auto; }
        h1 { font-size: 24px; margin: 0 0 4px 0; letter-spacing: -0.5px; }
        h2 { font-size: 16px; border-bottom: 2px solid #0ea5e9; padding-bottom: 6px; margin-top: 24px; }
        .subtitle { color: #666; font-size: 14px; margin-bottom: 24px; }
        table { border-collapse: collapse; width: 100%; margin-bottom: 16px; }
        th { text-align: left; font-size: 12px; color: #666; padding: 8px 4px; border-bottom: 1px solid #ddd; }
        td { font-size: 14px; padding: 6px 4px; border-bottom: 1px solid #f0f0f0; }
        tr:nth-child(even) td { background: #fafafa; }
        .meta { font-size: 12px; color: #888; margin-top: 32px; border-top: 1px solid #ddd; padding-top: 16px; }
      </style>
    `
    const sectionsHtml = opts.sections.map((s) => {
      const rows = s.rows.map((r) => `<tr><td>${r.map((c) => esc(c)).join('</td><td>')}</td></tr>`).join('')
      return `<h2>${esc(s.heading)}</h2><table><tbody>${rows}</tbody></table>`
    }).join('')
    return `<!DOCTYPE html><html><head><meta charset="utf-8">${style}</head><body>
      <h1>${esc(opts.title)}</h1>
      <div class="subtitle">${esc(opts.subtitle)}</div>
      ${sectionsHtml}
      <div class="meta">Generated by Windmill Chess Report Generator on ${new Date().toLocaleString()}</div>
    </body></html>`
  }

  private renderMarkdown(opts: { title: string; subtitle: string; sections: Array<{ heading: string; rows: string[][] }> }): string {
    const lines: string[] = []
    lines.push(`# ${opts.title}`)
    lines.push(`*${opts.subtitle}*`)
    lines.push('')
    for (const s of opts.sections) {
      lines.push(`## ${s.heading}`)
      lines.push('| | | | |')
      lines.push('|---|---|---|---|')
      for (const r of s.rows) {
        lines.push(`| ${r.map((c) => esc(c)).join(' | ')} |`)
      }
      lines.push('')
    }
    lines.push(`---\n*Generated by Windmill Chess Report Generator on ${new Date().toLocaleString()}*`)
    return lines.join('\n')
  }

  private async saveReport(type: ReportType, html: string, md: string, gamesAnalyzed: number): Promise<ReportPayload> {
    const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const defaultName = `windmill-${type}-report-${dateStamp}`

    const { canceled, filePath } = await dialog.showSaveDialog({
      title: `Export ${type} report`,
      defaultPath: `${defaultName}.html`,
      filters: [
        { name: 'HTML Report', extensions: ['html'] },
        { name: 'Markdown', extensions: ['md'] }
      ]
    })

    if (canceled || !filePath) {
      throw new Error('Save canceled')
    }

    const isMd = filePath.endsWith('.md')
    const content = isMd ? md : html
    await writeFile(filePath, content, 'utf8')

    logger.info('ReportGenerator saved report', { path: filePath, type, format: isMd ? 'markdown' : 'html', gamesAnalyzed })
    return { path: filePath, type, format: isMd ? 'markdown' : 'html', gamesAnalyzed }
  }

  generate(type: ReportType, format: ReportFormat, filters: GameFilters = {}): Promise<ReportPayload> {
    switch (type) {
      case 'weekly': return this.generateWeekly(filters)
      case 'monthly': return this.generateMonthly(filters)
      case 'opening': return this.generateOpening(filters)
      case 'tournament': return this.generateTournament(filters)
      default: return this.generateWeekly(filters)
    }
  }
}

export const reportGenerator = new ReportGenerator()
