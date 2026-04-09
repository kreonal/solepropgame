import { createRoot } from "react-dom/client";
import { useState } from "react";

// ── Fake inventory (real image IDs from the game) ────────────────────────────
const SUPABASE_IMAGE_BASE = "https://tvlpdtntepkdcuehzyxj.supabase.co/storage/v1/object/public/sneaker-images";
function imgUrl(id) { return `${SUPABASE_IMAGE_BASE}/${id}.jpg`; }

const FAKE_INVENTORY = [
  { shoeId: "aj1-bred",          brand: "Jordan",       model: "Air Jordan 1",     colorway: "Bred",          size: 10,  listPrice: 680 },
  { shoeId: "aj1-chicago",       brand: "Jordan",       model: "Air Jordan 1",     colorway: "Chicago",       size: 9,   listPrice: 870 },
  { shoeId: "aj3-black-cement",  brand: "Jordan",       model: "Air Jordan 3",     colorway: "Black Cement",  size: 11,  listPrice: 340 },
  { shoeId: "aj3-fire-red",      brand: "Jordan",       model: "Air Jordan 3",     colorway: "Fire Red",      size: 10,  listPrice: 320 },
  { shoeId: "nk-dunk-low-panda", brand: "Nike",         model: "Dunk Low",         colorway: "Panda",         size: 10,  listPrice: 150 },
  { shoeId: "nk-dunk-low-unc",   brand: "Nike",         model: "Dunk Low",         colorway: "UNC",           size: 9.5, listPrice: 130 },
  { shoeId: "nk-af1-low-white",  brand: "Nike",         model: "Air Force 1 Low",  colorway: "White",         size: 11,  listPrice: 110 },
  { shoeId: "ad-yeezy-350-zebra",brand: "Adidas",       model: "Yeezy Boost 350",  colorway: "Zebra",         size: 10,  listPrice: 280 },
  { shoeId: "ad-campus-00s-grey",brand: "Adidas",       model: "Campus 00s",       colorway: "Grey",          size: 9,   listPrice: 95  },
  { shoeId: "nb-2002r-grey",     brand: "New Balance",  model: "2002R",            colorway: "Grey",          size: 10,  listPrice: 120 },
  { shoeId: "nb-550-white",      brand: "New Balance",  model: "550",              colorway: "White/Green",   size: 11,  listPrice: 110 },
  { shoeId: "as-gel-kayano-14",  brand: "Asics",        model: "Gel-Kayano 14",    colorway: "Silver/Blue",   size: 10,  listPrice: 160 },
];

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

// ── Collage layout templates (grid-template-areas) per shoe count ─────────────
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

function CollageGrid({ slots, onSlotClick }) {
  const filled = slots.filter(Boolean);
  const count  = filled.length;
  if (count === 0) {
    return (
      <div style={styles.emptyCollage}>
        <span style={styles.emptyMsg}>Tap a slot below to add shoes</span>
      </div>
    );
  }

  const layout = COLLAGE_LAYOUTS[count];
  const gridStyle = {
    display: "grid",
    gridTemplateColumns: `repeat(${layout.cols}, 1fr)`,
    gridTemplateRows:    `repeat(${layout.rows}, 1fr)`,
    gridTemplateAreas:   layout.areas,
    width: "100%",
    aspectRatio: "1 / 1",
    gap: 2,
    borderRadius: 4,
    overflow: "hidden",
    background: "#111",
  };

  return (
    <div style={gridStyle}>
      {filled.map((item, i) => (
        <div
          key={`${item.shoeId}-${item.size}`}
          style={{ gridArea: AREA_KEYS[i], position: "relative", overflow: "hidden", cursor: "pointer" }}
          onClick={() => onSlotClick(i)}
        >
          <img
            src={imgUrl(item.shoeId)}
            alt={item.model}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            onError={e => { e.target.style.background = "#222"; e.target.style.display = "none"; }}
          />
          <div style={styles.slotOverlay}>✕</div>
        </div>
      ))}
    </div>
  );
}

function PickerSheet({ inventory, selected, onSelect, onClose }) {
  return (
    <div style={styles.pickerBackdrop} onClick={onClose}>
      <div style={styles.pickerSheet} onClick={e => e.stopPropagation()}>
        <div style={styles.pickerHeader}>
          <span style={styles.pickerTitle}>Choose a shoe</span>
          <button style={styles.pickerClose} onClick={onClose}>✕</button>
        </div>
        <div style={styles.pickerList}>
          {inventory.map(item => {
            const isSelected = selected.some(s => s && s.shoeId === item.shoeId && s.size === item.size);
            return (
              <button
                key={`${item.shoeId}-${item.size}`}
                style={{ ...styles.pickerItem, ...(isSelected ? styles.pickerItemSelected : {}) }}
                onClick={() => onSelect(item)}
              >
                <img
                  src={imgUrl(item.shoeId)}
                  alt={item.model}
                  style={styles.pickerThumb}
                  onError={e => { e.target.style.background = "#222"; }}
                />
                <div style={styles.pickerInfo}>
                  <div style={styles.pickerName}>{item.brand} {item.model} — {item.colorway}</div>
                  <div style={styles.pickerSub}>Sz {item.size} · ${item.listPrice}</div>
                </div>
                {isSelected && <span style={styles.pickerCheck}>✓</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SlotGrid({ slots, onSlotClick }) {
  return (
    <div style={styles.slotGrid}>
      {slots.map((item, i) => (
        <button
          key={i}
          style={{ ...styles.slotBtn, ...(item ? styles.slotBtnFilled : {}) }}
          onClick={() => onSlotClick(i)}
        >
          {item ? (
            <>
              <img
                src={imgUrl(item.shoeId)}
                alt=""
                style={styles.slotThumb}
                onError={e => { e.target.style.display = "none"; }}
              />
              <span style={styles.slotLabel}>{item.model}</span>
              <span style={styles.slotRemove}>✕</span>
            </>
          ) : (
            <span style={styles.slotPlus}>+</span>
          )}
        </button>
      ))}
    </div>
  );
}

function App() {
  const [slots,       setSlots]       = useState(Array(9).fill(null));
  const [activeSlot,  setActiveSlot]  = useState(null);
  const [caption,     setCaption]     = useState(CAPTIONS[0]);
  const [posted,      setPosted]      = useState(false);

  const filled = slots.filter(Boolean);

  function handleSlotClick(i) {
    const item = slots[i];
    if (item) {
      // Clear the slot
      setSlots(prev => { const next = [...prev]; next[i] = null; return next; });
    } else {
      setActiveSlot(i);
    }
  }

  function handlePickerSelect(item) {
    // If already in a slot, remove it first
    setSlots(prev => {
      const next = prev.map(s => (s && s.shoeId === item.shoeId && s.size === item.size) ? null : s);
      next[activeSlot] = item;
      return next;
    });
    setActiveSlot(null);
  }

  function handleRandomCaption() {
    const others = CAPTIONS.filter(c => c !== caption);
    setCaption(others[Math.floor(Math.random() * others.length)]);
  }

  function handlePost() {
    setPosted(true);
  }

  if (posted) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.successIcon}>✅</div>
          <div style={styles.successTitle}>Posted!</div>
          <div style={styles.successSub}>{filled.length} shoe{filled.length !== 1 ? "s" : ""} featured for tomorrow.</div>
          <button style={styles.primaryBtn} onClick={() => { setPosted(false); setSlots(Array(9).fill(null)); }}>
            Reset (test again)
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>

        {/* IG-style header */}
        <div style={styles.igHeader}>
          <div style={styles.igAvatar}>👟</div>
          <div>
            <div style={styles.igHandle}>@sole_prop</div>
            <div style={styles.igSub}>New Post</div>
          </div>
        </div>

        {/* Collage preview */}
        <CollageGrid slots={slots} onSlotClick={i => {
          if (slots[i]) {
            setSlots(prev => { const next = [...prev]; next[i] = null; return next; });
          }
        }} />

        {/* Caption row */}
        <div style={styles.captionRow}>
          <span style={styles.captionText}>"{caption}"</span>
          <button style={styles.shuffleBtn} onClick={handleRandomCaption} title="Shuffle caption">↺</button>
        </div>

        {/* Fake engagement bar */}
        <div style={styles.engagementBar}>
          <span>♥</span>
          <span>💬</span>
        </div>

        <div style={styles.divider} />

        {/* Slot selector */}
        <div style={styles.sectionLabel}>Select shoes to feature (up to 9)</div>
        <SlotGrid slots={slots} onSlotClick={handleSlotClick} />

        <button
          style={{ ...styles.primaryBtn, marginTop: 16, opacity: filled.length === 0 ? 0.5 : 1 }}
          onClick={handlePost}
        >
          Post & Open Shop →
        </button>
        <button style={styles.skipBtn} onClick={handlePost}>Skip for today</button>
      </div>

      {activeSlot !== null && (
        <PickerSheet
          inventory={FAKE_INVENTORY}
          selected={slots}
          onSelect={handlePickerSelect}
          onClose={() => setActiveSlot(null)}
        />
      )}
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = {
  page: {
    fontFamily: "'Inter', sans-serif",
    background: "#f5f5f5",
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
    padding: "24px 16px",
  },
  card: {
    background: "#fff",
    borderRadius: 16,
    padding: 20,
    width: "100%",
    maxWidth: 420,
    boxShadow: "0 2px 16px rgba(0,0,0,0.10)",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  igHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  igAvatar: {
    width: 38,
    height: 38,
    borderRadius: "50%",
    background: "#111",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 20,
    flexShrink: 0,
  },
  igHandle: {
    fontWeight: 700,
    fontSize: 14,
    color: "#111",
  },
  igSub: {
    fontSize: 12,
    color: "#888",
  },
  emptyCollage: {
    width: "100%",
    aspectRatio: "1 / 1",
    background: "#f0f0f0",
    borderRadius: 4,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyMsg: {
    fontSize: 13,
    color: "#999",
  },
  slotOverlay: {
    position: "absolute",
    top: 4,
    right: 4,
    background: "rgba(0,0,0,0.55)",
    color: "#fff",
    borderRadius: "50%",
    width: 20,
    height: 20,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 10,
    fontWeight: 700,
  },
  captionRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  captionText: {
    flex: 1,
    fontSize: 13,
    color: "#333",
    fontStyle: "italic",
  },
  shuffleBtn: {
    background: "none",
    border: "1px solid #ddd",
    borderRadius: 8,
    padding: "4px 8px",
    cursor: "pointer",
    fontSize: 16,
    color: "#555",
    flexShrink: 0,
  },
  engagementBar: {
    display: "flex",
    gap: 16,
    fontSize: 18,
    color: "#555",
  },
  divider: {
    borderTop: "1px solid #eee",
    margin: "4px 0",
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  slotGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 8,
  },
  slotBtn: {
    background: "#f5f5f5",
    border: "2px dashed #ddd",
    borderRadius: 10,
    aspectRatio: "1 / 1",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    position: "relative",
    overflow: "hidden",
    padding: 4,
    gap: 4,
  },
  slotBtnFilled: {
    border: "2px solid #111",
    background: "#000",
  },
  slotThumb: {
    width: "70%",
    aspectRatio: "1 / 1",
    objectFit: "cover",
    borderRadius: 6,
  },
  slotLabel: {
    fontSize: 9,
    color: "#fff",
    fontWeight: 600,
    textAlign: "center",
    lineHeight: 1.2,
    maxWidth: "90%",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  slotRemove: {
    position: "absolute",
    top: 4,
    right: 4,
    background: "rgba(255,255,255,0.2)",
    color: "#fff",
    borderRadius: "50%",
    width: 16,
    height: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 9,
    fontWeight: 700,
  },
  slotPlus: {
    fontSize: 22,
    color: "#bbb",
    fontWeight: 300,
  },
  primaryBtn: {
    background: "#111",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "13px 0",
    fontFamily: "'Inter', sans-serif",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    width: "100%",
  },
  skipBtn: {
    background: "none",
    border: "none",
    color: "#999",
    fontSize: 13,
    cursor: "pointer",
    fontFamily: "'Inter', sans-serif",
    textDecoration: "underline",
    padding: 0,
    alignSelf: "center",
  },
  // Picker
  pickerBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.4)",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    zIndex: 100,
  },
  pickerSheet: {
    background: "#fff",
    borderRadius: "16px 16px 0 0",
    width: "100%",
    maxWidth: 420,
    maxHeight: "70vh",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  pickerHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 20px 12px",
    borderBottom: "1px solid #eee",
    flexShrink: 0,
  },
  pickerTitle: {
    fontWeight: 700,
    fontSize: 15,
    color: "#111",
  },
  pickerClose: {
    background: "none",
    border: "none",
    fontSize: 18,
    cursor: "pointer",
    color: "#666",
    padding: 0,
  },
  pickerList: {
    overflowY: "auto",
    flex: 1,
    padding: "8px 0",
  },
  pickerItem: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    width: "100%",
    padding: "10px 20px",
    background: "none",
    border: "none",
    cursor: "pointer",
    textAlign: "left",
    fontFamily: "'Inter', sans-serif",
    borderBottom: "1px solid #f5f5f5",
  },
  pickerItemSelected: {
    background: "#f0f8ff",
  },
  pickerThumb: {
    width: 48,
    height: 48,
    objectFit: "cover",
    borderRadius: 8,
    background: "#eee",
    flexShrink: 0,
  },
  pickerInfo: {
    flex: 1,
    minWidth: 0,
  },
  pickerName: {
    fontSize: 13,
    fontWeight: 600,
    color: "#111",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  pickerSub: {
    fontSize: 12,
    color: "#888",
    marginTop: 2,
  },
  pickerCheck: {
    color: "#2563eb",
    fontWeight: 700,
    fontSize: 16,
    flexShrink: 0,
  },
  successIcon: { fontSize: 48, textAlign: "center" },
  successTitle: { fontSize: 22, fontWeight: 800, textAlign: "center", color: "#111" },
  successSub: { fontSize: 14, color: "#666", textAlign: "center" },
};

createRoot(document.getElementById("root")).render(<App />);
