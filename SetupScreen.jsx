import React, { useState } from "react";
import { CATALOG, AVAILABLE_SIZES, getSizeAdjust } from "./data";

export default function SetupScreen({ cash, dailyMarkets, onComplete }) {
  const [selected, setSelected] = useState(new Set()); // set of shoe IDs

  function getRunCost(shoe) {
    return AVAILABLE_SIZES.reduce((sum, size) => {
      const market = (dailyMarkets[shoe.id] ?? shoe.baseMarket) + getSizeAdjust(size);
      return sum + Math.round(market * 0.70);
    }, 0);
  }

  const spent = [...selected].reduce((sum, id) => {
    const shoe = CATALOG.find(s => s.id === id);
    return sum + getRunCost(shoe);
  }, 0);
  const remaining = cash - spent;

  function toggle(shoe) {
    const cost = getRunCost(shoe);
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(shoe.id)) {
        next.delete(shoe.id);
      } else if (cost <= remaining) {
        next.add(shoe.id);
      }
      return next;
    });
  }

  function handleComplete() {
    const inventory = [];
    for (const id of selected) {
      const shoe = CATALOG.find(s => s.id === id);
      for (const size of AVAILABLE_SIZES) {
        const market = (dailyMarkets[shoe.id] ?? shoe.baseMarket) + getSizeAdjust(size);
        const cost = Math.round(market * 0.70);
        inventory.push({
          shoeId: shoe.id,
          brand: shoe.brand,
          model: shoe.model,
          colorway: shoe.colorway,
          size,
          quantity: 1,
          avgPurchasePrice: cost,
          listPrice: market, // default to market — player sets before Day 1
        });
      }
    }
    onComplete(inventory, spent);
  }

  return (
    <div className="container">
      <div className="setup-header">
        <div>
          <h2 className="setup-title">Stock Your Shop</h2>
          <p className="setup-hint">
            You worked out a deal with a connect. Each shoe comes as a full size run (7–13).
          </p>
        </div>
        <div className="budget-block">
          <div className="budget-amount">${remaining.toLocaleString()}</div>
          <div className="budget-label">of ${cash.toLocaleString()}</div>
          <div className="budget-bar-wrap">
            <div className="budget-bar" style={{ width: `${(remaining / cash) * 100}%` }} />
          </div>
        </div>
      </div>

      <div className="catalog-list">
        {CATALOG.map(shoe => {
          const cost = getRunCost(shoe);
          const isSelected = selected.has(shoe.id);
          const canAfford = cost <= remaining;
          const disabled = !isSelected && !canAfford;

          return (
            <div
              key={shoe.id}
              className={`card setup-shoe-card${isSelected ? " selected" : ""}${disabled ? " disabled" : ""}`}
              onClick={() => !disabled && toggle(shoe)}
            >
              <div className="setup-shoe-info">
                <div>
                  <span className="shoe-brand">{shoe.brand}</span>
                  <span className="shoe-name"> {shoe.model} — {shoe.colorway}</span>
                </div>
                <div className="setup-shoe-meta">
                  <span className="market-tag">Mkt ${dailyMarkets[shoe.id] ?? shoe.baseMarket}</span>
                  <span className="run-cost">Full run: ${cost.toLocaleString()}</span>
                </div>
              </div>
              <div className="setup-check">
                {isSelected ? "✓" : "+"}
              </div>
            </div>
          );
        })}
      </div>

      {selected.size > 0 && (
        <div className="cart-footer">
          <div className="cart-summary">
            {selected.size} shoe{selected.size !== 1 ? "s" : ""} · {selected.size * AVAILABLE_SIZES.length} pairs · ${spent.toLocaleString()}
          </div>
          <button className="primary-btn" onClick={handleComplete}>
            Set Prices →
          </button>
        </div>
      )}
    </div>
  );
}
