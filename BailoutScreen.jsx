import { useState } from "react";

export default function BailoutScreen({ deficit, oldLoan, totalLoan, shortOpt, longOpt, day, onExtend, onClose }) {
  const [selected, setSelected] = useState(null); // "short" | "long"
  const opt = selected === "short" ? shortOpt : selected === "long" ? longOpt : null;

  return (
    <div className="container bailout-screen">
      <div className="bailout-icon">⚠️</div>
      <h2 className="bailout-title">You're in the Red</h2>
      <p className="bailout-subtitle">
        After {day} expenses, you're <span className="negative">${deficit.toLocaleString()}</span> short.
        Your connect can cover it — but you'll need to pick your terms.
      </p>

      <div className="bailout-summary card">
        <div className="bailout-term-row">
          <span className="bailout-term-label">Cash shortfall</span>
          <span className="bailout-term-value negative">−${deficit.toLocaleString()}</span>
        </div>
        {oldLoan > 0 && (
          <div className="bailout-term-row">
            <span className="bailout-term-label">Old loan paid off</span>
            <span className="bailout-term-value">−${oldLoan.toLocaleString()}</span>
          </div>
        )}
        <div className="bailout-term-divider" />
        <div className="bailout-term-row">
          <span className="bailout-term-label">New loan principal</span>
          <span className="bailout-term-value">${totalLoan.toLocaleString()}</span>
        </div>
        <div className="bailout-term-row">
          <span className="bailout-term-label">Cash after bailout</span>
          <span className="bailout-term-value positive">+${deficit.toLocaleString()}</span>
        </div>
      </div>

      <h3 className="bailout-terms-header">Choose Your Terms</h3>

      <div className="bailout-options">
        {[
          { key: "short", opt: shortOpt, label: "Short Term" },
          { key: "long",  opt: longOpt,  label: "Long Term"  },
        ].map(({ key, opt: o, label }) => (
          <div
            key={key}
            className={`bailout-option card${selected === key ? " bailout-option-selected" : ""}`}
            onClick={() => setSelected(key)}
          >
            <div className="bailout-option-top">
              <div>
                <div className="bailout-option-label">{label}</div>
                <div className="bailout-option-sub">{o.weeks} weeks · {Math.round(o.rate * 100)}% interest</div>
              </div>
              <span className={`bailout-radio${selected === key ? " selected" : ""}`} />
            </div>
            <div className="bailout-option-rows">
              <div className="bailout-term-row">
                <span className="bailout-term-label">Total owed</span>
                <span className="bailout-term-value">${o.total.toLocaleString()}</span>
              </div>
              <div className="bailout-term-row">
                <span className="bailout-term-label">Weekly payment</span>
                <span className="bailout-term-value negative">−${o.weekly.toLocaleString()}/wk</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bailout-actions">
        <button
          className="primary-btn bailout-extend-btn"
          disabled={!selected}
          onClick={() => onExtend(opt)}
        >
          {selected ? `Accept ${selected === "short" ? "Short" : "Long"} Term →` : "Select a Term"}
        </button>
        <button className="secondary-btn bailout-close-btn" onClick={onClose}>
          Close Shop
        </button>
      </div>
    </div>
  );
}
