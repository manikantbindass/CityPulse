export function CityNetwork({ compact = false }: { compact?: boolean }) {
  return (
    <svg
      viewBox="0 0 600 330"
      className={`city-network ${compact ? 'compact-network' : ''}`}
      role="img"
      aria-label="Stylized city network illustration, not geographic data"
    >
      <defs>
        <linearGradient id={compact ? 'net-c' : 'net'} x1="0" x2="1" y1="0" y2="1">
          <stop stopColor="#60e2d5" />
          <stop offset="1" stopColor="#8b6cf3" />
        </linearGradient>
        <pattern
          id={compact ? 'grid-c' : 'grid'}
          width="38"
          height="38"
          patternUnits="userSpaceOnUse"
        >
          <path d="M38 0H0V38" fill="none" stroke="#283449" strokeWidth=".6" />
        </pattern>
      </defs>
      <rect width="600" height="330" fill={`url(#${compact ? 'grid-c' : 'grid'})`} />
      <g
        transform="translate(300 165) rotate(-22) skewX(22) scale(1 .65)"
        stroke={`url(#${compact ? 'net-c' : 'net'})`}
        fill="none"
      >
        <path
          d="M-220 -100H180V140H-220ZM-160 -150H240V90H-160ZM-220 -20H240M-220 60H240M-100 -150V140M20 -150V140M140 -150V140"
          strokeOpacity=".5"
        />
        <g fill="#162d36">
          {[
            [-160, -100, 45, 70],
            [-80, -20, 50, 95],
            [40, -100, 55, 120],
            [150, 20, 45, 65],
            [-170, 70, 35, 45],
            [40, 60, 50, 60],
          ].map(([x, y, w, h], i) => (
            <g key={i}>
              <path d={`M${x} ${y}v${-h}h${w}v${h}Z`} fill={i === 2 ? '#234454' : '#152937'} />
              <path
                d={`M${x} ${y - h}l18 -14h${w}l-18 14m${w} 0l18 -14v${h}l-18 14`}
                fill="#1b303f"
              />
            </g>
          ))}
        </g>
        <path d="M-200 0H-100V-60H70V30H200M-90 100V20H30" strokeWidth="2.5" />
        <g fill="#75f2df" stroke="#142935" strokeWidth="5">
          {[
            [-200, 0],
            [-100, 0],
            [-100, -60],
            [70, -60],
            [70, 30],
            [200, 30],
            [-90, 100],
            [-90, 20],
            [30, 20],
          ].map(([x, y], i) => (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="6"
              className="network-node"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </g>
      </g>
      <text
        x="25"
        y="305"
        fill="#8794a9"
        fontFamily="Arial,sans-serif"
        fontSize="10"
        letterSpacing="2"
      >
        SPATIAL INTELLIGENCE / CONCEPT VIEW
      </text>
    </svg>
  );
}
