import { sessionStatusColors, sessionStatusLabels } from "@/lib/domain/sessionPresentation";

export function CalendarStatusLegend() {
  return (
    <div className="calendar-status-legend" aria-label="預約狀態">
      {Object.entries(sessionStatusLabels).map(([status, label]) => (
        <span className={`badge status-${status}`} key={status}>
          <span className="legend-dot" style={{ background: sessionStatusColors[status] }} />
          {label}
        </span>
      ))}
    </div>
  );
}
