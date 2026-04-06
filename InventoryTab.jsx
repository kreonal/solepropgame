import { useState } from "react";
import { getSizeAdjust, CATALOG } from "./data";

const TREND_ICON  = { up: "📈", neutral: "➖", down: "📉" };
const TREND_LABEL = { up: "Trending Up", neutral: "Stable", down: "Cooling Off" };

// Build brand → [styles] mapping from static catalog (computed once at module level)
const STYLES_BY_BRAND = {};
for (const shoe of CATALOG) {
  if (!shoe.style || !shoe.brand) continue;
  if (!STYLES_BY_BRAND[shoe.brand]) STYLES_BY_BRAND[shoe.brand] = new Set();
  STYLES_BY_BRAND[shoe.brand].add(shoe.style);
}
for (const brand in STYLES_BY_BRAND) {
  STYLES_BY_BRAND[brand] = [...STYLES_BY_BRAND[brand]].sort();
}

export default function InventoryTab({
  inventory,
  setInventory,
  dailyMarkets,
  brandTrends,
  styleTrends,
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
  const [expanded,       setExpanded]       = useState(null);
  const [pendingVault,   setPendingVault]   = useState([]);
  const [expandedBrands, setExpandedBrands] = useState(new Set());

  function toggleBrand(brand) {
    setExpandedBrands(prev => {
      const next = new Set(prev);
      if (next.has(brand)) next.delete(brand); else next.add(brand);
      return next;
    });
  }

  // Returns { low, mid, high } size-adjusted range
  function getMarket(shoeId, size) {
    const base = dailyMarkets[shoeId];
    if (!base || typeof base !== "object") {
      // Legacy scalar fallback
      const scalar = (base ?? 0) + getSizeAdjust(size);
      return { low: Math.round(scalar * 0.88), mid: scalar, high: Math.round(scalar * 1.12) };
    }
    const adj = getSizeAdjust(size);
    return {
      low:  base.low  + adj,
      mid:  base.mid  + adj,
      high: base.high + adj,
    };
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

  // Bulk price setters (5 options)
  function setAllToHigh()      { setInventory(prev => prev.map(i => ({ ...i, listPrice: getMarket(i.shoeId, i.size).high }))); }
  function setAllToMid()       { setInventory(prev => prev.map(i => ({ ...i, listPrice: getMarket(i.shoeId, i.size).mid }))); }
  function setAllTo20Profit()  { setInventory(prev => prev.map(i => ({ ...i, listPrice: Math.round(i.avgPurchasePrice * 1.20) }))); }
  function setAllToLow()       { setInventory(prev => prev.map(i => ({ ...i, listPrice: getMarket(i.shoeId, i.size).low }))); }
  function setAllTo10BelowLow(){ setInventory(prev => prev.map(i => ({ ...i, listPrice: Math.round(getMarket(i.shoeId, i.size).low * 0.90) }))); }


  // Group flat inventory items by shoe
  const shoeGroups = [];
  const seen = new Map();
  for (const item of inventory) {
    const key = item.shoeId;
    if (!seen.has(key)) {
      seen.set(key, shoeGroups.length);
      shoeGroups.push({
        shoeId: item.shoeId,
        brand: item.brand,
        model: item.model,
        colorway: item.colorway,
        sizes: [],
      });
    }
    shoeGroups[seen.get(key)].sizes.push(item);
  }
  for (const g of shoeGroups) {
    g.sizes.sort((a, b) => a.size - b.size);
  }

  const sortedMissed = [...(missedDemand ?? [])].sort((a, b) => b.count - a.count);

  return (
    <div className="container">
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
            <button className="mkt-btn" onClick={setAllToHigh}>Mkt High</button>
            <button className="mkt-btn" onClick={setAllToMid}>Midpoint</button>
            <button className="mkt-btn" onClick={setAllTo20Profit}>+20% cost</button>
            <button className="mkt-btn" onClick={setAllToLow}>Mkt Low</button>
            <button className="mkt-btn" onClick={setAllTo10BelowLow}>−10% Low</button>
          </div>
        )}
      </div>

      {headerSubtitle && <p className="prices-locked-msg">{headerSubtitle}</p>}
      {!canEditPrices && !headerSubtitle && (
        <p className="prices-locked-msg">Prices lock during the day. Adjust between days.</p>
      )}

      {shoeGroups.map((group, gi) => {
        const isExpanded = expanded === gi;
        const totalQty = group.sizes.reduce((s, i) => s + i.quantity, 0);
        const prices = group.sizes.map(i => i.listPrice);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const priceDisplay = minPrice === maxPrice ? `$${minPrice}` : `$${minPrice}–${maxPrice}`;

        return (
          <div key={group.shoeId} className="card">
            <div className="card-header" onClick={() => setExpanded(isExpanded ? null : gi)}>
              <div className="shoe-info">
                <span className="shoe-brand">{group.brand}</span>
                <span className="shoe-name">{group.model} — {group.colorway}</span>
              </div>
              <div className="card-right">
                <span className="inv-summary">{totalQty} pairs · {priceDisplay}</span>
                <span className="chevron">{isExpanded ? "▲" : "▼"}</span>
              </div>
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

      {onFeatureToggle && (
        <>
          <h3>Marketing</h3>

          {/* Inventory Photo */}
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
              {inventory.length === 0 && (
                <p className="marketing-empty">No inventory to feature.</p>
              )}
            </div>
            <div className="marketing-card-footer">
              {featuredShoes.length} / 10 featured
            </div>
          </div>

          {/* Targeted Ad */}
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
              <button
                className="primary-btn"
                disabled={cash < 100}
                onClick={onBuyAd}
              >
                {cash < 100 ? "Not enough cash" : "Run Ad — $100"}
              </button>
            )}
            {adActive && (
              <div className="marketing-active-tag">Ad purchased ✓</div>
            )}
          </div>
        </>
      )}

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

      {brandTrends && (
        <>
          <h3>Market Trends</h3>
          <div className="brand-trends-list">
            {Object.entries(brandTrends).map(([brand, trend]) => {
              const isOpen   = expandedBrands.has(brand);
              const styles   = STYLES_BY_BRAND[brand] ?? [];
              return (
                <div key={brand} className="brand-trend-group">
                  <div
                    className="brand-trend-row brand-trend-row-clickable"
                    onClick={() => styles.length > 0 && toggleBrand(brand)}
                  >
                    <div className="brand-trend-left">
                      <span className="brand-trend-name">{brand}</span>
                      {styles.length > 0 && (
                        <span className="brand-trend-chevron">{isOpen ? "▲" : "▼"}</span>
                      )}
                    </div>
                    <span className={`brand-trend-badge trend-${trend.direction}`}>
                      {TREND_ICON[trend.direction]} {TREND_LABEL[trend.direction]}
                    </span>
                  </div>
                  {isOpen && styles.map(style => {
                    const st = styleTrends?.[style];
                    if (!st) return null;
                    return (
                      <div key={style} className="style-trend-row">
                        <span className="style-trend-name">{style}</span>
                        <span className={`brand-trend-badge trend-${st.direction}`}>
                          {TREND_ICON[st.direction]} {TREND_LABEL[st.direction]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Key Master Vault */}
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
            const mktLow   = dailyMarkets[shoe.shoeId]?.low ?? 0;
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
                  onClick={() => {
                    pendingVault.forEach(item => onAddToKeyMaster(item));
                    setPendingVault([]);
                  }}
                >
                  Add {pendingVault.length} shoe{pendingVault.length !== 1 ? "s" : ""} to vault — permanent
                </button>
              )}
            </>
          )}

          {!canEditPrices && (
            <p className="km-day-note">Manage vault between days.</p>
          )}
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
