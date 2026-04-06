export default function ExpensesTab({ loanBalance, expenseLog, day, weeklyLoan, weeklyRent, weeklyUtil, upgrades = {} }) {
  const currentWeek = Math.ceil(day / 7);

  const { authTier = "none", hasMarketing = false } = upgrades;

  // Build projected line items for this week
  const projected = [];
  projected.push({ label: "Rent",       amount: weeklyRent });
  projected.push({ label: "Utilities",  amount: weeklyUtil });
  if (loanBalance > 0)
    projected.push({ label: "Loan Payment", amount: weeklyLoan });
  if (authTier === "app")
    projected.push({ label: "Auth App",      amount: 100 });
  if (authTier === "employee")
    projected.push({ label: "Auth Employee", amount: 1500 });
  if (hasMarketing)
    projected.push({ label: "Marketing Employee", amount: 1500 });
  const projectedTotal = projected.reduce((s, e) => s + e.amount, 0);

  // Group log by week
  const byWeek = {};
  for (const e of expenseLog) {
    if (!byWeek[e.week]) byWeek[e.week] = [];
    byWeek[e.week].push(e);
  }
  const weeks = Object.keys(byWeek).map(Number).sort((a, b) => b - a);
  const lastWeekTotal = weeks.length > 0
    ? Math.abs(byWeek[weeks[0]].reduce((s, e) => s + e.amount, 0))
    : null;

  return (
    <div className="container">
      <h2>Expenses</h2>

      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-label">Loan Balance</div>
          <div className={`stat-value ${loanBalance === 0 ? "positive" : ""}`}>
            ${loanBalance.toLocaleString()}
          </div>
          <div className="stat-sub">{loanBalance > 0 ? `$${weeklyLoan}/wk until repaid` : "Paid off"}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">This Week</div>
          <div className="stat-value negative">−${projectedTotal.toLocaleString()}</div>
          <div className="stat-sub">Due Day 7</div>
        </div>
        {lastWeekTotal !== null && (
          <div className="stat-card">
            <div className="stat-label">Last Week</div>
            <div className="stat-value negative">−${lastWeekTotal.toLocaleString()}</div>
            <div className="stat-sub">Week {weeks[0]}</div>
          </div>
        )}
      </div>

      {/* Projected this week */}
      <h3>This Week's Projected Expenses</h3>
      <div className="transaction-list">
        {projected.map((e, i) => (
          <div key={i} className="transaction-row">
            <span className="txn-label">{e.label}</span>
            <span className="txn-amount negative">−${e.amount.toLocaleString()}</span>
          </div>
        ))}
        <div className="transaction-row" style={{ fontWeight: 700 }}>
          <span className="txn-label">Total due after Day 7 this week</span>
          <span className="txn-amount negative">−${projectedTotal.toLocaleString()}</span>
        </div>
      </div>

      {/* Past payments */}
      {weeks.length === 0 ? (
        <p className="empty-state" style={{ marginTop: 24 }}>No payments yet. First payment due Day 7.</p>
      ) : (
        <>
          <h3 style={{ marginTop: 24 }}>Past Payments</h3>
          {weeks.map(w => (
            <div key={w}>
              <h4 className="expenses-week-label">Week {w}</h4>
              <div className="transaction-list">
                {byWeek[w].map((e, i) => (
                  <div key={i} className="transaction-row">
                    <span className="txn-label">{e.label}</span>
                    <span className="txn-amount negative">−${Math.abs(e.amount).toLocaleString()}</span>
                  </div>
                ))}
                <div className="transaction-row" style={{ fontWeight: 700 }}>
                  <span className="txn-label">Total</span>
                  <span className="txn-amount negative">
                    −${Math.abs(byWeek[w].reduce((s, e) => s + e.amount, 0)).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
