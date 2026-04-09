import { AVAILABLE_SIZES, generateWeeklyReleases, shoeImageUrl } from "./data";

const PREORDER_MULT = 1.20;
const MAX_RAFFLES   = 4;
const TREND_EMOJI   = { up: "📈", neutral: "➖", down: "📉" };

function getPreorderCost(release) {
  return Math.round(release.retail * PREORDER_MULT * AVAILABLE_SIZES.length);
}

export default function ReleasesTab({
  releaseCalendar,
  day,
  dailyMarkets,
  brandTrends,
  tentativeSelections,
  onSelectionsChange,
  cash,
  inventoryCount,
  inventoryCap,
}) {
  const currentWeek = Math.ceil(day / 7);
  const nextWeek    = currentWeek + 1;

  // Build 4 upcoming weeks
  const weeks = [1, 2, 3, 4].map(offset => ({
    weekNum:  currentWeek + offset,
    releases: generateWeeklyReleases(releaseCalendar, currentWeek + offset),
    isActive: offset === 1, // only next week is interactive
  }));

  const raffleCount = Object.values(tentativeSelections).filter(s => s.type === "raffle").length;

  const currentPreorderCost = Object.values(tentativeSelections)
    .filter(s => s.type === "preorder")
    .reduce((sum, s) => sum + getPreorderCost(s.release), 0);

  function setSelection(release, type, size) {
    onSelectionsChange(prev => {
      const next = { ...prev };
      const existing = next[release.id];

      // Clicking same selection clears it
      if (existing?.type === type && (type === "preorder" || existing.size === size)) {
        delete next[release.id];
        return next;
      }

      // Raffle cap
      if (type === "raffle" && !existing && raffleCount >= MAX_RAFFLES) return prev;

      // Preorder affordability
      if (type === "preorder" && !existing) {
        const cost = getPreorderCost(release);
        if (cash - currentPreorderCost < cost) return prev;
        if ((inventoryCap - inventoryCount) < AVAILABLE_SIZES.length) return prev;
      }

      next[release.id] = { type, size: type === "raffle" ? size : undefined, release };
      return next;
    });
  }

  function clearSelection(releaseId) {
    onSelectionsChange(prev => {
      const next = { ...prev };
      delete next[releaseId];
      return next;
    });
  }

  const tentativeCost = Object.values(tentativeSelections).reduce((sum, sel) => {
    if (sel.type === "preorder") return sum + getPreorderCost(sel.release);
    return sum + sel.release.retail;
  }, 0);

  return (
    <div className="container releases-tab">

      {Object.keys(tentativeSelections).length > 0 && (
        <div className="releases-tentative-bar card">
          <div className="releases-tentative-label">
            <span>{Object.keys(tentativeSelections).length} selection{Object.keys(tentativeSelections).length !== 1 ? "s" : ""}</span>
            <span className="releases-tentative-note">Finalizes after Day 7</span>
          </div>
          <span className="releases-tentative-cost">−${tentativeCost.toLocaleString()} projected</span>
        </div>
      )}

      {weeks.map(({ weekNum, releases, isActive }) => (
        <div key={weekNum} className="releases-week">
          <div className="releases-week-header">
            <span className="releases-week-label">Week {weekNum} Drops</span>
            {isActive
              ? <span className="releases-week-badge active">Open for entry</span>
              : <span className="releases-week-badge locked">Preview only</span>}
          </div>

          {releases.map(release => {
            if (!release) return null;
            const sel       = tentativeSelections[release.id];
            const mktMid    = dailyMarkets[release.id]?.mid ?? release.baseMarket;
            const trend     = brandTrends?.[release.brand];
            const trendDir  = trend?.direction ?? "neutral";
            const preorderCost = getPreorderCost(release);
            const canAffordPre = isActive && !sel && (cash - currentPreorderCost >= preorderCost);
            const hasSpace     = isActive && (inventoryCap - inventoryCount) >= AVAILABLE_SIZES.length;

            return (
              <div key={release.id} className={`card releases-card${sel ? " selected" : ""}${!isActive ? " preview" : ""}`}>
                <div className="releases-card-top">
                  <div className="releases-card-img-wrap">
                    <img
                      src={shoeImageUrl(release.id)}
                      alt={release.model}
                      className="releases-card-img"
                      onError={e => { e.target.parentElement.style.display = "none"; }}
                    />
                  </div>
                  <div className="releases-card-info">
                    <div className="shoe-brand">{release.brand} {TREND_EMOJI[trendDir]}</div>
                    <div className="shoe-name">{release.model} — {release.colorway}</div>
                    <div className="releases-card-prices">
                      <span className="market-tag">Retail ${release.retail}</span>
                      <span className="releases-mkt">Mkt ~${mktMid}</span>
                    </div>
                  </div>
                  {sel && isActive && (
                    <button className="releases-clear-btn" onClick={() => clearSelection(release.id)}>✕</button>
                  )}
                </div>

                {isActive && (
                  <>
                    {/* Raffle size picker */}
                    {(!sel || sel.type === "raffle") && (
                      <div className="releases-section">
                        <div className="releases-section-label">Raffle ({raffleCount}/{MAX_RAFFLES} entered)</div>
                        <div className="raffle-size-row">
                          {AVAILABLE_SIZES.map(sz => {
                            const active   = sel?.type === "raffle" && sel.size === sz;
                            const disabled = !active && !sel && raffleCount >= MAX_RAFFLES;
                            return (
                              <button
                                key={sz}
                                className={`raffle-size-btn${active ? " active" : ""}${disabled ? " disabled" : ""}`}
                                disabled={disabled}
                                onClick={() => setSelection(release, "raffle", sz)}
                              >
                                {sz}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Preorder */}
                    {(!sel || sel.type === "preorder") && (
                      <div className="preorder-row">
                        <div className="preorder-info">
                          <span className="preorder-label">Preorder full run</span>
                          <span className="preorder-cost">${preorderCost.toLocaleString()} @ 120% retail</span>
                        </div>
                        <button
                          className={`preorder-btn${sel?.type === "preorder" ? " active" : ""}`}
                          disabled={!sel && (!canAffordPre || !hasSpace)}
                          onClick={() => setSelection(release, "preorder")}
                        >
                          {sel?.type === "preorder" ? "Cancel" : !hasSpace ? "No Space" : !canAffordPre ? "Can't Afford" : "Preorder"}
                        </button>
                      </div>
                    )}
                  </>
                )}

                {!isActive && (
                  <div className="releases-preview-note">
                    Available to enter Week {weekNum - 1}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
