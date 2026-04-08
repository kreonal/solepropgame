import { useState } from "react";
import { getSizeAdjust, CATALOG, shoeImageUrl } from "./data";

const BRAND_ORDER  = ["Nike", "Jordan", "Adidas", "New Balance", "Asics"];
const TREND_ICON   = { up: "📈", neutral: "➖", down: "📉" };
const TREND_LABEL  = { up: "Trending Up", neutral: "Stable", down: "Cooling Off" };

export default function InventoryTab({
  inventory,
  setInventory,
  dailyMarkets,
  brandTrends,
  missedDemand,
  canEditPrices,
  onStartDay,
  onRaffle,
  day,
  headerTitle,
  headerSubtitle,
  inventoryCount,
  effectiveInventoryCap = 50,
  featuredShoes,
  onFeatureToggle,
  adActive,
  onBuyAd,
  cash,
  keyMasterShoes = [],
  hasKeyMaster = false,
  onAddToKeyMaster,
}) {
  const [expanded,     setExpanded]     = useState(null);
  const [pendingVault, setPendingVault] = useState([]);

  // Returns { low, mid, high } size-adjusted range
  function getMarket(shoeId, size) {
    const base = dailyMarkets[shoeId];
    if (!base || typeof base !== "object") {
      const scalar = (base ?? 0) + getSizeAdjust(size);
      return { low: Math.round(scalar * 0.88), mid: scalar, high: Math.round(scalar * 1.12) };
    }
    const adj = getSizeAdjust(size);
    return { low: base.low + adj, mid: base.mid + adj, high: base.high + adj };
  }

  function updateListPrice(shoeId, size, val) {
    setInventory(prev =>
      prev.map(item =>
        item.shoeId === shoeId && item.size === size
          ? { ...item, listPrice: Number(val) }
          : item
      )
    );
  }

  // Per-brand quick price setters
  function setPriceForBrand(brand, mode) {
    setInventory(prev => prev.map(item => {
      if (item.brand !== brand) return item;
      const { low, mid, high } = getMarket(item.shoeId, item.size);
      const price =
        mode === "below-low" ? Math.round(low * 0.95) :
        mode === "low"       ? low :
        mode === "mid"       ? mid :
        mode === "high"      ? high : item.listPrice;
      return { ...item, listPrice: price };
    }));
  }

  // Global bulk price setters
  function setAllPrice(mode) {
    setInventory(prev => prev.map(item => {
      const { low, mid, high } = getMarket(item.shoeId, item.size);
      const price =
        mode === "below-low" ? Math.round(low * 0.95) :
        mode === "low"       ? low :
        mode === "mid"       ? mid :
        mode === "high"      ? high : item.listPrice;
      return { ...item, listPrice: price };
    }));
  }

  // Group inventory by shoe, then by brand
  const shoeGroups = [];
  const seen = new Map();
  for (const item of inventory) {
    const key = item.shoeId;
    if (!seen.has(key)) {
      seen.set(key, shoeGroups.length);
      shoeGroups.push({ shoeId: item.shoeId, brand: item.brand, model: item.model, colorway: item.colorway, sizes: [] });
    }
    shoeGroups[seen.get(key)].sizes.push(item);
  }
  for (const g of shoeGroups) {
    g.sizes.sort((a, b) => a.size - b.size);
  }
  shoeGroups.sort((a, b) => {
    const bi = BRAND_ORDER.indexOf(a.brand) - BRAND_ORDER.indexOf(b.brand);
    if (bi !== 0) return bi;
    return a.model.localeCompare(b.model);
  });

  // Group shoe groups by brand
  const byBrand = {};
  for (const g of shoeGroups) {
    if (!byBrand[g.brand]) byBrand[g.brand] = [];
    byBrand[g.brand].push(g);
  }

  const sortedMissed = [...(missedDemand ?? [])].sort((a, b) => b.count - a.count);

  return (
    <div className="container">
      {/* ── Header ── */}
      <div className="inv-header">
        <h2>
          {headerTitle ?? "Inventory"}{" "}
          {!headerTitle && inventoryCount != null && (
            <span className={`inv-count${inventoryCount >= effectiveInventoryCap - 5 ? " inv-count-warn" : ""}`}>
              ({inventoryCount} / {effectiveInventoryCap})
            </span>
          )}
        </h2>
        {canEditPrices && (
          <div className="inv-bulk-actions">
            <span className="bulk-label">All:</span>
            <button className="mkt-btn" onClick={() => setAllPrice("below-low")}>Below Low</button>
            <button className="mkt-btn" onClick={() => setAllPrice("low")}>Low</button>
            <button className="mkt-btn" onClick={() => setAllPrice("mid")}>Mid</button>
            <button className="mkt-btn" onClick={() => setAllPrice("high")}>High</button>
          </div>
        )}
      </div>

      {headerSubtitle && <p className="prices-locked-msg">{headerSubtitle}</p>}
      {!canEditPrices && !headerSubtitle && (
        <p className="prices-locked-msg">Prices lock during the day. Adjust between days.</p>
      )}

      {/* ── Brand sections ── */}
      {BRAND_ORDER.map(brand => {
        const groups = byBrand[brand];
        if (!groups || groups.length === 0) return null;
        const trend = brandTrends?.[brand];

        return (
          <div key={brand} className="brand-section">
            <div className="brand-section-header">
              <div className="brand-section-left">
                <span className="brand-section-name">{brand}</span>
                {trend && (
                  <span className={`brand-trend-badge trend-${trend.direction}`}>
                    {TREND_ICON[trend.direction]} {TREND_LABEL[trend.direction]}
                  </span>
                )}
              </div>
              {canEditPrices && (
                <div className="brand-price-btns">
                  <button className="mkt-btn mkt-btn-sm" onClick={() => setPriceForBrand(brand, "below-low")}>Below Low</button>
                  <button className="mkt-btn mkt-btn-sm" onClick={() => setPriceForBrand(brand, "low")}>Low</button>
                  <button className="mkt-btn mkt-btn-sm" onClick={() => setPriceForBrand(brand, "mid")}>Mid</button>
                  <button className="mkt-btn mkt-btn-sm" onClick={() => setPriceForBrand(brand, "high")}>High</button>
                </div>
              )}
            </div>

            {groups.map((group, gi) => {
              const groupKey      = `${brand}-${gi}`;
              const isExpanded    = expanded === groupKey;
              const totalQty      = group.sizes.reduce((s, i) => s + i.quantity, 0);
              const avgListPrice  = Math.round(group.sizes.reduce((s, i) => s + i.listPrice * i.quantity, 0) / totalQty);
              const maxDaysListed = Math.max(...group.sizes.map(i => i.daysListed ?? 0));
              const totalCost     = group.sizes.reduce((s, i) => s + i.avgPurchasePrice * i.quantity, 0);
              const totalList     = group.sizes.reduce((s, i) => s + i.listPrice * i.quantity, 0);
              const profitPct     = totalCost > 0 ? ((totalList - totalCost) / totalCost) * 100 : null;
              const profitCls     = profitPct == null ? "" : profitPct >= 15 ? "profit-green" : profitPct >= 0 ? "profit-yellow" : "profit-red";

              return (
                <div key={group.shoeId} className="card">
                  <div className="card-header" onClick={() => setExpanded(isExpanded ? null : groupKey)}>
                    <div className="inv-thumb-wrap">
                      <img
                        className="inv-thumb"
                        src={shoeImageUrl(group.shoeId)}
                        alt=""
                        onError={e => { e.target.parentElement.style.display = "none"; }}
                      />
                    </div>
                    <div className="shoe-info">
                      <span className="shoe-name">{group.model} — {group.colorway}</span>
                      <div className="card-sub-row">
                        {maxDaysListed >= 3 && (
                          <span className={`days-listed-badge${maxDaysListed >= 7 ? " stale" : ""}`}>
                            {maxDaysListed}d listed
                          </span>
                        )}
                        {canEditPrices && profitPct != null && (
                          <span className={`card-profit-inline ${profitCls}`}>
                            {profitPct >= 0 ? "+" : ""}{profitPct.toFixed(1)}% margin
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="card-right">
                      <span className="inv-summary">{totalQty} pair{totalQty !== 1 ? "s" : ""}</span>
                      <span className="inv-avg-price">Avg. List ${avgListPrice}</span>
                    </div>
                    <span className="chevron">{isExpanded ? "▲" : "▼"}</span>
                  </div>

                  {isExpanded && (
                    <div className="size-table">
                      <div className="size-table-header">
                        <span>Size</span>
                        <span>Qty</span>
                        <span>Market</span>
                        <span>Cost</span>
                        <span>List Price</span>
                      </div>
                      {group.sizes.map(item => {
                        const { low, mid, high } = getMarket(item.shoeId, item.size);
                        const delta      = item.listPrice - mid;
                        const deltaClass = delta > 0 ? "above" : delta < 0 ? "below" : "at-market";
                        return (
                          <div key={item.size} className="size-table-row">
                            <span className="size-col">{item.size}</span>
                            <span className="qty-col">×{item.quantity}</span>
                            <span className="mkt-col">
                              <span className="market-range">${low}–{high}</span>
                              {(item.daysListed ?? 0) > 0 && (
                                <span className="days-listed">{item.daysListed}d listed</span>
                              )}
                            </span>
                            <span className="cost-col">${item.avgPurchasePrice}</span>
                            <span className="list-price-col">
                              {canEditPrices ? (
                                <input
                                  type="number"
                                  value={item.listPrice}
                                  onChange={e => updateListPrice(item.shoeId, item.size, e.target.value)}
                                />
                              ) : (
                                <span className={`list-price-display ${deltaClass}`}>
                                  ${item.listPrice}
                                  <span className="price-delta">
                                    {delta === 0 ? "at mid" : `mid $${mid}`}
                                  </span>
                                </span>
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}

      {inventory.length === 0 && (
        <p className="empty-state">No inventory yet. Buy from customers to get started.</p>
      )}

      {/* ── Marketing ── */}
      {onFeatureToggle && (
        <>
          <h3>Marketing</h3>
          <div className="marketing-card card">
            <div className="marketing-card-top">
              <div>
                <div className="marketing-card-title">End of Day Inventory Photo</div>
                <div className="marketing-card-desc">Feature up to 10 pairs — guarantees a buyer for each next day.</div>
              </div>
              <span className="marketing-card-badge free-badge">FREE</span>
            </div>
            <div className="feature-chip-grid">
              {inventory.map(item => {
                const isFeatured = featuredShoes.some(f => f.shoeId === item.shoeId && f.size === item.size);
                const atCap = !isFeatured && featuredShoes.length >= 10;
                return (
                  <button
                    key={`${item.shoeId}-${item.size}`}
                    className={`feature-chip${isFeatured ? " selected" : ""}${atCap ? " disabled" : ""}`}
                    disabled={atCap}
                    onClick={() => onFeatureToggle(item.shoeId, item.size)}
                  >
                    {item.model} Sz {item.size}
                  </button>
                );
              })}
              {inventory.length === 0 && <p className="marketing-empty">No inventory to feature.</p>}
            </div>
            <div className="marketing-card-footer">{featuredShoes.length} / 10 featured</div>
          </div>

          <div className={`marketing-card card${adActive ? " marketing-card-active" : ""}`}>
            <div className="marketing-card-top">
              <div>
                <div className="marketing-card-title">Targeted Ad — "We Want Your Shoes!"</div>
                <div className="marketing-card-desc">
                  {adActive
                    ? "Active — tomorrow's lineup flips to 5 buyers, 15 sellers, 10 traders."
                    : "Flips tomorrow's customer mix: 5 buyers, 15 sellers, 10 traders."}
                </div>
              </div>
              <span className="marketing-card-badge paid-badge">$100</span>
            </div>
            {!adActive && (
              <button className="primary-btn" disabled={cash < 100} onClick={onBuyAd}>
                {cash < 100 ? "Not enough cash" : "Run Ad — $100"}
              </button>
            )}
            {adActive && <div className="marketing-active-tag">Ad purchased ✓</div>}
          </div>
        </>
      )}

      {/* ── Missed demand ── */}
      {sortedMissed.length > 0 && (
        <>
          <h3>What People Are Looking For</h3>
          <div className="missed-list">
            {sortedMissed.map(d => (
              <div key={`${d.shoeId}-${d.size}`} className="missed-row">
                <div className="missed-shoe">
                  <span className="shoe-brand">{d.brand}</span>
                  <span className="missed-name">{d.model} — {d.colorway} Sz {d.size}</span>
                </div>
                <span className="missed-count">{d.count}×</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Key Master Vault ── */}
      <h3>Key Master</h3>
      {!hasKeyMaster ? (
        <div className="km-locked-card card">
          <div className="km-locked-title">Key Master Vault</div>
          <div className="km-locked-desc">Unlock in the Growth tab to earn passive income from your rarest shoes.</div>
        </div>
      ) : (
        <div className="km-section">
          <div className="km-header">
            <div className="km-slot-count">{keyMasterShoes.length} / 10 shoes</div>
            {keyMasterShoes.length > 0 && (
              <div className="km-daily-total">
                +${keyMasterShoes.reduce((s, shoe) => {
                  const mktLow = dailyMarkets[shoe.shoeId]?.low ?? 0;
                  return s + Math.round(mktLow * 0.02);
                }, 0)}/day
              </div>
            )}
          </div>

          {keyMasterShoes.map(shoe => {
            const mktLow    = dailyMarkets[shoe.shoeId]?.low ?? 0;
            const dailyRate = Math.round(mktLow * 0.02);
            return (
              <div key={`${shoe.shoeId}-${shoe.size}`} className="km-shoe-row card">
                <div className="km-shoe-info">
                  <div className="km-shoe-name">{shoe.brand} {shoe.model} — {shoe.colorway}</div>
                  <div className="km-shoe-meta">Sz {shoe.size} · Mkt Low ${mktLow}</div>
                  <div className="km-shoe-earnings">
                    <span className="km-daily-rate">+${dailyRate}/day</span>
                    <span className="km-total-earned">Total earned: ${shoe.totalEarned}</span>
                  </div>
                </div>
                <div className="km-win-chance">1% win/day</div>
              </div>
            );
          })}

          {canEditPrices && (
            <>
              <div className="km-add-label">Add to Key Master:</div>
              <div className="km-add-grid">
                {inventory.map(item => {
                  const alreadyVaulted = keyMasterShoes.some(s => s.shoeId === item.shoeId && s.size === item.size);
                  const isPending      = pendingVault.some(p => p.shoeId === item.shoeId && p.size === item.size);
                  const atCap          = !isPending && keyMasterShoes.length + pendingVault.length >= 10;
                  return (
                    <button
                      key={`${item.shoeId}-${item.size}`}
                      className={`feature-chip${alreadyVaulted || atCap ? " disabled" : ""}${isPending ? " selected" : ""}`}
                      disabled={alreadyVaulted || atCap}
                      onClick={() => {
                        if (alreadyVaulted || atCap) return;
                        setPendingVault(prev =>
                          isPending
                            ? prev.filter(p => !(p.shoeId === item.shoeId && p.size === item.size))
                            : [...prev, item]
                        );
                      }}
                    >
                      {item.model} Sz {item.size}
                    </button>
                  );
                })}
                {inventory.length === 0 && <p className="marketing-empty">No inventory to vault.</p>}
              </div>
              {pendingVault.length > 0 && (
                <button
                  className="primary-btn km-vault-confirm-btn"
                  onClick={() => { pendingVault.forEach(item => onAddToKeyMaster(item)); setPendingVault([]); }}
                >
                  Add {pendingVault.length} shoe{pendingVault.length !== 1 ? "s" : ""} to vault — permanent
                </button>
              )}
            </>
          )}

          {!canEditPrices && <p className="km-day-note">Manage vault between days.</p>}
        </div>
      )}

      {(onStartDay || onRaffle) && (
        <div className="start-day-footer" style={{ gap: 8 }}>
          {onRaffle && (
            <button className="secondary-btn raffle-cta-btn" onClick={onRaffle}>
              Weekly Raffles →
            </button>
          )}
          {onStartDay && (
            <button className="primary-btn" onClick={onStartDay} style={{ flex: 1 }}>
              Open Shop — Start Day {day} →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
