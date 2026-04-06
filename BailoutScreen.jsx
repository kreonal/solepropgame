const INTEREST_RATE = 0.30;

export default function BailoutScreen({ shortfall, bailoutLoan, newLoanBalance, weeklyPayment, day, onExtend, onClose }) {
  return (
    <div className="container bailout-screen">
      <div className="bailout-icon">⚠️</div>
      <h2 className="bailout-title">You're in the Red</h2>
      <p className="bailout-subtitle">
        After {day} expenses, you're <span className="negative">${shortfall.toLocaleString()}</span> short.
        Your connect can cover it — but it'll cost you.
      </p>

      <div className="bailout-terms card">
        <div className="bailout-term-row">
          <span className="bailout-term-label">Cash injection</span>
          <span className="bailout-term-value positive">+${shortfall.toLocaleString()}</span>
        </div>
        <div className="bailout-term-row">
          <span className="bailout-term-label">30% interest penalty</span>
          <span className="bailout-term-value negative">+${(bailoutLoan - shortfall).toLocaleString()}</span>
        </div>
        <div className="bailout-term-divider" />
        <div className="bailout-term-row">
          <span className="bailout-term-label">Added to loan</span>
          <span className="bailout-term-value">${bailoutLoan.toLocaleString()}</span>
        </div>
        <div className="bailout-term-row">
          <span className="bailout-term-label">New loan balance</span>
          <span className="bailout-term-value">${newLoanBalance.toLocaleString()}</span>
        </div>
        <div className="bailout-term-row">
          <span className="bailout-term-label">Weekly payment</span>
          <span className="bailout-term-value">${weeklyPayment.toLocaleString()} / week</span>
        </div>
      </div>

      <div className="bailout-actions">
        <button className="primary-btn bailout-extend-btn" onClick={onExtend}>
          Extend Loan →
        </button>
        <button className="secondary-btn bailout-close-btn" onClick={onClose}>
          Close Shop
        </button>
      </div>
    </div>
  );
}
