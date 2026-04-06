
export default function EndOfDayScreen({ day, nextDay, cash, transactions, fakes = [], kmIncome = 0, kmResults = [], onAdjustPrices }) {
  const sales = transactions.filter(t => t.cashDelta > 0);
  const purchases = transactions.filter(t => t.cashDelta < 0);
  const trades = transactions.filter(t => t.outcome === "Traded");

  const revenue = sales.reduce((s, t) => s + t.cashDelta, 0);
  const spend = Math.abs(purchases.reduce((s, t) => s + t.cashDelta, 0));
  const net = revenue - spend + kmIncome;

  return (
    <div className="container end-of-day">
      <h2>End of Day {day}</h2>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Sales Revenue</div>
          <div className="stat-value positive">+${revenue.toLocaleString()}</div>
          <div className="stat-sub">{sales.length} sale{sales.length !== 1 ? "s" : ""}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Purchases</div>
          <div className="stat-value negative">−${spend.toLocaleString()}</div>
          <div className="stat-sub">{purchases.length} bought</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Trades</div>
          <div className="stat-value">{trades.length}</div>
        </div>
        <div className="stat-card highlight">
          <div className="stat-label">Net Today</div>
          <div className={`stat-value ${net >= 0 ? "positive" : "negative"}`}>
            {net >= 0 ? "+" : ""}${net.toLocaleString()}
          </div>
          <div className="stat-sub">Cash: ${cash.toLocaleString()}</div>
        </div>
      </div>

      {fakes.length > 0 && (
        <div className="fakes-alert">
          <div className="fakes-alert-title">Fakes Removed from Inventory</div>
          <div className="fakes-alert-sub">
            {fakes.length} fake pair{fakes.length !== 1 ? "s" : ""} were seized and discarded.
          </div>
          <div className="fakes-list">
            {fakes.map((f, i) => (
              <div key={i} className="fakes-row">
                <span className="fakes-shoe">{f.brand} {f.model} — {f.colorway}</span>
                <span className="fakes-size">Sz {f.size}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {kmResults.length > 0 && (
        <div className="km-eod-section">
          <h3>Key Master</h3>
          {kmResults.map((r, i) => (
            <div key={i} className="transaction-row">
              <span className="txn-label">
                {r.won
                  ? `🏆 ${r.shoe.model} Sz ${r.shoe.size} — won by a customer`
                  : `${r.shoe.model} Sz ${r.shoe.size} — passive income`}
              </span>
              <span className={`txn-amount ${r.won ? "" : "positive"}`}>
                {r.won ? "Removed from vault" : `+$${r.earned}`}
              </span>
            </div>
          ))}
          {kmIncome > 0 && (
            <div className="transaction-row km-eod-total">
              <span className="txn-label">Key Master Total</span>
              <span className="txn-amount positive">+${kmIncome}</span>
            </div>
          )}
        </div>
      )}

      {transactions.length > 0 && (
        <>
          <h3>Transactions</h3>
          <div className="transaction-list">
            {transactions.map((t, i) => (
              <div key={i} className="transaction-row">
                <span className="txn-label">{t.label}</span>
                <span className={`txn-amount ${t.cashDelta >= 0 ? "positive" : "negative"}`}>
                  {t.cashDelta !== 0
                    ? `${t.cashDelta > 0 ? "+" : ""}$${t.cashDelta}`
                    : t.outcome}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {transactions.length === 0 && (
        <p className="empty-state">No transactions today.</p>
      )}

      <button className="primary-btn" style={{ marginTop: 24 }} onClick={onAdjustPrices}>
        Set Prices for {nextDay} →
      </button>
    </div>
  );
}
