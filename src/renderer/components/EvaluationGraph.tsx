import { AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell } from 'recharts'

type EvalPoint = {
  ply: number
  eval: number
  mate: number | null
  classification: string | null
}

type EvaluationGraphProps = {
  points: EvalPoint[]
  onJump: (ply: number) => void
}

export default function EvaluationGraph({ points, onJump }: EvaluationGraphProps) {
  if (points.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-500 text-sm">
        No evaluation data. Run analysis first.
      </div>
    )
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={points}
          margin={{ top: 10, right: 20, bottom: 10, left: 10 }}
          onClick={(activeIndex: unknown) => {
            const pt = points[activeIndex as number]
            if (pt) onJump(pt.ply)
          }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="ply"
            type="number"
            label={{ value: 'Ply', position: 'insideBottomRight', offset: 0 }}
            tick={{ fontSize: 10 }}
          />
          <YAxis
            domain={[-10, 10]}
            label={{ value: 'Eval', angle: -90, position: 'insideLeft' }}
            tick={{ fontSize: 10 }}
          />
          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            contentStyle={{ borderRadius: 4, border: '1px solid #e2e8f0' }}
            formatter={(value: number) => value.toFixed(2)}
            labelFormatter={(ply: number) => `Ply ${ply}`}
          />
          <Area
            type="monotone"
            dataKey="eval"
            stroke="#2563eb"
            strokeWidth={2}
            fillOpacity={0.6}
            data={points.map((p) => ({ ...p, eval: Math.max(-10, Math.min(10, p.eval)) }))}
          >
            {points.map((p, i) => (
              <Cell key={`cell-${i}`} fill={classificationColor(p.classification)} />
            ))}
          </Area>
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function classificationColor(c: string | null): string {
  switch (c) {
    case 'best': return '#10b981'
    case 'excellent': return '#34d399'
    case 'good': return '#60a5fa'
    case 'inaccuracy': return '#fbbf24'
    case 'mistake': return '#f97316'
    case 'blunder': return '#ef4444'
    default: return '#2563eb'
  }
}
