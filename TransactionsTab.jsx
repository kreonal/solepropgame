import React from "react";

export default function TransactionsTab({ transactions }) {
  const meaningful = transactions.filter(t => t.cashDelta !== 0 || t.outcome === "Traded");

  const revenue = transactions.filter(t => t.cashDelta > 0).reduce((s, t) => s + t.cashDelta, 0);
  const spend = transactions.filter(t => t.cashDelta < 0).reduce((s, t) => s + t.cashDelta, 0);
  const net = revenue + spend;

  if (transactions.length === 0) {
    return (
      <div className="container">
        <h2>Today's Sales</h2>
        <p className="empty-state">No transactions yet.</p>
      </div>
    );
  }

  return (
    <div className="container">
      <h2>Today's Sales</h2>

      <div className="txn-summary-row">
        <div className="txn-summary-cell">
          <div className="txn-summary-label">In</div>
          <div className="txn-summary-value positive">+${revenue.toLocaleString()}</div>
        </div>
        <div className="txn-summary-cell">
          <div className="txn-summary-label">Out</div>
          <div className="txn-summary-value negative">${spend.toLocaleString()}</div>
        </div>
        <div className="txn-summary-cell">
          <div className="txn-summary-label">Net</div>
          <div className={`txn-summary-value ${net >= 0 ? "positive" : "negative"}`}>
            {net >= 0 ? "+" : ""}${net.toLocaleString()}
          </div>
        </div>
      </div>

      <div className="transaction-list">
        {[...transactions].reverse().map((t, i) => (
          <div key={i} className="transaction-row">
            <span className="txn-label">{t.label}</span>
            <span className={`txn-amount ${t.cashDelta > 0 ? "positive" : t.cashDelta < 0 ? "negative" : ""}`}>
              {t.cashDelta !== 0
                ? `${t.cashDelta > 0 ? "+" : ""}$${t.cashDelta}`
                : t.outcome}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
