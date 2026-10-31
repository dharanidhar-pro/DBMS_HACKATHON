import { useState } from "react";
import { ArrowUpRight, Check, CornerDownRight, Sparkles } from "lucide-react";

export function ParkingIllustration({
  compact = false,
}: {
  compact?: boolean;
}) {
  const [selected, setSelected] = useState(7);
  const occupied = [1, 3, 4, 8, 10, 12, 15, 16, 19, 21];
  return (
    <div className={`hero-parking ${compact ? "compact" : ""}`}>
      <div className="garage-halo" />
      <div className="garage-meta">
        <span>
          <span className="tiny-dot" /> A smarter arrival
        </span>
        <span>
          THE PARKLY WAY <ArrowUpRight size={13} />
        </span>
      </div>
      <div className="garage-scene">
        <div className="garage-building">
          <div className="garage-floor">
            <div className="garage-head">
              <span>
                PARKLY <b>01</b>
              </span>
              <span>ZONE A · ILLUSTRATION</span>
            </div>
            <div className="illustration-slots">
              {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  aria-label={`Illustration space A-${String(n).padStart(2, "0")}`}
                  disabled={occupied.includes(n)}
                  onClick={() => setSelected(n)}
                  className={`illustration-slot ${occupied.includes(n) ? "has-car" : ""} ${n === selected ? "selected" : ""}`}
                >
                  <span>{String(n).padStart(2, "0")}</span>
                  {occupied.includes(n) ? (
                    <div className={`car car-${n % 3}`}>
                      <i />
                      <i />
                    </div>
                  ) : n === selected ? (
                    <Check size={22} />
                  ) : (
                    <span className="slot-dot" />
                  )}
                </button>
              ))}
            </div>
            <div className="garage-lane">
              <span>→</span>
              <span className="lane-dashes" />
              <span>→</span>
              <span className="lane-dashes" />
              <span>→</span>
            </div>
            <div className="garage-footer">
              <span>↑ &nbsp; ENTRANCE</span>
              <span className="route-line" />
              <CornerDownRight size={18} />
            </div>
          </div>
          <div className="garage-side" />
        </div>
      </div>
      <div className="recommendation-float">
        <div className="float-icon">
          <Sparkles size={19} />
        </div>
        <div>
          <span>Your perfect fit</span>
          <strong>
            Space A-{String(selected).padStart(2, "0")} <span>Selected</span>
          </strong>
          <small>Less searching. More getting there.</small>
        </div>
        <span className="float-check">
          <Check size={14} />
        </span>
      </div>
      <div className="illustration-caption">
        <span className="caption-line" />
        Interactive illustration · select an open space
      </div>
    </div>
  );
}
