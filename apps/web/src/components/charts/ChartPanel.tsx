import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Card } from '../common/UI'

type ChartPoint = Record<string, string | number>

export function ChartPanel({
  title,
  type = 'line',
  data,
  color = '#29b8db',
  dataKey = 'vehicles',
  secondKey,
}: {
  title: string
  type?: 'line' | 'bar' | 'area'
  data: ChartPoint[]
  color?: string
  dataKey?: string
  secondKey?: string
}) {
  const Chart = type === 'bar' ? BarChart : type === 'area' ? AreaChart : LineChart
  return (
    <Card className="data-panel">
      <div className="panel-title">{title}</div>
      <div className="chart-area">
        <ResponsiveContainer width="100%" height="100%">
          <Chart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="time" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
            {secondKey && <Legend />}
            {type === 'bar' ? <Bar dataKey={dataKey} name={dataKey} fill={color} radius={[4, 4, 0, 0]} /> :
              type === 'area' ? <><Area dataKey={dataKey} name={dataKey} stroke={color} fill={color} fillOpacity={.13} strokeWidth={2} />{secondKey && <Area dataKey={secondKey} name={secondKey} stroke="#b481ed" fill="#b481ed" fillOpacity={.06} />}</> :
                <><Line dataKey={dataKey} name={dataKey} stroke={color} strokeWidth={2.5} dot={false} />{secondKey && <Line dataKey={secondKey} name={secondKey} stroke="#b481ed" strokeWidth={2} dot={false} strokeDasharray="5 4" />}</>}
          </Chart>
        </ResponsiveContainer>
      </div>
      <span className="demo-label">DEMO DATA · illustrative only</span>
    </Card>
  )
}
