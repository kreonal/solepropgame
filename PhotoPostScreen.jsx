import { useState } from "react";
import { shoeImageUrl } from "./data";

const CAPTIONS = [
  "Fresh heat just dropped on the floor 🔥",
  "You already know what it is. Come see us.",
  "Slept on these long enough. Time to find them a home.",
  "The collection speaks for itself 👟",
  "New week, new heat. Stop by.",
  "These won't last. You've been warned.",
  "Curated for the culture 🤝",
  "Every pair has a story. Come write yours.",
  "Heat check ✅ Stop by the shop.",
  "Only the best make the post 📸",
];

const COLLAGE_LAYOUTS = {
  1: { cols: 1, rows: 1, areas: `"a"` },
  2: { cols: 2, rows: 1, areas: `"a b"` },
  3: { cols: 3, rows: 2, areas: `"a a b" "a a c"` },
  4: { cols: 2, rows: 2, areas: `"a b" "c d"` },
  5: { cols: 3, rows: 2, areas: `"a b c" "d d e"` },
  6: { cols: 3, rows: 2, areas: `"a b c" "d e f"` },
  7: { cols: 3, rows: 3, areas: `"a b c" "d e f" "g g g"` },
  8: { cols: 3, rows: 3, areas: `"a b c" "d e f" "g g h"` },
  9: { cols: 3, rows: 3, areas: `"a b c" "d e f" "g h i"` },
};
const AREA_KEYS = "abcdefghi".split("");

function ShoeThumb({ shoeId, size = 48 }) {
  return (
    <div className="modal-thumb-wrap" style={{ width: size, height: size, flexShrink: 0 }}>
      <img
        className="modal-thumb"
        src={shoeImageUrl(shoeId)}
        alt=""
        onError={e => { e.target.parentElement.style.display = "none"; }}
      />
    </div>
  );
}

function CollagePreview({ slots, onRemove }) {
  const filled = slots.filter(Boolean);
  const count  = filled.length;

  if (count === 0) {
    return (
      <div className="photo-collage-empty">
        <span>Tap a slot below to add shoes</span>
      </div>
    );
  }

  const layout = COLLAGE_LAYOUTS[count];
  return (
    <div className="photo-collage-grid" style={{
      gridTemplateColumns: `repeat(${layout.cols}, 1fr)`,
      gridTemplateRows:    `repeat(${layout.rows}, 1fr)`,
      gridTemplateAreas:   layout.areas,
    }}>
      {filled.map((item, i) => (
        <div
          key={`${item.shoeId}-${item.size}`}
          className="photo-collage-cell"
          style={{ gridArea: AREA_KEYS[i] }}
          onClick={() => onRemove(i)}
        >
          <img
            src={shoeImageUrl(item.shoeId)}
            alt={item.model}
            className="photo-collage-img"
            onError={e => { e.target.style.display = "none"; }}
          />
          <div className="photo-collage-remove">✕</div>
        </div>
      ))}
    </div>
  );
}

function PickerSheet({ inventory, slots, onSelect, onClose }) {
  return (
    <div className="photo-picker-backdrop" onClick={onClose}>
      <div className="photo-picker-sheet" onClick={e => e.stopPropagation()}>
        <div className="photo-picker-header">
          <span className="photo-picker-title">Choose a shoe</span>
          <button className="photo-picker-close" onClick={onClose}>✕</button>
        </div>
        <div className="photo-picker-list">
          {inventory.map(item => {
            const isSelected = slots.some(s => s && s.shoeId === item.shoeId && s.size === item.size);
            return (
              <button
                key={`${item.shoeId}-${item.size}`}
                className={`photo-picker-item${isSelected ? " selected" : ""}`}
                onClick={() => onSelect(item)}
              >
                <ShoeThumb shoeId={item.shoeId} size={48} />
                <div className="photo-picker-info">
                  <div className="photo-picker-name">{item.brand} {item.model} — {item.colorway}</div>
                  <div className="photo-picker-sub">Sz {item.size} · ${item.listPrice}</div>
                </div>
                {isSelected && <span className="photo-picker-check">✓</span>}
              </button>
            );
          })}
          {inventory.length === 0 && (
            <p className="photo-picker-empty">No inventory to feature.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PhotoPostScreen({ inventory, onPost, onSkip, day }) {
  const [slots,      setSlots]      = useState(Array(9).fill(null));
  const [activeSlot, setActiveSlot] = useState(null);
  const [caption,    setCaption]    = useState(() => CAPTIONS[Math.floor(Math.random() * CAPTIONS.length)]);

  const filled = slots.filter(Boolean);

  function handleSlotClick(i) {
    if (slots[i]) {
      setSlots(prev => { const next = [...prev]; next[i] = null; return next; });
    } else {
      setActiveSlot(i);
    }
  }

  function handlePickerSelect(item) {
    setSlots(prev => {
      const next = prev.map(s => (s && s.shoeId === item.shoeId && s.size === item.size) ? null : s);
      next[activeSlot] = item;
      return next;
    });
    setActiveSlot(null);
  }

  function handleRemoveFromCollage(filledIndex) {
    const item = filled[filledIndex];
    setSlots(prev => prev.map(s => (s && s.shoeId === item.shoeId && s.size === item.size) ? null : s));
  }

  function handleShuffleCaption() {
    const others = CAPTIONS.filter(c => c !== caption);
    setCaption(others[Math.floor(Math.random() * others.length)]);
  }

  function handlePost() {
    onPost(filled.map(f => ({ shoeId: f.shoeId, size: f.size })));
  }

  return (
    <div className="photo-post-screen">
      <div className="photo-post-card">

        {/* IG header */}
        <div className="photo-ig-header">
          <div className="photo-ig-avatar">👟</div>
          <div>
            <div className="photo-ig-handle">@sole_prop</div>
            <div className="photo-ig-day">Day {day}</div>
          </div>
        </div>

        {/* Collage preview */}
        <CollagePreview slots={slots} onRemove={handleRemoveFromCollage} />

        {/* Caption */}
        <div className="photo-caption-row">
          <span className="photo-caption-text">"{caption}"</span>
          <button className="photo-shuffle-btn" onClick={handleShuffleCaption} title="Shuffle caption">↺</button>
        </div>

        {/* Fake engagement icons */}
        <div className="photo-engagement">
          <span>♥</span>
          <span>💬</span>
        </div>

        <div className="photo-divider" />

        {/* Slot selector label */}
        <div className="photo-section-label">Feature up to 9 shoes · tap to add or remove</div>

        {/* 3×3 slot grid */}
        <div className="photo-slot-grid">
          {slots.map((item, i) => (
            <button
              key={i}
              className={`photo-slot${item ? " filled" : ""}`}
              onClick={() => handleSlotClick(i)}
            >
              {item ? (
                <>
                  <img
                    src={shoeImageUrl(item.shoeId)}
                    alt=""
                    className="photo-slot-img"
                    onError={e => { e.target.style.display = "none"; }}
                  />
                  <span className="photo-slot-label">{item.model}</span>
                  <span className="photo-slot-remove">✕</span>
                </>
              ) : (
                <span className="photo-slot-plus">+</span>
              )}
            </button>
          ))}
        </div>

        <button className="primary-btn" style={{ marginTop: 16 }} onClick={handlePost}>
          Post & Open Shop →
        </button>
        <button className="photo-skip-btn" onClick={onSkip}>
          Skip for today
        </button>

      </div>

      {activeSlot !== null && (
        <PickerSheet
          inventory={inventory}
          slots={slots}
          onSelect={handlePickerSelect}
          onClose={() => setActiveSlot(null)}
        />
      )}
    </div>
  );
}
