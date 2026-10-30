import { SLICE_COLORS } from "@/lib/colors";
import { polar, truncateTitle, wedgePath } from "@/lib/wheel";

const TITLES = ["The Bear", "Shogun", "Hacks", "Andor", "The Pitt", "Slow Horses"];

export function DecorWheel() {
  const count = TITLES.length;
  const slice = 360 / count;
  return (
    <div className="decor-spin">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        {TITLES.map((title, index) => {
          const mid = index * slice;
          const start = mid - slice / 2 + 0.7;
          const end = mid + slice / 2 - 0.7;
          const left = mid > 90 && mid < 270;
          const from = polar(50, 50, left ? 42 : 20, mid);
          const toward = polar(50, 50, left ? 20 : 42, mid);
          const rot = (Math.atan2(toward.y - from.y, toward.x - from.x) * 180) / Math.PI;
          const fill = SLICE_COLORS[index % SLICE_COLORS.length]!;
          const ink = fill === "#F0D7A4" || fill === "#E7A33A" || fill === "#E6C15A" ? "#1C1410" : "#F4E7D4";
          return (
            <g key={title}>
              <path d={wedgePath(start, end)} fill={fill} />
              <text
                x={from.x}
                y={from.y}
                fill={ink}
                textAnchor="start"
                dominantBaseline="middle"
                transform={`rotate(${rot} ${from.x} ${from.y})`}
                style={{ fontSize: 3.2, fontFamily: "var(--font-sans), sans-serif", fontWeight: 650 }}
              >
                {truncateTitle(title, 12)}
              </text>
            </g>
          );
        })}
        <circle cx="50" cy="50" r="47.2" fill="none" stroke="#14110e" strokeWidth="0.8" />
        <circle cx="50" cy="50" r="11" fill="#14110e" />
        <circle cx="50" cy="50" r="8.2" fill="#f3e6d0" />
      </svg>
    </div>
  );
}
