import { useState } from "react";

const STEPS = [
  {
    icon: "👟",
    title: "Welcome to Sole Proprietor",
    subtitle: "The core loop",
    body: "You run a sneaker resale shop. Each day, customers walk through the door to buy, sell, and trade.",
    points: [
      { label: "BUY", desc: "They want a pair from your inventory." },
      { label: "SELL", desc: "They have shoes to offload." },
      { label: "TRADE", desc: "They'll swap pairs with you, with optional cash on top." },
    ],
    footer: "End the day when you're done with customers. Between days, adjust your prices and prepare for tomorrow.",
  },
  {
    icon: "⏱",
    title: "10 Hours Per Day",
    subtitle: "Time is your most limited resource",
    body: "Every customer interaction costs time. When the clock runs out, the shop closes — regardless of how many customers are still waiting.",
    points: [
      { label: "BUY",   desc: "0.25h — quick transaction" },
      { label: "SELL",  desc: "0.5h + optional 0.5h to closely inspect for fakes" },
      { label: "TRADE", desc: "0.5h + optional 0.5h to closely inspect for fakes" },
    ],
    footer: 'Use "Not Interested" on SELL or TRADE customers to skip them for free. Prioritize the customers that move the needle.',
  },
  {
    icon: "💸",
    title: "Watch Your Expenses",
    subtitle: "You opened with a $10,000 loan",
    body: "Every week, fixed costs come out of your cash automatically at the end of Day 7.",
    points: [
      { label: "Loan repayment", desc: "$2,500 / week until paid off" },
      { label: "Shop rent",      desc: "$1,000 / week" },
      { label: "Utilities",      desc: "$500 / week" },
    ],
    footer: "Can't cover expenses? You'll get an emergency bailout loan — at 30% interest. Keep an eye on the Expenses tab.",
  },
  {
    icon: "📦",
    title: "Limited Storage",
    subtitle: "Inventory management matters",
    body: "Your shop can only hold 50 pairs to start. A full shop means you can't buy anything until you sell.",
    points: [
      { label: "List prices",    desc: "Set between days, but is locked during the day" },
      { label: "Upgrade storage space",desc: "Purchase more space as you build your sneaker empire" },
    ],
    footer: "Use the marketing tools between days to shape who walks through the door.",
  },
  {
    icon: "🎟",
    title: "Releases & Raffles",
    subtitle: "New drops start in Week 2",
    body: "Every week after Day 7, new shoes drop. You can enter raffles or secure a full size run with a preorder.",
    points: [
      { label: "Raffle",    desc: "Win a pair at retail if you're selected" },
      { label: "Preorder",  desc: "Guaranteed full size run at 120% retail" },
      { label: "Demand",    desc: "New releases bring extra buyers the next day" },
      { label: "Schedule",  desc: "Nike · Jordan · Adidas weekly — New Balance (even weeks) · Asics (odd weeks)" },
    ],
    footer: "Hype tier matters — Grail releases are rare but highly profitable. Low-buzz drops are easier to win but margins are tighter.",
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
