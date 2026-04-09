import { useState } from "react";

const STEPS = [
  {
    icon: "👟",
    title: "Welcome to Sole Proprietor",
    subtitle: "The core loop",
    body: "You run a sneaker resell shop. Customers come through every day to buy pairs from you, sell you their shoes, and trade.",
    points: [
      { label: "BUY",   desc: "A customer wants to buy a pair from your inventory." },
      { label: "SELL",  desc: "A customer wants to sell you their shoes." },
      { label: "TRADE", desc: "A customer wants to swap pairs with you. Cash can be added either way to make it fair." },
    ],
    footer: "End the day when you're done. Between days, set your prices, post your social media photo, and get ready for the next one.",
  },
  {
    icon: "⏱",
    title: "10 Hours Per Day",
    subtitle: "Time is your most limited resource",
    body: "Every customer costs time. When the clock hits zero the shop closes, no matter how many people are still in line.",
    points: [
      { label: "BUY",   desc: "0.25h per transaction" },
      { label: "SELL",  desc: "0.5h base, plus 0.5h if you closely inspect for fakes" },
      { label: "TRADE", desc: "0.5h base, plus 0.5h if you closely inspect for fakes" },
    ],
    footer: "Hit \"Not Interested\" on any SELL or TRADE customer to skip them with zero time cost. Be selective. Not every customer is worth your time.",
  },
  {
    icon: "💸",
    title: "Watch Your Expenses",
    subtitle: "You opened with a $10,000 loan",
    body: "Fixed costs hit automatically at the end of every week. Stay on top of your cash or things get ugly fast.",
    points: [
      { label: "Loan repayment", desc: "$2,500 / week until paid off" },
      { label: "Shop rent",      desc: "$1,000 / week" },
      { label: "Utilities",      desc: "$500 / week" },
    ],
    footer: "Can't cover expenses? You'll get a bailout loan at 30% interest. It keeps you alive but it hurts. Watch the Expenses tab.",
  },
  {
    icon: "📦",
    title: "Limited Storage",
    subtitle: "Inventory management matters",
    body: "Your shop holds 50 pairs to start. A full shop means you can't take in anything new until you move some product.",
    points: [
      { label: "List prices",       desc: "Set them between days. Once the shop opens they're locked in." },
      { label: "Storage upgrades",  desc: "Buy more space in the Store tab as your business grows." },
    ],
    footer: "Post your daily social media photo between days to guarantee walk-ins. The Store tab has upgrades to help you scale.",
  },
  {
    icon: "🎟",
    title: "Releases & Raffles",
    subtitle: "New drops start in Week 2",
    body: "Starting Week 2, new shoes drop every week. Enter a raffle for a shot at retail, or lock in a full size run with a preorder.",
    points: [
      { label: "Raffle",    desc: "10% chance to cop a pair at retail price" },
      { label: "Preorder",  desc: "Guaranteed full size run at 120% of retail" },
      { label: "Demand",    desc: "Fresh releases bring extra buyers through the door the next day" },
      { label: "Schedule",  desc: "Nike, Jordan, and Adidas drop every week. New Balance on even weeks, Asics on odd weeks." },
    ],
    footer: "Grails are rare and secondary-market only. Regular releases are your bread and butter. Win them, flip them, build the bag.",
  },
];

export default function StartupGuide({ onClose }) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast  = step === STEPS.length - 1;

  return (
    <div className="guide-overlay">
      <div className="guide-modal">
        <div className="guide-top">
          <div className="guide-step-dots">
            {STEPS.map((_, i) => (
              <span key={i} className={`guide-dot${i === step ? " active" : i < step ? " done" : ""}`} />
            ))}
          </div>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="guide-body">
          <div className="guide-icon">{current.icon}</div>
          <div className="guide-subtitle">{current.subtitle}</div>
          <h2 className="guide-title">{current.title}</h2>
          <p className="guide-desc">{current.body}</p>

          <div className="guide-points">
            {current.points.map((p, i) => (
              <div key={i} className="guide-point">
                <span className="guide-point-label">{p.label}</span>
                <span className="guide-point-desc">{p.desc}</span>
              </div>
            ))}
          </div>

          <p className="guide-footer-note">{current.footer}</p>
        </div>

        <div className="guide-actions">
          {step > 0 && (
            <button className="secondary-btn guide-back-btn" onClick={() => setStep(s => s - 1)}>
              ← Back
            </button>
          )}
          <button className="primary-btn guide-next-btn" onClick={isLast ? onClose : () => setStep(s => s + 1)}>
            {isLast ? "Start Playing →" : "Next →"}
          </button>
        </div>
      </div>
    </div>
  );
}
