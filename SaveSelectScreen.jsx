export default function SaveSelectScreen({ saves, onLoad, onNewRun, onDelete, loading, onBack }) {
  const MAX_SAVES = 5;

  function fmt(isoStr) {
    if (!isoStr) return "";
    const d = new Date(isoStr);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) +
      " · " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }

  return (
    <div className="save-select-screen">
      <div className="save-select-card">
        <div className="save-select-top">
          <div>
            <div className="save-select-brand">SOLE PROPRIETOR</div>
            <div className="save-select-title">Your Runs</div>
          </div>
          {onBack && (
            <button className="save-select-back" onClick={onBack}>← Back</button>
          )}
        </div>

        {saves.length === 0 && !loading && (
          <div className="save-select-empty">No saves yet — start a new run below.</div>
        )}

        {loading && (
          <div className="save-select-empty">Loading saves…</div>
        )}

        <div className="save-select-list">
          {saves.map(save => (
            <div key={save.id} className="save-slot">
              <div className="save-slot-info">
                <div className="save-slot-name">{save.name}</div>
                <div className="save-slot-date">{fmt(save.saved_at)}</div>
              </div>
              <div className="save-slot-actions">
                <button className="save-slot-load" onClick={() => onLoad(save)}>Load</button>
                <button className="save-slot-delete" onClick={() => onDelete(save.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>

        <button
          className="save-new-run"
          onClick={() => onNewRun()}
          disabled={saves.length >= MAX_SAVES}
          title={saves.length >= MAX_SAVES ? `Max ${MAX_SAVES} saves reached` : ""}
        >
          + New Run
        </button>
        {saves.length >= MAX_SAVES && (
          <div className="save-max-note">Delete a save to create a new run.</div>
        )}
      </div>
    </div>
  );
}
