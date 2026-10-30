import { assignSliceColors } from "@/lib/colors";
import { labelPose, sliceGeometry, truncateTitle, wedgePath } from "@/lib/wheel";

const TITLES = ["The Bear", "Shogun", "Hacks", "Andor", "The Pitt", "Slow Horses"];

export function DecorWheel() {
  const geom = sliceGeometry(TITLES.length);
  const paints = assignSliceColors(TITLES.length);
  return (
    <div className="decor-spin">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        {TITLES.map((title, index) => {
          const slice = geom[index]!;
          const pose = labelPose(slice.mid, 33);
          const paint = paints[index]!;
          return (
            <g key={title}>
              <path d={wedgePath(slice.start, slice.end)} fill={paint.fill} />
              <text
                x={pose.x}
                y={pose.y}
                fill={paint.ink}
                textAnchor="middle"
                dominantBaseline="middle"
                transform={`rotate(${pose.rotation} ${pose.x} ${pose.y})`}
                style={{ fontSize: 3.3, fontFamily: "var(--font-sans), sans-serif", fontWeight: 650 }}
              >
                {truncateTitle(title, 12)}
              </text>
            </g>
          );
        })}
        <circle cx="50" cy="50" r="47.2" fill="none" stroke="#1c1410" strokeWidth="0.8" />
        <circle cx="50" cy="50" r="11" fill="#1c1410" />
        <circle cx="50" cy="50" r="8.2" fill="#f3e6d0" />
      </svg>
    </div>
  );
}
