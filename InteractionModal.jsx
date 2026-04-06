import { useState } from "react";
import { PERSONALITIES, getSizeAdjust } from "./data";

// BUY = 0.25h, SELL/TRADE base = 0.5h, inspection = +0.5h
const TIME_BUY     = 0.25;
const TIME_SELL    = 0.5;
const TIME_INSPECT = 0.5;

function ProfitBadge({ pct }) {
  if (pct == null || isNaN(pct)) return null;
  const cls = pct >= 15 ? "profit-green" : pct >= 0 ? "profit-yellow" : "profit-red";
  return (
    <div className={`profit-badge ${cls}`}>
      {pct >= 0 ? "+" : ""}{pct.toFixed(1)}% margin at market midpoint
    </div>
  );
}

export default function InteractionModal({
  customer,
  inventory,
  dailyMarkets,
  cash,
  inventoryCount,
  inventoryCap = 50,
  hoursLeft,
  authTier,
  onTransaction,
  onClose,
}) {
  const { type, personality, shoe, size, marketRange } = customer;
  const traits = PERSONALITIES[personality];

  // Resolve market range — fallback for any legacy saves
  const resolvedRange = marketRange ?? (() => {
    const base = dailyMarkets[shoe.id] ?? 0;
    if (typeof base === "object") {
      const adj = getSizeAdjust(size);
      return { low: base.low + adj, mid: base.mid + adj, high: base.high + adj };
    }
    const scalar = base + getSizeAdjust(size);
    return { low: Math.round(scalar * 0.88), mid: scalar, high: Math.round(scalar * 1.12) };
  })();
  const { low: mktLow, mid: mktMid, high: mktHigh } = resolvedRange;

  const effectiveInspectTime =
    authTier === "employee" ? 0 :
    authTier === "app"      ? TIME_INSPECT / 2 :
    TIME_INSPECT;

  // All pricing anchored to market midpoint
  const buyMaxPrice    = Math.round(mktMid * (customer.marketingBoosted ? traits.buyMaxMult * 1.12 : traits.buyMaxMult));
  const sellFloorPrice = Math.round(mktMid * traits.sellFloorMult);

  // ── Pending result ────────────────────────────────────────────────────────
  const [pendingResult, setPendingResult] = useState(null);

  function commitResult(result) {
    setPendingResult({ customerId: customer.id, result });
  }

  function handleDone() {
    onTransaction(pendingResult.customerId, pendingResult.result);
  }

  // ── Inspection gate (SELL / TRADE only) ───────────────────────────────────
  const [inspection, setInspection] = useState(type === "BUY" ? "n/a" : null);
  const inspectionTimeCost = TIME_SELL + (inspection === "close" ? effectiveInspectTime : 0);

  // ── BUY state ──────────────────────────────────────────────────────────────
  const inventoryItem = inventory.find(i => i.shoeId === shoe.id && i.size === size);
  const [buyOfferInput, setBuyOfferInput] = useState(
    inventoryItem ? String(inventoryItem.listPrice) : ""
  );
  const [buyCounter, setBuyCounter] = useState(null);
  const [buyRound,   setBuyRound]   = useState(0);
  const [buyMsg,     setBuyMsg]     = useState("");

  function tryBuyPrice(price) {
    if (price <= buyMaxPrice) {
      commitResult({
        cashDelta: price,
        inventoryRemove: { shoeId: shoe.id, size },
        inventoryAdd: null,
        outcome: `Sold $${price}`,
        label: `Sold ${shoe.brand} ${shoe.model} ${shoe.colorway} Sz ${size} for $${price}`,
        timeCost: TIME_BUY,
      });
    } else if (traits.haggles && buyRound < traits.haggleRounds) {
      setBuyCounter(buyMaxPrice);
      setBuyRound(r => r + 1);
      setBuyMsg(`They counter at $${buyMaxPrice}.`);
    } else {
      commitResult({
        cashDelta: 0, inventoryRemove: null, inventoryAdd: null,
        outcome: "Walked", label: `BUY customer walked — asked too much`,
        timeCost: TIME_BUY,
      });
    }
  }

  function handleAcceptCounter() {
    commitResult({
      cashDelta: buyCounter,
      inventoryRemove: { shoeId: shoe.id, size },
      inventoryAdd: null,
      outcome: `Sold $${buyCounter}`,
      label: `Sold ${shoe.brand} ${shoe.model} ${shoe.colorway} Sz ${size} for $${buyCounter}`,
      timeCost: TIME_BUY,
    });
  }

  // ── SELL state ─────────────────────────────────────────────────────────────
  const initAsk = Math.round(mktMid * traits.sellAskMult);
  const [sellOfferInput, setSellOfferInput] = useState("");
  const [sellAsk,        setSellAsk]        = useState(initAsk);
  const [sellRound,      setSellRound]      = useState(0);
  const [sellMsg,        setSellMsg]        = useState("");

  function handleSellOffer() {
    const num = Number(sellOfferInput);
    if (!num || num <= 0) return;

    if (num >= sellFloorPrice) {
      const newItem = {
        shoeId: shoe.id, brand: shoe.brand, model: shoe.model,
        colorway: shoe.colorway, size, quantity: 1,
        avgPurchasePrice: num, listPrice: mktMid,
        isFake: inspection === "quick" && customer.isFake,
        daysListed: 0,
      };
      commitResult({
        cashDelta: -num, inventoryRemove: null, inventoryAdd: newItem,
        outcome: `Bought $${num}`,
        label: `Bought ${shoe.brand} ${shoe.model} ${shoe.colorway} Sz ${size} for $${num}`,
        timeCost: inspectionTimeCost,
      });
    } else if (traits.haggles && sellRound < traits.haggleRounds) {
      const newAsk = Math.max(sellFloorPrice, Math.round(sellAsk * 0.96));
      setSellAsk(newAsk);
      setSellRound(r => r + 1);
      setSellOfferInput("");
      setSellMsg(`They come down to $${newAsk}. Make another offer.`);
    } else {
      commitResult({
        cashDelta: 0, inventoryRemove: null, inventoryAdd: null,
        outcome: "Walked", label: `SELL customer walked — offer too low`,
        timeCost: inspectionTimeCost,
      });
    }
  }

  function handlePassOnSell() {
    commitResult({
      cashDelta: 0, inventoryRemove: null, inventoryAdd: null,
      outcome: "Passed",
      label: `Passed on ${shoe.brand} ${shoe.model} ${shoe.colorway} Sz ${size}`,
      timeCost: inspectionTimeCost,
    });
  }

  // ── TRADE state ────────────────────────────────────────────────────────────
  const theirMarket  = mktMid;
  const wantedRange  = customer.wantedMarketRange ?? (() => {
    const wantedBase = dailyMarkets[customer.wantedShoe?.id];
    const adj        = getSizeAdjust(customer.wantedSize ?? 10);
    if (wantedBase && typeof wantedBase === "object") {
      return { low: wantedBase.low + adj, mid: wantedBase.mid + adj, high: wantedBase.high + adj };
    }
    const scalar = (wantedBase ?? 0) + adj;
    return { low: Math.round(scalar * 0.88), mid: scalar, high: Math.round(scalar * 1.12) };
  })();
  const wantedMarket = wantedRange.mid;
  const fairDiff     = Math.round(wantedMarket - theirMarket);

  const [tradeCashInput, setTradeCashInput] = useState(() => {
    if (customer.type !== "TRADE") return "0";
    return String(fairDiff);
  });
  const [tradeMsg, setTradeMsg] = useState("");

  function handleProposeTradeTerms() {
    const cashAdj    = Number(tradeCashInput) || 0;
    const maxCashAdj = wantedMarket - theirMarket * traits.sellFloorMult;

    if (cashAdj <= maxCashAdj) {
      const newItem = {
        shoeId: shoe.id, brand: shoe.brand, model: shoe.model,
        colorway: shoe.colorway, size, quantity: 1,
        avgPurchasePrice: Math.max(0, theirMarket - cashAdj),
        listPrice: theirMarket,
        isFake: inspection === "quick" && customer.isFake,
        daysListed: 0,
      };
      const wantedItem = inventory.find(i => i.shoeId === customer.wantedShoe.id && i.size === customer.wantedSize);
      commitResult({
        cashDelta: cashAdj,
        inventoryRemove: { shoeId: wantedItem.shoeId, size: wantedItem.size },
        inventoryAdd: newItem,
        outcome: "Traded",
        label: `Traded your ${customer.wantedShoe.model} Sz ${customer.wantedSize} for their ${shoe.model} Sz ${size}${cashAdj !== 0 ? ` (${cashAdj > 0 ? "+" : ""}$${cashAdj})` : ""}`,
        timeCost: inspectionTimeCost,
      });
    } else {
      setTradeMsg("They don't think that's fair. Try adjusting the cash.");
    }
  }

  function handlePassOnTrade() {
    commitResult({
      cashDelta: 0, inventoryRemove: null, inventoryAdd: null,
      outcome: "Passed",
      label: `Passed on trade for ${shoe.brand} ${shoe.model} ${shoe.colorway} Sz ${size}`,
      timeCost: inspectionTimeCost,
    });
  }

  // ── Result screen ─────────────────────────────────────────────────────────
  function renderResult() {
    const { result } = pendingResult;
    const { outcome, cashDelta, timeCost } = result;

    let statusCls = "txn-result-neutral";
    if (cashDelta > 0)                   statusCls = "txn-result-positive";
    else if (cashDelta < 0)              statusCls = "txn-result-purchase";
    else if (outcome === "Traded")       statusCls = "txn-result-trade";
    else if (outcome === "Walked")       statusCls = "txn-result-walked";
    else if (outcome.startsWith("Fake")) statusCls = "txn-result-fake";

    return (
      <div className="modal-section txn-result">
        <div className={`txn-result-outcome ${statusCls}`}>{outcome}</div>

        <div className="txn-result-shoe">
          <div className="txn-result-shoe-name">{shoe.brand} {shoe.model} — {shoe.colorway}</div>
          <div className="txn-result-shoe-size">Size {size}</div>
        </div>

        <div className="txn-result-stats">
          {cashDelta !== 0 && (
            <div className="txn-result-stat">
              <div className="txn-result-stat-label">Cash</div>
              <div className={`txn-result-stat-value ${cashDelta > 0 ? "positive" : "negative"}`}>
                {cashDelta > 0 ? "+" : ""}${cashDelta.toLocaleString()}
              </div>
            </div>
          )}
          <div className="txn-result-stat">
            <div className="txn-result-stat-label">Time</div>
            <div className="txn-result-stat-value">{timeCost === 0 ? "—" : `-${timeCost}h`}</div>
          </div>
        </div>

        <button className="primary-btn txn-result-done" onClick={handleDone}>Done →</button>
      </div>
    );
  }

  // ── Inspection gate ────────────────────────────────────────────────────────
  function renderInspectionGate() {
    const canInspect     = hoursLeft >= TIME_SELL + effectiveInspectTime;
    const hasAuthUpgrade = authTier === "app" || authTier === "employee";
    const closeSubLabel  = authTier === "employee"
      ? `Auth employee inspects · costs 0.5h total`
      : authTier === "app"
      ? `Auth app inspects · costs ${(TIME_SELL + effectiveInspectTime).toFixed(2)}h total`
      : `Authenticate shoes · costs 1.0h total`;

    return (
      <div className="modal-section">
        <p className="modal-shoe-name">{shoe.brand} {shoe.model} — {shoe.colorway}</p>
        <p className="modal-size">Size {size}</p>
        <p className="inspection-prompt">How do you want to handle this?</p>
        <div className="inspection-options">
          <button
            className="inspection-btn inspection-close"
            disabled={!canInspect}
            onClick={() => {
              if (customer.isFake) {
                commitResult({
                  cashDelta: 0, inventoryRemove: null, inventoryAdd: null,
                  outcome: "Fake — Rejected",
                  label: `Rejected fake ${shoe.brand} ${shoe.model} ${shoe.colorway} Sz ${size}`,
                  timeCost: TIME_SELL + effectiveInspectTime,
                });
              } else {
                setInspection("close");
              }
            }}
          >
            <span className="inspection-btn-title">
              {authTier === "employee" ? "Inspect (Employee)" : authTier === "app" ? "Inspect (App)" : "Closely Inspect"}
            </span>
            <span className="inspection-btn-sub">{closeSubLabel}</span>
          </button>
          {!hasAuthUpgrade && (
            <button className="inspection-btn inspection-quick" onClick={() => setInspection("quick")}>
              <span className="inspection-btn-title">Quick Look</span>
              <span className="inspection-btn-sub">Skip auth · costs 0.5h total</span>
            </button>
          )}
          <button
            className="inspection-btn inspection-pass"
            onClick={() => commitResult({
              cashDelta: 0, inventoryRemove: null, inventoryAdd: null,
              outcome: "Not Interested",
              label: `Not interested in ${shoe.brand} ${shoe.model} ${shoe.colorway} Sz ${size}`,
              timeCost: 0,
            })}
          >
            <span className="inspection-btn-title">Not Interested</span>
            <span className="inspection-btn-sub">Send them away · no time cost</span>
          </button>
        </div>
        {!canInspect && (
          <p className="inspection-warn">
            {hasAuthUpgrade ? "Not enough time to inspect." : "Not enough time to closely inspect — only Quick Look available."}
          </p>
        )}
      </div>
    );
  }

  // ── BUY render ─────────────────────────────────────────────────────────────
  function renderBuy() {
    if (!inventoryItem) {
      return (
        <div className="modal-section">
          <p className="modal-shoe-name">{shoe.brand} {shoe.model} — {shoe.colorway}</p>
          <p className="modal-size">Size {size}</p>
          <p className="no-stock-msg">You don't have this in stock.</p>
          <button className="secondary-btn" onClick={() =>
            commitResult({
              cashDelta: 0, inventoryRemove: null, inventoryAdd: null,
              outcome: "No stock",
              label: `No stock for ${shoe.model} Sz ${size}`,
              missedShoe: { shoeId: shoe.id, brand: shoe.brand, model: shoe.model, colorway: shoe.colorway, size },
              timeCost: 0,
            })
          }>
            Send Them Off
          </button>
        </div>
      );
    }

    if (inventoryItem.isFake) {
      return (
        <div className="modal-section">
          <p className="modal-shoe-name">{shoe.brand} {shoe.model} — {shoe.colorway}</p>
          <p className="modal-size">Size {size}</p>
          <p className="no-stock-msg">This pair is a fake — it cannot be sold to customers.</p>
          <button className="secondary-btn" onClick={() =>
            commitResult({
              cashDelta: 0, inventoryRemove: null, inventoryAdd: null,
              outcome: "No stock",
              label: `Fake item — couldn't sell ${shoe.model} Sz ${size}`,
              missedShoe: { shoeId: shoe.id, brand: shoe.brand, model: shoe.model, colorway: shoe.colorway, size },
              timeCost: 0,
            })
          }>
            Send Them Off
          </button>
        </div>
      );
    }

    const effectivePrice = buyCounter ?? (Number(buyOfferInput) || inventoryItem.listPrice);
    const profitPct = ((effectivePrice - inventoryItem.avgPurchasePrice) / inventoryItem.avgPurchasePrice) * 100;

    return (
      <div className="modal-section">
        <p className="modal-shoe-name">{shoe.brand} {shoe.model} — {shoe.colorway}</p>
        <p className="modal-size">Size {size}</p>

        <div className="price-grid">
          <div className="price-cell">
            <div className="price-label">Est. Value</div>
            <div className="price-value market-range">${mktLow}–${mktHigh}</div>
          </div>
          <div className="price-cell">
            <div className="price-label">Your Price</div>
            <div className="price-value">${inventoryItem.listPrice}</div>
          </div>
          <div className="price-cell">
            <div className="price-label">Avg Cost</div>
            <div className="price-value">${inventoryItem.avgPurchasePrice}</div>
          </div>
        </div>

        <ProfitBadge pct={profitPct} />

        {buyCounter ? (
          <>
            <p className="counter-msg">{buyMsg}</p>
            <div className="offer-row">
              <button className="primary-btn" onClick={handleAcceptCounter}>
                Accept ${buyCounter}
              </button>
              <button className="secondary-btn" onClick={() =>
                commitResult({
                  cashDelta: 0, inventoryRemove: null, inventoryAdd: null,
                  outcome: "Walked", label: `BUY customer walked after counter`,
                  timeCost: TIME_BUY,
                })
              }>
                Decline (They Walk)
              </button>
            </div>
          </>
        ) : (
          <>
            {buyMsg && <p className="counter-msg">{buyMsg}</p>}
            <div className="offer-row">
              <button className="primary-btn" onClick={() => tryBuyPrice(inventoryItem.listPrice)}>
                Ring Up (${inventoryItem.listPrice})
              </button>
            </div>
            <div className="custom-offer-row">
              <span>Custom: $</span>
              <input
                type="number"
                value={buyOfferInput}
                onChange={e => setBuyOfferInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && tryBuyPrice(Number(buyOfferInput))}
              />
              <button onClick={() => tryBuyPrice(Number(buyOfferInput))}>Offer</button>
            </div>
          </>
        )}
      </div>
    );
  }

  // ── SELL render ────────────────────────────────────────────────────────────
  function renderSell() {
    const offer     = Number(sellOfferInput);
    const profitPct = offer > 0 ? ((mktMid - offer) / mktMid) * 100 : null;

    return (
      <div className="modal-section">
        <p className="modal-shoe-name">{shoe.brand} {shoe.model} — {shoe.colorway}</p>
        <p className="modal-size">Size {size}</p>
        {inspection === "close" && <div className="inspection-tag close">Closely Inspected</div>}

        <div className="price-grid">
          <div className="price-cell">
            <div className="price-label">Est. Value</div>
            <div className="price-value market-range">${mktLow}–${mktHigh}</div>
          </div>
          <div className="price-cell">
            <div className="price-label">Asking</div>
            <div className="price-value">${sellAsk}</div>
          </div>
        </div>

        {sellMsg && <p className="counter-msg">{sellMsg}</p>}

        {inventoryCount >= inventoryCap ? (
          <p className="no-stock-msg">Storage full ({inventoryCap}/{inventoryCap}). Sell something first.</p>
        ) : (
          <>
            <ProfitBadge pct={profitPct} />
            <div className="custom-offer-row">
              <span>Your offer: $</span>
              <input
                type="number"
                value={sellOfferInput}
                onChange={e => setSellOfferInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSellOffer()}
                placeholder="e.g. 150"
              />
              <button onClick={handleSellOffer}>Offer</button>
            </div>
          </>
        )}

        <button className="secondary-btn" onClick={handlePassOnSell}>Pass</button>
      </div>
    );
  }

  // ── TRADE render ───────────────────────────────────────────────────────────
  function renderTrade() {
    const wantedItem = inventory.find(i => i.shoeId === customer.wantedShoe.id && i.size === customer.wantedSize);

    if (!wantedItem) {
      return (
        <div className="modal-section">
          <div className="trade-summary">
            <div>
              <div className="trade-summary-label">They're bringing</div>
              <div className="trade-summary-shoe">{shoe.brand} {shoe.model}</div>
              <div className="trade-summary-mkt">{shoe.colorway} · Sz {size} · ${mktLow}–${mktHigh}</div>
            </div>
            <div className="trade-arrow">⇄</div>
            <div>
              <div className="trade-summary-label">They want</div>
              <div className="trade-summary-shoe">{customer.wantedShoe.brand} {customer.wantedShoe.model}</div>
              <div className="trade-summary-mkt">{customer.wantedShoe.colorway} · Sz {customer.wantedSize} · ~${wantedMarket}</div>
            </div>
          </div>
          <p className="no-stock-msg">You don't have what they want in stock.</p>
          <button className="secondary-btn" onClick={() =>
            commitResult({
              cashDelta: 0, inventoryRemove: null, inventoryAdd: null,
              outcome: "No stock",
              label: `Trade - no stock: ${customer.wantedShoe.model} Sz ${customer.wantedSize}`,
              missedShoe: { shoeId: customer.wantedShoe.id, brand: customer.wantedShoe.brand, model: customer.wantedShoe.model, colorway: customer.wantedShoe.colorway, size: customer.wantedSize },
              timeCost: inspectionTimeCost,
            })
          }>
            Send Them Off
          </button>
        </div>
      );
    }

    return (
      <div className="modal-section">
        {inspection === "close" && <div className="inspection-tag close">Closely Inspected</div>}
        <div className="trade-summary">
          <div>
            <div className="trade-summary-label">They're bringing</div>
            <div className="trade-summary-shoe">{shoe.brand} {shoe.model}</div>
            <div className="trade-summary-mkt">{shoe.colorway} · Sz {size} · ${mktLow}–${mktHigh}</div>
          </div>
          <div className="trade-arrow">⇄</div>
          <div>
            <div className="trade-summary-label">They want</div>
            <div className="trade-summary-shoe">{customer.wantedShoe.brand} {customer.wantedShoe.model}</div>
            <div className="trade-summary-mkt">{customer.wantedShoe.colorway} · Sz {customer.wantedSize} · ~${wantedMarket}</div>
          </div>
        </div>

        <p className="trade-diff-hint">
          At market value:{" "}
          {fairDiff > 0 ? `they'd owe you ~$${fairDiff}` : fairDiff < 0 ? `you'd owe them ~$${Math.abs(fairDiff)}` : "even trade"}
        </p>

        <div className="custom-offer-row">
          <span>Cash you receive (use − if you're paying): $</span>
          <input
            type="number"
            value={tradeCashInput}
            onChange={e => setTradeCashInput(e.target.value)}
            placeholder={String(fairDiff)}
          />
        </div>

        {tradeMsg && <p className="counter-msg">{tradeMsg}</p>}

        <div className="offer-row">
          <button className="primary-btn" onClick={handleProposeTradeTerms}>Propose Trade</button>
          <button className="secondary-btn" onClick={handlePassOnTrade}>Pass</button>
        </div>
      </div>
    );
  }

  // ── Root render ────────────────────────────────────────────────────────────
  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <span className={`type-pill type-${type.toLowerCase()}`}>{type}</span>
          <span className="modal-subtitle">Customer #{customer.id}</span>
          <span className="modal-cash">💰 ${cash.toLocaleString()}</span>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {pendingResult ? (
          renderResult()
        ) : (
          <>
            {type === "BUY"   && renderBuy()}
            {(type === "SELL" || type === "TRADE") && inspection === null && renderInspectionGate()}
            {type === "SELL"  && inspection !== null && renderSell()}
            {type === "TRADE" && inspection !== null && renderTrade()}
          </>
        )}
      </div>
    </div>
  );
}
