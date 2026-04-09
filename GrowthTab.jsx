import { useState, useRef } from "react";

const UPGRADE_META = {
  storagePlus50:    { label: "Storage +50 Pairs",             cost: 2000,  recurring: false },
  storagePlus100:   { label: "Storage +100 Pairs",            cost: 4500,  recurring: false },
  authNone:         { label: "No Auth Tool",                  cost: 0,     recurring: false },
  authApp:          { label: "Auth App",                      cost: 100,   recurring: true  },
  authEmployee:     { label: "Auth Employee",                 cost: 1500,  recurring: true  },
  marketing:        { label: "Marketing Employee",            cost: 1500,  recurring: true  },
  marketingCancel:  { label: "Cancel Marketing Employee",     cost: 0,     recurring: false },
  keyMaster:        { label: "Key Master Vault",              cost: 5000,  recurring: false },
};

export default function GrowthTab({ upgrades, cash, phase, day, onBuyUpgrade, storeName, storeHandle, storeLogo, onStoreNameChange, onStoreHandleChange, onStoreLogoChange }) {
  const canBuy = phase === "between";
  // Recurring upgrades (auth, marketing) only changeable at week boundaries (day 8, 15, 22...)
  const canChangeRecurring = canBuy && day % 7 === 1 && day > 1;
  const { storagePlus50, storagePlus100, authTier, hasMarketing, hasKeyMaster } = upgrades;
  const effectiveCap = 50 + (storagePlus50 ? 50 : 0) + (storagePlus100 ? 100 : 0);

  // Staged selection — nothing is purchased until Confirm is clicked
  const [pendingKey,     setPendingKey]     = useState(null); // upgrade key staged for purchase
  const [pendingAuthTier, setPendingAuthTier] = useState(null); // local auth selection (null = use real authTier)

  const displayAuthTier = pendingAuthTier ?? authTier;
  const authChanged     = pendingAuthTier !== null && pendingAuthTier !== authTier;

  function stageUpgrade(key) {
    if (!canBuy) return;
    if (key.startsWith("auth")) {
      if (!canChangeRecurring) return;
      setPendingAuthTier(key === "authNone" ? "none" : key === "authApp" ? "app" : "employee");
      setPendingKey(null);
    } else {
      if (key === "marketing" && !canChangeRecurring) return;
      setPendingKey(prev => prev === key ? null : key);
      setPendingAuthTier(null);
    }
  }

  function handleConfirm() {
    if (authChanged) {
      const keyMap = { none: "authNone", app: "authApp", employee: "authEmployee" };
      onBuyUpgrade(keyMap[pendingAuthTier]);
      setPendingAuthTier(null);
    } else if (pendingKey) {
      onBuyUpgrade(pendingKey);
      setPendingKey(null);
    }
  }

  function handleCancel() {
    setPendingKey(null);
    setPendingAuthTier(null);
  }

  const hasPending = pendingKey !== null || authChanged;
  const pendingMeta = pendingKey ? UPGRADE_META[pendingKey] : authChanged ? UPGRADE_META[{ none: "authNone", app: "authApp", employee: "authEmployee" }[pendingAuthTier]] : null;
  const pendingCost = pendingMeta?.cost ?? 0;
  const canAfford   = cash >= pendingCost;

  function AuthOption({ tier, title, desc, badge, cost }) {
    const isActive   = authTier === tier;
    const isSelected = displayAuthTier === tier;
    const locked     = !canChangeRecurring;
    let cls = "upgrade-card card auth-option";
    if (isActive && !authChanged)                    cls += " upgrade-active-tier";
    if (isSelected && authChanged)                   cls += " upgrade-selected";
    if (!isActive && !isSelected && cost > cash)     cls += " upgrade-unaffordable";
    if (locked)                                      cls += " upgrade-locked";

    return (
      <div
        className={cls}
        onClick={() => !locked && stageUpgrade(`auth${tier.charAt(0).toUpperCase() + tier.slice(1)}`)}
        style={{ cursor: locked ? "default" : "pointer" }}
      >
        <div className="upgrade-card-top">
          <div>
            <div className="upgrade-card-title">{title}</div>
            <div className="upgrade-card-desc">{desc}</div>
          </div>
          <div className="auth-option-right">
            {badge && <span className="upgrade-badge">{badge}</span>}
            <span className={`auth-radio${isSelected ? " selected" : ""}`} />
          </div>
        </div>
        {isActive && !authChanged && <div className="upgrade-owned-tag">✓ Active</div>}
      </div>
    );
  }

  function OwnableCard({ upgradeKey, title, desc, badge, owned, cost, cancelKey }) {
    const isStaged       = pendingKey === upgradeKey;
    const isCancelStaged = pendingKey === cancelKey;
    const unaffordable   = !owned && cash < cost;
    let cls = "upgrade-card card";
    if (owned && !isCancelStaged) cls += " upgrade-owned";
    if (isStaged || isCancelStaged) cls += " upgrade-active-tier";
    if (unaffordable) cls += " upgrade-unaffordable";

    return (
      <div className={cls}>
        <div className="upgrade-card-top">
          <div>
            <div className="upgrade-card-title">{title}</div>
            <div className="upgrade-card-desc">{desc}</div>
          </div>
          {badge && <span className="upgrade-badge">{badge}</span>}
        </div>
        {owned
          ? cancelKey && canChangeRecurring
            ? <button
                className={`${isCancelStaged ? "secondary-btn" : "danger-btn"} upgrade-buy-btn`}
                onClick={() => setPendingKey(prev => prev === cancelKey ? null : cancelKey)}
              >
                {isCancelStaged ? "Keep Service" : "Cancel Service"}
              </button>
            : <div className="upgrade-owned-tag">✓ Active</div>
          : <button
              className={`${isStaged ? "secondary-btn" : "primary-btn"} upgrade-buy-btn`}
              disabled={unaffordable || !canBuy}
              onClick={() => stageUpgrade(upgradeKey)}
            >
              {!canBuy      ? "Available at week start" :
               unaffordable ? "Not enough cash" :
               isStaged     ? "Deselect" :
               "Select"}
            </button>
        }
      </div>
    );
  }

  const logoInputRef = useRef(null);

  function handleLogoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => onStoreLogoChange(reader.result);
    reader.readAsDataURL(file);
  }

  return (
    <div className="container growth-tab">
      {!canBuy && (
        <div className="growth-locked-banner">Changes available between Day 7 and Day 1.</div>
      )}

      {/* ── Store Identity ── */}
      <h3 className="upgrade-section-header">Store Identity</h3>
      <div className="store-identity-card card">
        <div className="store-identity-row">
          <div className="store-logo-upload" onClick={() => logoInputRef.current?.click()}>
            <div className="store-logo-circle">
              {storeLogo
                ? <img src={storeLogo} alt="logo" className="store-logo-img" />
                : <span className="store-logo-placeholder">👟</span>}
            </div>
            <input ref={logoInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleLogoUpload} />
            <span className="store-logo-hint">Tap to change</span>
          </div>
          <div className="store-identity-fields">
            <div className="store-field">
              <label className="store-field-label">Store Name</label>
              <input
                className="store-field-input"
                value={storeName}
                onChange={e => onStoreNameChange(e.target.value)}
                placeholder="Sole Proprietor"
                maxLength={32}
              />
            </div>
            <div className="store-field">
              <label className="store-field-label">Social Handle</label>
              <div className="store-handle-wrap">
                <span className="store-handle-at">@</span>
                <input
                  className="store-field-input store-handle-input"
                  value={storeHandle}
                  onChange={e => onStoreHandleChange(e.target.value.replace(/[^a-zA-Z0-9_.]/g, ""))}
                  placeholder="sole_prop"
                  maxLength={30}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Permanent Upgrades ── */}
      <h3 className="upgrade-section-header">Permanent Upgrades</h3>

      <h4 className="upgrade-section-sub upgrade-sub-label">Storage</h4>
      <p className="upgrade-section-sub">Current capacity: {effectiveCap} pairs</p>
      <OwnableCard upgradeKey="storagePlus50"  title="Storage +50 Pairs"  desc="Expand your inventory limit by 50 pairs."                   badge="$2,000" owned={storagePlus50}  cost={2000} />
      <OwnableCard upgradeKey="storagePlus100" title="Storage +100 Pairs" desc="Expand your inventory limit by 100 pairs. Stacks with +50." badge="$4,500" owned={storagePlus100} cost={4500} />

      <h4 className="upgrade-section-sub upgrade-sub-label" style={{ marginTop: 16 }}>Key Master</h4>
      <OwnableCard upgradeKey="keyMaster" title="Key Master Machine" desc="Store up to 10 shoes in a Key Master machine permanently. Each earns 2% of live market low per day. 1% daily chance a customer wins one." badge="$5,000" owned={hasKeyMaster} cost={5000}>
        {hasKeyMaster && <p className="upgrade-owned-note">Manage your vault in the Inventory tab.</p>}
      </OwnableCard>

      {/* ── Weekly Services ── */}
      <h3 className="upgrade-section-header" style={{ marginTop: 24 }}>Weekly Services</h3>
      <p className="upgrade-section-sub">
        {canChangeRecurring
          ? "Changes take effect next week. Select a tier then confirm. Billed weekly."
          : canBuy
            ? "Services can only be changed between Day 7 and Day 1."
            : "Changes available between Day 7 and Day 1."}
      </p>

      <h4 className="upgrade-section-sub upgrade-sub-label">Authentication</h4>
      <p className="upgrade-section-sub" style={{ marginBottom: 6 }}>Both paid tiers remove Quick Look.</p>
      <AuthOption tier="none"     title="No Auth Tool"    desc="Manual inspection only. Quick Look available."            cost={0}    />
      <AuthOption tier="app"      title="Auth App"        desc="Cuts close-inspection time in half. Quick Look disabled."  badge="$100/wk"   cost={100}  />
      <AuthOption tier="employee" title="Auth Employee"   desc="Zero inspection time cost. Quick Look disabled."           badge="$1,500/wk" cost={1500} />

      <h4 className="upgrade-section-sub upgrade-sub-label" style={{ marginTop: 16 }}>Marketing</h4>
      <OwnableCard upgradeKey="marketing" title="Marketing Employee" desc="+5 buyers per day. BUY customers more willing to pay full price." badge="$1,500/wk" owned={hasMarketing} cost={1500} cancelKey="marketingCancel" />

      {/* ── Confirm bar ── */}
      {hasPending && canBuy && (
        <div className="upgrade-confirm-bar">
          <div className="upgrade-confirm-info">
            <div className="upgrade-confirm-label">{pendingMeta?.label}</div>
            <div className="upgrade-confirm-cost">
              {pendingCost === 0 ? "Free" : `$${pendingCost.toLocaleString()}${pendingMeta?.recurring ? "/wk" : ""}`}
            </div>
          </div>
          <div className="upgrade-confirm-actions">
            <button className="secondary-btn" onClick={handleCancel}>Cancel</button>
            <button className="primary-btn" disabled={!canAfford} onClick={handleConfirm}>
              {canAfford ? "Confirm" : "Can't afford"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
