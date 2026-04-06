const TYPE_COLOR = { BUY: "#16a34a", SELL: "#2563eb", TRADE: "#d97706" };
const TYPE_BG    = { BUY: "#dcfce7", SELL: "#dbeafe", TRADE: "#fef3c7" };
const TYPE_DESC  = {
  BUY:   "Looking to buy a pair from you.",
  SELL:  "Has a pair they want to sell.",
  TRADE: "Wants to make a trade.",
};
const TYPE_TIME  = { BUY: "0.25h each", SELL: "0.5h+", TRADE: "0.5h+" };
const MIN_HOURS  = { BUY: 0.25, SELL: 0.5, TRADE: 0.5 };

export default function CustomersTab({
  customers,
  hoursLeft,
  allDone,
  onMeetType,
  onEndDay,
}) {
  const total  = customers.length;
  const served = customers.filter(c => c.served).length;
  const pct    = total > 0 ? Math.round((served / total) * 100) : 0;

  const remaining = {
    BUY:   customers.filter(c => !c.served && c.type === "BUY").length,
    SELL:  customers.filter(c => !c.served && c.type === "SELL").length,
    TRADE: customers.filter(c => !c.served && c.type === "TRADE").length,
  };

  return (
    <div className="container">
      <div className="customers-header">
        <h2>Customers</h2>
        <button className="end-day-btn" onClick={onEndDay}>End Day →</button>
      </div>

      <div className="progress-wrap">
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="progress-label">{served} / {total} served</span>
      </div>

      {allDone ? (
        <div className="all-done-card">
          <p className="all-done-msg">
            {hoursLeft < 0.25 ? "No time left for more customers." : "All customers seen for the day."}
          </p>
          <button className="primary-btn" onClick={onEndDay}>End Day →</button>
        </div>
      ) : (
        <div className="type-group-list">
          {["BUY", "SELL", "TRADE"].map(type => {
            const count   = remaining[type];
            const canMeet = count > 0 && hoursLeft >= MIN_HOURS[type];
            return (
              <div
                key={type}
                className={`type-group-card card${count === 0 ? " type-group-empty" : ""}`}
              >
                <div className="type-group-top">
                  <span
                    className="customer-type-badge-lg"
                    style={{ color: TYPE_COLOR[type], background: TYPE_BG[type] }}
                  >
                    {type}
                  </span>
                  <div className="type-group-meta">
                    <span className="type-group-count">{count} waiting</span>
                    <span className="type-group-time">{TYPE_TIME[type]}</span>
                  </div>
                </div>
                <p className="customer-type-desc">{TYPE_DESC[type]}</p>
                <button
                  className="meet-btn-lg"
                  disabled={!canMeet}
                  onClick={() => onMeetType(type)}
                >
                  {count === 0
                    ? "None Waiting"
                    : !canMeet
                    ? "Not Enough Time"
                    : `Meet Next ${type} →`}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
