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

  // Normalize items array — fallback for legacy customers without items
  const customerItems = customer.items ?? [{ shoe, size, marketRange: resolvedRange, isFake: customer.isFake }];
  const isMultiItem = customerItems.length > 1;

  const effectiveInspectTime =
    authTier === "employee" ? 0 :
    authTier === "app"      ? TIME_INSPECT / 2 :
    TIME_INSPECT;

  // Per-item max/floor, then summed for total negotiation
  function itemBuyMax(item) {
    return Math.round(item.marketRange.mid * (customer.marketingBoosted ? traits.buyMaxMult * 1.12 : traits.buyMaxMult));
  }
  function itemSellFloor(item) {
    return Math.round(item.marketRange.mid * traits.sellFloorMult);
  }
  function itemSellAsk(item) {
    return Math.round(item.marketRange.mid * traits.sellAskMult);
  }

  // Single-item helpers (used by legacy single-item logic)
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
  // Resolve inventory items for each requested item
  const buyItemsResolved = customerItems.map(ci => ({
    ...ci,
    inventoryItem: inventory.find(i => i.shoeId === ci.shoe.id && i.size === ci.size) ?? null,
  }));
  const buyInStock = buyItemsResolved.filter(ci => ci.inventoryItem && !ci.inventoryItem.isFake);
  const totalBuyMax = buyInStock.reduce((sum, ci) => sum + itemBuyMax(ci), 0);
  const totalListPrice = buyInStock.reduce((sum, ci) => sum + ci.inventoryItem.listPrice, 0);

  // Single-item compat
  const inventoryItem = buyItemsResolved[0]?.inventoryItem ?? null;

  const [buyOfferInput, setBuyOfferInput] = useState(
    isMultiItem ? String(totalListPrice) : (inventoryItem ? String(inventoryItem.listPrice) : "")
  );
  const [buyCounter, setBuyCounter] = useState(null);
  const [buyRound,   setBuyRound]   = useState(0);
  const [buyMsg,     setBuyMsg]     = useState("");

  function tryBuyPrice(price) {
    const maxPrice = isMultiItem ? totalBuyMax : buyMaxPrice;
    if (price <= maxPrice) {
      if (isMultiItem) {
        const removes = buyInStock.map(ci => ({ shoeId: ci.shoe.id, size: ci.size }));
        const label = buyInStock.length === 1
          ? `Sold ${buyInStock[0].shoe.brand} ${buyInStock[0].shoe.model} ${buyInStock[0].shoe.colorway} Sz ${buyInStock[0].size} for $${price}`
          : `Sold ${buyInStock.length} items for $${price}`;
        commitResult({
          cashDelta: price,
          inventoryRemoves: removes,
          inventoryAdds: [],
          outcome: `Sold $${price}`,
          label,
          timeCost: TIME_BUY,
        });
      } else {
        commitResult({
          cashDelta: price,
          inventoryRemoves: [{ shoeId: shoe.id, size }],
          inventoryAdds: [],
          outcome: `Sold $${price}`,
          label: `Sold ${shoe.brand} ${shoe.model} ${shoe.colorway} Sz ${size} for $${price}`,
          timeCost: TIME_BUY,
        });
      }
    } else if (traits.haggles && buyRound < traits.haggleRounds) {
      setBuyCounter(maxPrice);
      setBuyRound(r => r + 1);
      setBuyMsg(`They counter at $${maxPrice}.`);
    } else {
      commitResult({
        cashDelta: 0, inventoryRemoves: [], inventoryAdds: [],
        outcome: "Walked", label: `BUY customer walked — asked too much`,
        timeCost: TIME_BUY,
      });
    }
  }

  function handleAcceptCounter() {
    if (isMultiItem) {
      const removes = buyInStock.map(ci => ({ shoeId: ci.shoe.id, size: ci.size }));
      const label = buyInStock.length === 1
        ? `Sold ${buyInStock[0].shoe.brand} ${buyInStock[0].shoe.model} ${buyInStock[0].shoe.colorway} Sz ${buyInStock[0].size} for $${buyCounter}`
        : `Sold ${buyInStock.length} items for $${buyCounter}`;
      commitResult({
        cashDelta: buyCounter,
        inventoryRemoves: removes,
        inventoryAdds: [],
        outcome: `Sold $${buyCounter}`,
        label,
        timeCost: TIME_BUY,
      });
    } else {
      commitResult({
        cashDelta: buyCounter,
        inventoryRemoves: [{ shoeId: shoe.id, size }],
        inventoryAdds: [],
        outcome: `Sold $${buyCounter}`,
        label: `Sold ${shoe.brand} ${shoe.model} ${shoe.colorway} Sz ${size} for $${buyCounter}`,
        timeCost: TIME_BUY,
      });
    }
  }

  // ── SELL state ─────────────────────────────────────────────────────────────
  const totalInitAsk   = customerItems.reduce((sum, ci) => sum + itemSellAsk(ci), 0);
  const totalSellFloor = customerItems.reduce((sum, ci) => sum + itemSellFloor(ci), 0);
  const initAsk = Math.round(mktMid * traits.sellAskMult); // single-item compat

  const [sellOfferInput, setSellOfferInput] = useState("");
  const [sellAsk,        setSellAsk]        = useState(isMultiItem ? totalInitAsk : initAsk);
  const [sellRound,      setSellRound]      = useState(0);
  const [sellMsg,        setSellMsg]        = useState("");

  function handleSellOffer() {
    const num = Number(sellOfferInput);
    if (!num || num <= 0) return;

    const floorPrice = isMultiItem ? totalSellFloor : sellFloorPrice;

    if (num >= floorPrice) {
      if (isMultiItem) {
        const adds = customerItems.map((ci, k) => ({
          shoeId: ci.shoe.id, brand: ci.shoe.brand, model: ci.shoe.model,
          colorway: ci.shoe.colorway, size: ci.size, quantity: 1,
          avgPurchasePrice: Math.round(num / customerItems.length),
          listPrice: ci.marketRange.mid,
          isFake: inspection === "quick" && ci.isFake,
          daysListed: 0,
        }));
        const label = customerItems.length === 1
          ? `Bought ${customerItems[0].shoe.brand} ${customerItems[0].shoe.model} ${customerItems[0].shoe.colorway} Sz ${customerItems[0].size} for $${num}`
          : `Bought ${customerItems.length} items for $${num}`;
        commitResult({
          cashDelta: -num, inventoryRemoves: [], inventoryAdds: adds,
          outcome: `Bought $${num}`,
          label,
          timeCost: inspectionTimeCost,
        });
      } else {
        const newItem = {
          shoeId: shoe.id, brand: shoe.brand, model: shoe.model,
          colorway: shoe.colorway, size, quantity: 1,
          avgPurchasePrice: num, listPrice: mktMid,
          isFake: inspection === "quick" && customer.isFake,
          daysListed: 0,
        };
        commitResult({
          cashDelta: -num, inventoryRemoves: [], inventoryAdds: [newItem],
          outcome: `Bought $${num}`,
          label: `Bought ${shoe.brand} ${shoe.model} ${shoe.colorway} Sz ${size} for $${num}`,
          timeCost: inspectionTimeCost,
        });
      }
    } else if (traits.haggles && sellRound < traits.haggleRounds) {
      const newAsk = Math.max(floorPrice, Math.round(sellAsk * 0.96));
      setSellAsk(newAsk);
      setSellRound(r => r + 1);
      setSellOfferInput("");
      setSellMsg(`They come down to $${newAsk}. Make another offer.`);
    } else {
      commitResult({
        cashDelta: 0, inventoryRemoves: [], inventoryAdds: [],
        outcome: "Walked", label: `SELL customer walked — offer too low`,
        timeCost: inspectionTimeCost,
      });
    }
  }

  function handlePassOnSell() {
    const label = isMultiItem
      ? `Passed on ${customerItems.length} items`
      : `Passed on ${shoe.brand} ${shoe.model} ${shoe.colorway} Sz ${size}`;
    commitResult({
      cashDelta: 0, inventoryRemoves: [], inventoryAdds: [],
      outcome: "Passed",
      label,
      timeCost: inspectionTimeCost,
    });
  }

  // ── TRADE state ────────────────────────────────────────────────────────────
  // Combined market value of all items customer brings
  const combinedTheirMarket = customerItems.reduce((sum, ci) => sum + ci.marketRange.mid, 0);
  const theirMarket  = combinedTheirMarket; // alias used below

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
      const adds = customerItems.map(ci => ({
        shoeId: ci.shoe.id, brand: ci.shoe.brand, model: ci.shoe.model,
        colorway: ci.shoe.colorway, size: ci.size, quantity: 1,
        avgPurchasePrice: Math.max(0, Math.round((theirMarket - cashAdj) / customerItems.length)),
        listPrice: ci.marketRange.mid,
        isFake: inspection === "quick" && ci.isFake,
        daysListed: 0,
      }));
      const wantedItem = inventory.find(i => i.shoeId === customer.wantedShoe.id && i.size === customer.wantedSize);
      const theyBringing = customerItems.length === 1
        ? `${customerItems[0].shoe.model} Sz ${customerItems[0].size}`
        : `${customerItems.length} items`;
      commitResult({
        cashDelta: cashAdj,
        inventoryRemoves: [{ shoeId: wantedItem.shoeId, size: wantedItem.size }],
        inventoryAdds: adds,
        outcome: "Traded",
        label: `Traded your ${customer.wantedShoe.model} Sz ${customer.wantedSize} for their ${theyBringing}${cashAdj !== 0 ? ` (${cashAdj > 0 ? "+" : ""}$${cashAdj})` : ""}`,
        timeCost: inspectionTimeCost,
      });
    } else {
      setTradeMsg("They don't think that's fair. Try adjusting the cash.");
    }
  }

  function handlePassOnTrade() {
    commitResult({
      cashDelta: 0, inventoryRemoves: [], inventoryAdds: [],
      outcome: "Passed",
      label: `Passed on trade for ${shoe.brand} ${shoe.model} ${shoe.colorway} Sz ${size}`,
      timeCost: inspectionTimeCost,
    });
  }

  // ── Result screen ─────────────────────────────────────────────────────────
  function renderResult() {
    const { result } = pendingResult;
    const { outcome, cashDelta, timeCost, label } = result;

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
          <div className="txn-result-shoe-name">{label}</div>
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
    const hasFake = customerItems.some(ci => ci.isFake);

    return (
      <div className="modal-section">
        {isMultiItem ? (
          <>
            <p className="modal-shoe-name">{customerItems.length} items</p>
            <div className="multi-item-list">
              {customerItems.map((ci, k) => (
                <div key={k} className="multi-item-row">
                  <span className="multi-item-name">{ci.shoe.brand} {ci.shoe.model} — {ci.shoe.colorway}</span>
                  <span className="multi-item-size">Sz {ci.size}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="modal-shoe-name">{shoe.brand} {shoe.model} — {shoe.colorway}</p>
            <p className="modal-size">Size {size}</p>
          </>
        )}
        <p className="inspection-prompt">How do you want to handle this?</p>
        <div className="inspection-options">
          <button
            className="inspection-btn inspection-close"
            disabled={!canInspect}
            onClick={() => {
              if (hasFake) {
                const fakeItems = customerItems.filter(ci => ci.isFake);
                commitResult({
                  cashDelta: 0, inventoryRemoves: [], inventoryAdds: [],
                  outcome: "Fake — Rejected",
                  label: fakeItems.length === customerItems.length
                    ? `Rejected fake ${shoe.brand} ${shoe.model} ${shoe.colorway} Sz ${size}`
                    : `Rejected — fake found in batch of ${customerItems.length}`,
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
              cashDelta: 0, inventoryRemoves: [], inventoryAdds: [],
              outcome: "Not Interested",
              label: isMultiItem
                ? `Not interested in ${customerItems.length} items`
                : `Not interested in ${shoe.brand} ${shoe.model} ${shoe.colorway} Sz ${size}`,
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
    // If none of the requested items are in stock, send them off
    if (buyInStock.length === 0) {
      const missedShoes = buyItemsResolved.map(ci => ({
        shoeId: ci.shoe.id, brand: ci.shoe.brand, model: ci.shoe.model,
        colorway: ci.shoe.colorway, size: ci.size,
      }));
      return (
        <div className="modal-section">
          {isMultiItem ? (
            <>
              <p className="modal-shoe-name">{customerItems.length} items wanted</p>
              <div className="multi-item-list">
                {buyItemsResolved.map((ci, k) => (
                  <div key={k} className="multi-item-row">
                    <span className="multi-item-name">{ci.shoe.brand} {ci.shoe.model} — {ci.shoe.colorway}</span>
                    <span className="multi-item-size">Sz {ci.size}</span>
                    <span className="multi-item-status out">Out of stock</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <p className="modal-shoe-name">{shoe.brand} {shoe.model} — {shoe.colorway}</p>
              <p className="modal-size">Size {size}</p>
              <p className="no-stock-msg">{inventoryItem?.isFake ? "This pair is a fake — it cannot be sold." : "You don't have this in stock."}</p>
            </>
          )}
          <button className="secondary-btn" onClick={() =>
            commitResult({
              cashDelta: 0, inventoryRemoves: [], inventoryAdds: [],
              outcome: "No stock",
              label: isMultiItem ? `No stock for ${customerItems.length} requested items` : `No stock for ${shoe.model} Sz ${size}`,
              missedShoes,
              timeCost: 0,
            })
          }>
            Send Them Off
          </button>
        </div>
      );
    }

    if (isMultiItem) {
      const effectiveTotal = buyCounter ?? (Number(buyOfferInput) || totalListPrice);
      const totalCost = buyInStock.reduce((sum, ci) => sum + ci.inventoryItem.avgPurchasePrice, 0);
      const profitPct = totalCost > 0 ? ((effectiveTotal - totalCost) / totalCost) * 100 : null;

      return (
        <div className="modal-section">
          <p className="modal-shoe-name">{buyInStock.length} item{buyInStock.length > 1 ? "s" : ""} wanted</p>
          <div className="multi-item-list">
            {buyItemsResolved.map((ci, k) => {
              const inStock = ci.inventoryItem && !ci.inventoryItem.isFake;
              return (
                <div key={k} className="multi-item-row">
                  <span className="multi-item-name">{ci.shoe.brand} {ci.shoe.model} — {ci.shoe.colorway}</span>
                  <span className="multi-item-size">Sz {ci.size}</span>
                  <span className={`multi-item-status ${inStock ? "in" : "out"}`}>{inStock ? `$${ci.inventoryItem.listPrice}` : "Out of stock"}</span>
                </div>
              );
            })}
          </div>
          <div className="price-grid">
            <div className="price-cell">
              <div className="price-label">Total Value</div>
              <div className="price-value market-range">${buyInStock.reduce((s, ci) => s + ci.marketRange.low, 0)}–${buyInStock.reduce((s, ci) => s + ci.marketRange.high, 0)}</div>
            </div>
            <div className="price-cell">
              <div className="price-label">List Total</div>
              <div className="price-value">${totalListPrice}</div>
            </div>
            <div className="price-cell">
              <div className="price-label">Cost Total</div>
              <div className="price-value">${totalCost}</div>
            </div>
          </div>
          <ProfitBadge pct={profitPct} />
          {buyCounter ? (
            <>
              <p className="counter-msg">{buyMsg}</p>
              <div className="offer-row">
                <button className="primary-btn" onClick={handleAcceptCounter}>Accept ${buyCounter}</button>
                <button className="secondary-btn" onClick={() =>
                  commitResult({ cashDelta: 0, inventoryRemoves: [], inventoryAdds: [], outcome: "Walked", label: `BUY customer walked after counter`, timeCost: TIME_BUY })
                }>Decline (They Walk)</button>
              </div>
            </>
          ) : (
            <>
              {buyMsg && <p className="counter-msg">{buyMsg}</p>}
              <div className="offer-row">
                <button className="primary-btn" onClick={() => tryBuyPrice(totalListPrice)}>Ring Up (${totalListPrice})</button>
              </div>
              <div className="custom-offer-row">
                <span>Custom total: $</span>
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

    // Single-item BUY (original flow)
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
                  cashDelta: 0, inventoryRemoves: [], inventoryAdds: [],
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
    const offer       = Number(sellOfferInput);
    const totalMktMid = customerItems.reduce((s, ci) => s + ci.marketRange.mid, 0);
    const profitPct   = offer > 0 ? ((totalMktMid - offer) / totalMktMid) * 100 : null;

    return (
      <div className="modal-section">
        {isMultiItem ? (
          <>
            <p className="modal-shoe-name">{customerItems.length} items</p>
            <div className="multi-item-list">
              {customerItems.map((ci, k) => (
                <div key={k} className="multi-item-row">
                  <span className="multi-item-name">{ci.shoe.brand} {ci.shoe.model} — {ci.shoe.colorway}</span>
                  <span className="multi-item-size">Sz {ci.size}</span>
                  <span className="multi-item-mkt">${ci.marketRange.low}–${ci.marketRange.high}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="modal-shoe-name">{shoe.brand} {shoe.model} — {shoe.colorway}</p>
            <p className="modal-size">Size {size}</p>
          </>
        )}
        {inspection === "close" && <div className="inspection-tag close">Closely Inspected</div>}

        <div className="price-grid">
          <div className="price-cell">
            <div className="price-label">{isMultiItem ? "Total Value" : "Est. Value"}</div>
            <div className="price-value market-range">
              {isMultiItem
                ? `$${customerItems.reduce((s, ci) => s + ci.marketRange.low, 0)}–$${customerItems.reduce((s, ci) => s + ci.marketRange.high, 0)}`
                : `$${mktLow}–${mktHigh}`}
            </div>
          </div>
          <div className="price-cell">
            <div className="price-label">{isMultiItem ? "Total Asking" : "Asking"}</div>
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
              <span>{isMultiItem ? "Your total offer: $" : "Your offer: $"}</span>
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

    const theyBringingSection = isMultiItem ? (
      <div>
        <div className="trade-summary-label">They're bringing ({customerItems.length} items · ~${theirMarket} total)</div>
        <div className="multi-item-list">
          {customerItems.map((ci, k) => (
            <div key={k} className="multi-item-row">
              <span className="multi-item-name">{ci.shoe.brand} {ci.shoe.model} — {ci.shoe.colorway}</span>
              <span className="multi-item-size">Sz {ci.size}</span>
              <span className="multi-item-mkt">~${ci.marketRange.mid}</span>
            </div>
          ))}
        </div>
      </div>
    ) : (
      <div>
        <div className="trade-summary-label">They're bringing</div>
        <div className="trade-summary-shoe">{shoe.brand} {shoe.model}</div>
        <div className="trade-summary-mkt">{shoe.colorway} · Sz {size} · ${mktLow}–${mktHigh}</div>
      </div>
    );

    if (!wantedItem) {
      return (
        <div className="modal-section">
          <div className="trade-summary">
            {theyBringingSection}
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
              cashDelta: 0, inventoryRemoves: [], inventoryAdds: [],
              outcome: "No stock",
              label: `Trade - no stock: ${customer.wantedShoe.model} Sz ${customer.wantedSize}`,
              missedShoes: [{ shoeId: customer.wantedShoe.id, brand: customer.wantedShoe.brand, model: customer.wantedShoe.model, colorway: customer.wantedShoe.colorway, size: customer.wantedSize }],
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
          {theyBringingSection}
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
