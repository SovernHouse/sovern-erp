import { TrendingUp, TrendingDown } from 'lucide-react'

const SH = {
  forest: '#1D5A32',
  forestLight: '#2A7040',
  cream: '#F1EEE7',
  creamDark: '#E4E0D8',
  ink: '#0E0D0C',
  inkMuted: 'rgba(14,13,12,0.55)',
}

// All KPI cards use Sovern House forest/cream palette regardless of the color prop
export default function StatsCard({
  icon: Icon,
  label,
  value,
  trend,
  trendLabel,
}) {
  const trendPositive = trend > 0
  const trendColor = trendPositive ? SH.forest : '#dc2626'
  const TrendIcon = trendPositive ? TrendingUp : TrendingDown

  return (
    <div
      style={{
        background: SH.cream,
        borderLeft: `3px solid ${SH.forest}`,
        padding: '20px 24px',
        transition: 'box-shadow 0.15s',
      }}
    >
      <div className="flex items-center justify-between">
        <div style={{ flex: 1 }}>
          <p
            style={{
              fontFamily: "'Arsenal SC', sans-serif",
              fontSize: 11,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: SH.inkMuted,
              margin: 0,
            }}
          >
            {label}
          </p>
          <h3
            style={{
              fontFamily: "'Big Shoulders Display', sans-serif",
              fontWeight: 700,
              fontSize: 26,
              color: SH.ink,
              margin: '6px 0 0',
              lineHeight: 1,
            }}
          >
            {value}
          </h3>
          {trend !== undefined && (
            <div className="flex items-center mt-2">
              <TrendIcon style={{ width: 14, height: 14, color: trendColor }} />
              <span style={{ marginLeft: 4, fontSize: 12, color: trendColor }}>
                {trend > 0 ? '+' : ''}{trend}%
              </span>
              {trendLabel && (
                <span style={{ fontSize: 11, color: SH.inkMuted, marginLeft: 6 }}>{trendLabel}</span>
              )}
            </div>
          )}
        </div>
        {Icon && (
          <div
            style={{
              padding: 10,
              background: SH.creamDark,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon style={{ width: 20, height: 20, color: SH.forest }} />
          </div>
        )}
      </div>
    </div>
  )
}
