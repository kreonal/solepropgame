import { useState } from "react";
import { AVAILABLE_SIZES, resolveRaffleWin, resolveRaffleMarket } from "./data";

const MAX_ENTRIES   = 4;
const PREORDER_MULT = 1.20;
export default function RaffleScreen({ releases, cash, weekNumber, inventoryCount, inventoryCap = 50, dailyMarkets = {}, onComplete, onSkip }) {
  // raffleEntries: { [releaseId]: size }
  // preorders: Set of releaseIds
  const [raffleEntries, setRaffleEntries] = useState({});
  const [preorders,     setPreorders]     = useState(new Set());
  const [results,       setResults]       = useState(null);

  const raffleCount  = Object.keys(raffleEntries).length;
  const preorderCount = preorders.size;
  const totalActions = raffleCount + preorderCount;

  // Remaining inventory space
  const spaceLeft = inventoryCap - inventoryCount;

  function toggleRaffle(releaseId, size) {
    if (preorders.has(releaseId)) return; // can't raffle and preorder same shoe
    setRaffleEntries(prev => {
      const next = { ...prev };
      if (next[releaseId] === size) { delete next[releaseId]; return next; }
      if (next[releaseId] !== undefined) { next[releaseId] = size; return next; }
      if (raffleCount >= MAX_ENTRIES) return prev;
      next[releaseId] = size;
      return next;
    });
  }

  function togglePreorder(release) {
    if (raffleEntries[release.id] !== undefined) return; // can't both
    const preorderPairs = AVAILABLE_SIZES.length; // full size run
    const cost = Math.round(release.retail * PREORDER_MULT * preorderPairs);
    // Check funds and space
    const currentPreorderCost = [...preorders].reduce((s, id) => {
      const r = releases.find(r => r.id === id);
      return s + Math.round(r.retail * PREORDER_MULT * AVAILABLE_SIZES.length);
    }, 0);
    if (!preorders.has(release.id) && (cash - currentPreorderCost < cost)) return;
    if (!preorders.has(release.id) && spaceLeft < preorderPairs) return;
    setPreorders(prev => {
      const next = new Set(prev);
      next.has(release.id) ? next.delete(release.id) : next.add(release.id);
      return next;
    });
  }

  function handleSubmit() {
    // Resolve raffles
    const raffleResults = releases.map(release => {
      const size = raffleEntries[release.id];
      if (!size) return { release, size: null, won: false, marketPrice: null, isPreorder: false };
      const won = resolveRaffleWin();
      const marketPrice = won ? resolveRaffleMarket(release, dailyMarkets) : null;
      return { release, size, won, marketPrice, isPreorder: false };
    });

    // Preorder results — guaranteed, full size run
    const preorderResults = [...preorders].map(id => {
      const release = releases.find(r => r.id === id);
      const marketPrice = resolveRaffleMarket(release, dailyMarkets);
      return { release, size: "full run", won: true, marketPrice, isPreorder: true };
    });

    setResults([...raffleResults, ...preorderResults]);
  }

  function handleConfirm() {
    const wonItems     = [];
    const marketUpdates = {};
    let totalCost = 0;

    for (const r of results) {
      if (!r.won) continue;
      if (r.isPreorder) {
        const cost = Math.round(r.release.retail * PREORDER_MULT * AVAILABLE_SIZES.length);
        totalCost += cost;
        marketUpdates[r.release.id] = r.marketPrice;
        for (const sz of AVAILABLE_SIZES) {
          wonItems.push({
            shoeId: r.release.id, brand: r.release.brand, model: r.release.model,
            colorway: r.release.colorway, size: sz, quantity: 1,
            avgPurchasePrice: Math.round(r.release.retail * PREORDER_MULT),
            listPrice: r.marketPrice, isRaffle: false,
          });
        }
      } else {
        totalCost += r.release.retail;
        marketUpdates[r.release.id] = r.marketPrice;
        wonItems.push({
          shoeId: r.release.id, brand: r.release.brand, model: r.release.model,
          colorway: r.release.colorway, size: r.size, quantity: 1,
          avgPurchasePrice: r.release.retail,
          listPrice: r.marketPrice, isRaffle: true,
        });
      }
    }

    onComplete(wonItems, totalCost, marketUpdates);
  }

  // ── Results view ────────────────────────────────────────────────────────────
  if (results) {
    const wins     = results.filter(r => r.won);
    const totalCost = results.reduce((s, r) => {
      if (!r.won) return s;
      if (r.isPreorder) return s + Math.round(r.release.retail * PREORDER_MULT * AVAILABLE_SIZES.length);
      return s + r.release.retail;
    }, 0);

    return (
      <div className="container">
        <h2>Results — Week {weekNumber}</h2>
        <div className="raffle-results-list">
          {results.map(r => r.size && (
            <div key={r.release.id} className={`card raffle-result-card ${r.won ? "won" : "lost"}`}>
              <div className="raffle-result-left">
                <span className="shoe-brand">{r.release.brand}</span>
                <span className="shoe-name">{r.release.model} — {r.release.colorway}</span>
                <span className="raffle-size-tag">
                  {r.isPreorder ? "Preorder · Full Run" : `Raffle · Size ${r.size}`}
                </span>
              </div>
              <div className="raffle-result-right">
                {r.won ? (
                  <>
                    <span className="raffle-win-badge">{r.isPreorder ? "LOCKED" : "WON"}</span>
                    <span className="raffle-result-retail">
                      {r.isPreorder
                        ? `$${Math.round(r.release.retail * PREORDER_MULT * AVAILABLE_SIZES.length).toLocaleString()} total`
                        : `Retail $${r.release.retail}`}
                    </span>
                    <span className="raffle-result-market">Mkt ~${r.marketPrice}</span>
                  </>
                ) : (
                  <span className="raffle-loss-badge">L</span>
                )}
              </div>
            </div>
          ))}
          {results.every(r => !r.size) && (
            <p className="empty-state">No entries this week.</p>
          )}
        </div>

        {wins.length > 0 && (
          <div className="raffle-cost-summary card">
            <span>{wins.length} acquisition{wins.length !== 1 ? "s" : ""}</span>
            <span className="raffle-cost-total">−${totalCost.toLocaleString()}</span>
          </div>
        )}

        <div className="start-day-footer">
          <button className="primary-btn" onClick={handleConfirm} style={{ width: "100%", maxWidth: 420, padding: 15, fontSize: 15 }}>
            {wins.length > 0 ? `Add Stock & Set Prices →` : "Continue →"}
          </button>
        </div>
      </div>
    );
  }

  // ── Entry view ──────────────────────────────────────────────────────────────
  // Compute running preorder cost to show affordability
  const preorderTotalCost = [...preorders].reduce((s, id) => {
    const r = releases.find(r => r.id === id);
    return s + Math.round(r.retail * PREORDER_MULT * AVAILABLE_SIZES.length);
  }, 0);

  return (
    <div className="container">
      <div className="raffle-header">
        <div>
          <h2>Week {weekNumber} Drops</h2>
          <p className="setup-hint">
            Raffle (1 size, up to {MAX_ENTRIES}) or Preorder (full run, guaranteed).
          </p>
        </div>
        <div className="raffle-entry-counter">
          <span className="raffle-entry-num">{totalActions}</span>
          <span className="raffle-entry-denom"> actions</span>
        </div>
      </div>

      {preorderTotalCost > 0 && (
        <div className="preorder-cost-bar card">
          <span>Preorder total</span>
          <span className="raffle-cost-total">−${preorderTotalCost.toLocaleString()}</span>
        </div>
      )}

      <div className="catalog-list">
        {releases.map(release => {
          const raffleSize   = raffleEntries[release.id];
          const isRaffled    = raffleSize !== undefined;
          const isPreordered = preorders.has(release.id);
          const preorderCost = Math.round(release.retail * PREORDER_MULT * AVAILABLE_SIZES.length);
          const canAffordPre = cash - preorderTotalCost >= preorderCost || isPreordered;
          const hasSpace     = spaceLeft >= AVAILABLE_SIZES.length || isPreordered;

          return (
            <div key={release.id} className={`card raffle-card${isRaffled || isPreordered ? " selected" : ""}`}>
              <div className="raffle-card-top">
                <div className="shoe-info">
                  <span className="shoe-brand">{release.brand}</span>
                  <span className="shoe-name">{release.model} — {release.colorway}</span>
                </div>
                <div className="raffle-badges">
                  <span className="market-tag">Retail ${release.retail}</span>
                </div>
              </div>

              {/* Raffle row */}
              {!isPreordered && (
                <div className="raffle-size-row">
                  {AVAILABLE_SIZES.map(sz => {
                    const active   = raffleSize === sz;
                    const disabled = !active && !isRaffled && raffleCount >= MAX_ENTRIES;
                    return (
                      <button key={sz}
                        className={`raffle-size-btn${active ? " active" : ""}${disabled ? " disabled" : ""}`}
                        onClick={() => !disabled && toggleRaffle(release.id, sz)}>
                        {sz}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Preorder row */}
              {!isRaffled && (
                <div className="preorder-row">
                  <div className="preorder-info">
                    <span className="preorder-label">Preorder full run</span>
                    <span className="preorder-cost">${preorderCost.toLocaleString()} @ 120% retail</span>
                  </div>
                  <button
                    className={`preorder-btn${isPreordered ? " active" : ""}`}
                    disabled={!isPreordered && (!canAffordPre || !hasSpace)}
                    onClick={() => togglePreorder(release)}>
                    {isPreordered ? "Cancel" : !hasSpace ? "No Space" : !canAffordPre ? "Can't Afford" : "Preorder"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="start-day-footer raffle-footer">
        <button className="secondary-btn" onClick={onSkip} style={{ flex: 1 }}>
          Skip
        </button>
        <button className="primary-btn" onClick={handleSubmit}
          disabled={totalActions === 0} style={{ flex: 2 }}>
          Submit {totalActions > 0 ? `(${totalActions})` : ""} →
        </button>
      </div>
    </div>
  );
}
