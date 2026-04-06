import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";
import CustomersTab from "./CustomersTab";
import InventoryTab from "./InventoryTab";
import TransactionsTab from "./TransactionsTab";
import ExpensesTab from "./ExpensesTab";
import InteractionModal from "./InteractionModal";
import EndOfDayScreen from "./EndOfDayScreen";
import RaffleScreen from "./RaffleScreen";
import BailoutScreen from "./BailoutScreen";
import StartupGuide from "./StartupGuide";
import AuthModal from "./AuthScreen";
import SaveSelectScreen from "./SaveSelectScreen";
import GrowthTab from "./GrowthTab";
import {
  generateDailyMarkets,
  generateCustomers,
  generateWeeklyReleases,
  generateBrandTrends,
  advanceBrandTrends,
  generateStyleTrends,
  advanceStyleTrends,
  generateSellChanceBuyers,
} from "./data";

const BAILOUT_INTEREST  = 0.30;
const STARTING_CASH     = 12000;
const LOAN_AMOUNT       = 12000;
const WEEKLY_LOAN       = 1500;
const WEEKLY_RENT       = 750;
const WEEKLY_UTIL       = 250;
export const INVENTORY_CAP = 50;

function fmtDay(day) {
  const week = Math.ceil(day / 7);
  const d    = ((day - 1) % 7) + 1;
  return `W${week}D${d}`;
}

export default function App() {
  const [initState] = useState(() => {
    const trends  = generateBrandTrends();
    const styleTr = generateStyleTrends();
    const markets = generateDailyMarkets(trends, styleTr);
    return { trends, styleTr, markets, customers: generateCustomers(markets, null, 1) };
  });

  const [phase,      setPhase]      = useState("day");
  const [tab,        setTab]        = useState("customers");
  const [showGuide,  setShowGuide]  = useState(true);

  const [dailyMarkets,     setDailyMarkets]     = useState(initState.markets);
  const [prevDailyMarkets, setPrevDailyMarkets] = useState(null);
  const [brandTrends,      setBrandTrends]      = useState(initState.trends);
  const [styleTrends,      setStyleTrends]      = useState(initState.styleTr);
  const [cash,             setCash]             = useState(STARTING_CASH);
  const [loanBalance,      setLoanBalance]      = useState(LOAN_AMOUNT);
  const [inventory,        setInventory]        = useState([]);
  const [day,              setDay]              = useState(1);
  const [customers,        setCustomers]        = useState(initState.customers);
  const [activeCustomer,   setActiveCustomer]   = useState(null);
  const [transactions,     setTransactions]     = useState([]);
  const [missedDemand,     setMissedDemand]     = useState([]);
  const [expenseLog,       setExpenseLog]       = useState([]);
  const [raffleReleases,   setRaffleReleases]   = useState([]);
  const [rafflesDoneForWeek, setRafflesDoneForWeek] = useState(0);
  const [bailoutContext,   setBailoutContext]   = useState(null);
  const [recentReleaseIds, setRecentReleaseIds] = useState([]);
  const [hoursLeft,        setHoursLeft]        = useState(10);
  const [fakesReceived,    setFakesReceived]    = useState([]);
  const [featuredShoes,    setFeaturedShoes]    = useState([]);
  const [adActive,         setAdActive]         = useState(false);
  const [upgrades,         setUpgrades]         = useState({
    storagePlus50:  false,
    storagePlus100: false,
    authTier:       "none",  // "none" | "app" | "employee"
    hasMarketing:   false,
    hasKeyMaster:   false,
  });
  const [keyMasterShoes,   setKeyMasterShoes]   = useState([]);
  // keyMasterShoe: { shoeId, brand, model, colorway, size, totalEarned }
  const [endOfDayKm,       setEndOfDayKm]       = useState({ results: [], income: 0 });
  const [user,             setUser]             = useState(null);
  const [authLoading,      setAuthLoading]      = useState(true);
  const [saveSlots,        setSaveSlots]        = useState([]);
  const [currentSaveId,    setCurrentSaveId]    = useState(null);
  const [authModal,        setAuthModal]        = useState(null); // null | "login" | "signup" | "reset" | "setpassword"
  const prevSaveIdRef = useRef(null);
  const isPasswordRecoveryRef = useRef(false);

  const inventoryCount = inventory.reduce((s, i) => s + i.quantity, 0);
  const effectiveInventoryCap = INVENTORY_CAP
    + (upgrades.storagePlus50  ? 50  : 0)
    + (upgrades.storagePlus100 ? 100 : 0);
  const projectedWeeklyTotal = WEEKLY_RENT + WEEKLY_UTIL
    + (loanBalance > 0 ? WEEKLY_LOAN : 0)
    + (upgrades.authTier === "app"      ? 100  : 0)
    + (upgrades.authTier === "employee" ? 1500 : 0)
    + (upgrades.hasMarketing            ? 1500 : 0);

  // Always-fresh state snapshot for use inside stale closures (e.g. auth callbacks)
  const stateSnapshotRef = useRef(null);
  stateSnapshotRef.current = {
    version: 2,
    phase, tab, dailyMarkets, prevDailyMarkets, brandTrends, styleTrends,
    cash, loanBalance, inventory, day, customers, transactions,
    missedDemand, expenseLog, raffleReleases, rafflesDoneForWeek,
    bailoutContext, recentReleaseIds, hoursLeft, fakesReceived,
    featuredShoes, adActive, upgrades, keyMasterShoes,
  };

  // ── Auth session ───────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) loadSaves(u.id); else setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") { setUser(null); setCurrentSaveId(null); setSaveSlots([]); setAuthLoading(false); }
      if (event === "PASSWORD_RECOVERY") {
        isPasswordRecoveryRef.current = true;
        setAuthModal("setpassword");
      }
      if (event === "SIGNED_IN" && session?.user) {
        setUser(session.user);
        if (!isPasswordRecoveryRef.current) {
          setAuthModal(null);
          loadSaves(session.user.id);
        }
        isPasswordRecoveryRef.current = false;
      }
    });
    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadSaves(userId) {
    const { data } = await supabase
      .from("game_saves")
      .select("id, name, saved_at")
      .eq("user_id", userId)
      .order("saved_at", { ascending: false });
    const saves = data ?? [];

    // New user with no saves: auto-save the current guest session
    if (saves.length === 0) {
      const snapshot = stateSnapshotRef.current;
      const saveName = fmtDay(snapshot.day);
      const savedAt  = new Date().toISOString();
      const { data: inserted } = await supabase
        .from("game_saves")
        .insert({ user_id: userId, name: saveName, state: snapshot, saved_at: savedAt })
        .select("id")
        .single();
      if (inserted?.id) {
        setSaveSlots([{ id: inserted.id, name: saveName, saved_at: savedAt }]);
        setCurrentSaveId(inserted.id);
      }
    } else {
      setSaveSlots(saves);
    }

    setAuthLoading(false);
  }

  async function handleSelectSave(save) {
    const { data } = await supabase
      .from("game_saves")
      .select("state")
      .eq("id", save.id)
      .single();
    if (data?.state) restoreState(data.state);
    setCurrentSaveId(save.id);
  }

  async function handleNewRun() {
    const freshState = buildFreshState();
    const { data } = await supabase
      .from("game_saves")
      .insert({ user_id: user.id, name: fmtDay(1), state: freshState, saved_at: new Date().toISOString() })
      .select("id")
      .single();
    if (data?.id) {
      resetToFreshState(freshState);
      setCurrentSaveId(data.id);
      setSaveSlots(prev => [{ id: data.id, name, saved_at: new Date().toISOString() }, ...prev]);
    }
  }

  async function handleDeleteSave(saveId) {
    await supabase.from("game_saves").delete().eq("id", saveId);
    setSaveSlots(prev => prev.filter(s => s.id !== saveId));
    if (currentSaveId === saveId) setCurrentSaveId(null);
  }

  function buildFreshState() {
    const trends    = generateBrandTrends();
    const styleTr   = generateStyleTrends();
    const markets   = generateDailyMarkets(trends, styleTr);
    const customers = generateCustomers(markets, null, 1);
    return {
      version: 2,
      phase: "day", tab: "customers",
      dailyMarkets: markets, prevDailyMarkets: null, brandTrends: trends, styleTrends: styleTr,
      cash: STARTING_CASH, loanBalance: LOAN_AMOUNT,
      inventory: [], day: 1, customers,
      transactions: [], missedDemand: [], expenseLog: [],
      raffleReleases: [], rafflesDoneForWeek: 0,
      bailoutContext: null, recentReleaseIds: [], hoursLeft: 10,
      fakesReceived: [], featuredShoes: [], adActive: false,
      upgrades: { storagePlus50: false, storagePlus100: false, authTier: "none", hasMarketing: false, hasKeyMaster: false },
      keyMasterShoes: [],
    };
  }

  function resetToFreshState(s) {
    setPhase(s.phase);
    setTab(s.tab);
    setDailyMarkets(s.dailyMarkets);
    setPrevDailyMarkets(s.prevDailyMarkets);
    setBrandTrends(s.brandTrends);
    setCash(s.cash);
    setLoanBalance(s.loanBalance);
    setInventory(s.inventory);
    setDay(s.day);
    setCustomers(s.customers);
    setTransactions(s.transactions);
    setMissedDemand(s.missedDemand);
    setExpenseLog(s.expenseLog);
    setRaffleReleases(s.raffleReleases);
    setRafflesDoneForWeek(s.rafflesDoneForWeek);
    setBailoutContext(s.bailoutContext);
    setRecentReleaseIds(s.recentReleaseIds);
    setHoursLeft(s.hoursLeft);
    setFakesReceived(s.fakesReceived);
    setFeaturedShoes(s.featuredShoes);
    setAdActive(s.adActive);
    setUpgrades(s.upgrades);
    setKeyMasterShoes(s.keyMasterShoes);
    setStyleTrends(s.styleTrends ?? generateStyleTrends());
    setShowGuide(true);
    setActiveCustomer(null);
  }

  function restoreState(s) {
    if (!s.version || s.version < 2) { resetToFreshState(buildFreshState()); return; }
    if (s.phase)                    setPhase(s.phase);
    if (s.tab)                      setTab(s.tab);
    if (s.dailyMarkets)             setDailyMarkets(s.dailyMarkets);
    if (s.prevDailyMarkets)         setPrevDailyMarkets(s.prevDailyMarkets);
    if (s.brandTrends)              setBrandTrends(s.brandTrends);
    if (s.styleTrends)              setStyleTrends(s.styleTrends);
    if (s.cash             != null) setCash(s.cash);
    if (s.loanBalance      != null) setLoanBalance(s.loanBalance);
    if (s.inventory)                setInventory(s.inventory);
    if (s.day              != null) setDay(s.day);
    if (s.customers)                setCustomers(s.customers);
    if (s.transactions)             setTransactions(s.transactions);
    if (s.missedDemand)             setMissedDemand(s.missedDemand);
    if (s.expenseLog)               setExpenseLog(s.expenseLog);
    if (s.raffleReleases)           setRaffleReleases(s.raffleReleases);
    if (s.rafflesDoneForWeek != null) setRafflesDoneForWeek(s.rafflesDoneForWeek);
    if (s.bailoutContext)           setBailoutContext(s.bailoutContext);
    if (s.recentReleaseIds)         setRecentReleaseIds(s.recentReleaseIds);
    if (s.hoursLeft        != null) setHoursLeft(s.hoursLeft);
    setFakesReceived(s.fakesReceived ?? []);
    setFeaturedShoes(s.featuredShoes ?? []);
    setAdActive(s.adActive ?? false);
    setUpgrades(s.upgrades ?? { storagePlus50: false, storagePlus100: false, authTier: "none", hasMarketing: false, hasKeyMaster: false });
    setKeyMasterShoes(s.keyMasterShoes ?? []);
    setShowGuide(false); // returning players don't need the guide
  }

  // ── Auto-save on phase / day transitions ───────────────────────────────────
  useEffect(() => {
    if (!user || authLoading || !currentSaveId) return;
    const savedAt = new Date().toISOString();
    const saveName = fmtDay(day);
    supabase.from("game_saves").update({
      name: saveName,
      state: {
        version: 2,
        phase, tab, dailyMarkets, prevDailyMarkets, brandTrends, styleTrends,
        cash, loanBalance, inventory, day, customers, transactions,
        missedDemand, expenseLog, raffleReleases, rafflesDoneForWeek,
        bailoutContext, recentReleaseIds, hoursLeft, fakesReceived,
        featuredShoes, adActive, upgrades, keyMasterShoes,
      },
      saved_at: savedAt,
    }).eq("id", currentSaveId).then(() => {
      setSaveSlots(prev => prev.map(s =>
        s.id === currentSaveId ? { ...s, name: saveName, saved_at: savedAt } : s
      ));
    });
  }, [phase, day]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── End of day → between (or bailout) ─────────────────────────────────────
  function handleGoToBetween(kmBonusCash = 0) {
    let newTrends      = brandTrends;
    let newStyleTrends = styleTrends;
    const nextDay = day + 1;

    // Advance trends + generate new markets at week boundary
    if (day % 7 === 0) {
      newTrends      = advanceBrandTrends(brandTrends);
      newStyleTrends = advanceStyleTrends(styleTrends);
      setBrandTrends(newTrends);
      setStyleTrends(newStyleTrends);
    }

    const newMarkets = generateDailyMarkets(newTrends, newStyleTrends);
    setPrevDailyMarkets(dailyMarkets);
    setDailyMarkets(newMarkets);
    setMissedDemand([]);

    let newCash = cash + kmBonusCash;
    let newLoan = loanBalance;

    if (day % 7 === 0) {
      const weekNum = Math.ceil(day / 7);
      const entries = [];

      if (newLoan > 0) {
        const payment = Math.min(WEEKLY_LOAN, newLoan);
        newLoan = Math.max(0, newLoan - payment);
        newCash -= payment;
        entries.push({ week: weekNum, label: "Loan Repayment", amount: -payment });
      }

      newCash -= WEEKLY_RENT;
      entries.push({ week: weekNum, label: "Shop Rent", amount: -WEEKLY_RENT });

      newCash -= WEEKLY_UTIL;
      entries.push({ week: weekNum, label: "Utilities", amount: -WEEKLY_UTIL });

      if (upgrades.authTier === "app") {
        newCash -= 100;
        entries.push({ week: weekNum, label: "Auth App", amount: -100 });
      } else if (upgrades.authTier === "employee") {
        newCash -= 1500;
        entries.push({ week: weekNum, label: "Auth Employee", amount: -1500 });
      }
      if (upgrades.hasMarketing) {
        newCash -= 1500;
        entries.push({ week: weekNum, label: "Marketing Employee", amount: -1500 });
      }

      setExpenseLog(prev => [...prev, ...entries]);
    }

    // Pre-generate raffle releases on week boundary
    if (nextDay >= 8 && nextDay % 7 === 1) {
      setRaffleReleases(generateWeeklyReleases(Math.ceil(nextDay / 7)));
    }

    setDay(d => d + 1);

    if (newCash < 0) {
      const shortfall   = Math.abs(newCash);
      const bailoutLoan = Math.round(shortfall * (1 + BAILOUT_INTEREST));
      setCash(0);
      setLoanBalance(newLoan + bailoutLoan);
      setBailoutContext({ shortfall, bailoutLoan, newLoanBalance: newLoan + bailoutLoan });
      setPhase("bailout");
    } else {
      setCash(newCash);
      setLoanBalance(newLoan);
      setTab("inventory");
      setPhase("between");
    }
  }

  function handleExtendLoan() {
    setBailoutContext(null);
    setTab("inventory");
    setPhase("between");
  }

  function handleCloseShop() {
    setBailoutContext(null);
    setPhase("gameover");
  }

  // ── Between → start next day ───────────────────────────────────────────────
  function handleStartNextDay() {
    const stockedItems = inventory.map(i => ({ shoeId: i.shoeId, size: i.size }));
    const sellBuyers   = generateSellChanceBuyers(inventory, dailyMarkets, brandTrends, styleTrends, upgrades.hasMarketing);
    const regularCust  = generateCustomers(dailyMarkets, stockedItems, day, recentReleaseIds, featuredShoes, adActive, upgrades.hasMarketing);
    setCustomers([...sellBuyers, ...regularCust]);
    setInventory(prev => prev.map(i => ({ ...i, daysListed: (i.daysListed ?? 0) + 1 })));
    setTransactions([]);
    setHoursLeft(10);
    setFakesReceived([]);
    setFeaturedShoes([]);
    setAdActive(false);
    setTab("customers");
    setPhase("day");
  }

  // ── Upgrade purchases ──────────────────────────────────────────────────────
  function handleBuyUpgrade(key) {
    const week = Math.ceil(day / 7);
    if (key === "storagePlus50") {
      if (upgrades.storagePlus50 || cash < 2000) return;
      setCash(p => p - 2000);
      setUpgrades(p => ({ ...p, storagePlus50: true }));
      setExpenseLog(prev => [...prev, { week, label: "Upgrade: Storage +50", amount: -2000 }]);
    } else if (key === "storagePlus100") {
      if (upgrades.storagePlus100 || cash < 4500) return;
      setCash(p => p - 4500);
      setUpgrades(p => ({ ...p, storagePlus100: true }));
      setExpenseLog(prev => [...prev, { week, label: "Upgrade: Storage +100", amount: -4500 }]);
    } else if (key === "authApp") {
      if (cash < 100) return;
      setUpgrades(p => ({ ...p, authTier: "app" }));
    } else if (key === "authEmployee") {
      if (cash < 1500) return;
      setUpgrades(p => ({ ...p, authTier: "employee" }));
    } else if (key === "authNone") {
      setUpgrades(p => ({ ...p, authTier: "none" }));
    } else if (key === "marketing") {
      if (upgrades.hasMarketing || cash < 1500) return;
      setUpgrades(p => ({ ...p, hasMarketing: true }));
    } else if (key === "marketingCancel") {
      setUpgrades(p => ({ ...p, hasMarketing: false }));
    } else if (key === "keyMaster") {
      if (upgrades.hasKeyMaster || cash < 5000) return;
      setCash(p => p - 5000);
      setUpgrades(p => ({ ...p, hasKeyMaster: true }));
      setExpenseLog(prev => [...prev, { week, label: "Upgrade: Key Master", amount: -5000 }]);
    }
  }

  // ── Key Master vault management ────────────────────────────────────────────
  function handleAddToKeyMaster(item) {
    if (keyMasterShoes.length >= 10) return;
    setInventory(prev => {
      const updated = prev.map(i =>
        i.shoeId === item.shoeId && i.size === item.size
          ? { ...i, quantity: i.quantity - 1 }
          : i
      ).filter(i => i.quantity > 0);
      return updated;
    });
    setKeyMasterShoes(prev => [...prev, {
      shoeId: item.shoeId,
      brand: item.brand,
      model: item.model,
      colorway: item.colorway,
      size: item.size,
      totalEarned: 0,
    }]);
  }

  function handleRemoveFromKeyMaster(shoeId, size) {
    if (inventoryCount >= effectiveInventoryCap) return;
    const shoe = keyMasterShoes.find(s => s.shoeId === shoeId && s.size === size);
    if (!shoe) return;
    setKeyMasterShoes(prev => prev.filter(s => !(s.shoeId === shoeId && s.size === size)));
    setInventory(prev => {
      const existing = prev.find(i => i.shoeId === shoeId && i.size === size);
      if (existing) {
        return prev.map(i =>
          i.shoeId === shoeId && i.size === size ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, {
        shoeId, brand: shoe.brand, model: shoe.model, colorway: shoe.colorway,
        size, quantity: 1, avgPurchasePrice: 0, listPrice: 0,
      }];
    });
  }

  function handleFeatureToggle(shoeId, size) {
    setFeaturedShoes(prev => {
      const exists = prev.some(f => f.shoeId === shoeId && f.size === size);
      if (exists) return prev.filter(f => !(f.shoeId === shoeId && f.size === size));
      if (prev.length >= 10) return prev;
      return [...prev, { shoeId, size }];
    });
  }

  function handleBuyAd() {
    if (adActive || cash < 100) return;
    setCash(prev => prev - 100);
    setAdActive(true);
    setExpenseLog(prev => [...prev, { week: Math.ceil(day / 7), label: "Social Media Ad", amount: -100 }]);
  }

  // ── Raffle/preorder complete ───────────────────────────────────────────────
  function handleCompleteRaffles(wonItems, totalCost, marketUpdates) {
    if (wonItems.length > 0) {
      setCash(prev => prev - totalCost);
      setDailyMarkets(prev => ({ ...prev, ...marketUpdates }));
      const newIds = wonItems.map(i => i.shoeId);
      setRecentReleaseIds(newIds);
      setInventory(prev => {
        let inv = [...prev];
        for (const item of wonItems) {
          const existing = inv.find(i => i.shoeId === item.shoeId && i.size === item.size);
          if (existing) {
            const qty   = existing.quantity + 1;
            const total = existing.avgPurchasePrice * existing.quantity + item.avgPurchasePrice;
            inv = inv.map(i =>
              i.shoeId === item.shoeId && i.size === item.size
                ? { ...i, quantity: qty, avgPurchasePrice: Math.round(total / qty) }
                : i
            );
          } else {
            inv = [...inv, item];
          }
        }
        return inv;
      });
    } else {
      setRecentReleaseIds([]);
    }
    setRafflesDoneForWeek(Math.ceil(day / 7));
    setPhase("between");
  }

  // ── Record a transaction ───────────────────────────────────────────────────
  function handleTransaction(customerId, result) {
    setHoursLeft(prev => Math.max(0, prev - (result.timeCost ?? 0)));
    setCash(prev => prev + result.cashDelta);

    setInventory(prev => {
      let inv = [...prev];

      if (result.inventoryRemove) {
        const { shoeId, size } = result.inventoryRemove;
        inv = inv
          .map(item =>
            item.shoeId === shoeId && item.size === size
              ? { ...item, quantity: item.quantity - 1 }
              : item
          )
          .filter(item => item.quantity > 0);
      }

      if (result.inventoryAdd) {
        const add = result.inventoryAdd;
        const existing = inv.find(i => i.shoeId === add.shoeId && i.size === add.size);
        if (existing) {
          const totalQty  = existing.quantity + 1;
          const totalCost = existing.avgPurchasePrice * existing.quantity + add.avgPurchasePrice;
          inv = inv.map(i =>
            i.shoeId === add.shoeId && i.size === add.size
              ? { ...i, quantity: totalQty, avgPurchasePrice: Math.round(totalCost / totalQty), daysListed: 0 }
              : i
          );
        } else {
          inv = [...inv, { ...add, daysListed: 0 }];
        }
      }

      return inv;
    });

    setCustomers(prev =>
      prev.map(c => c.id === customerId ? { ...c, served: true, outcome: result.outcome } : c)
    );
    setTransactions(prev => [...prev, { customerId, ...result }]);

    if (result.missedShoe) {
      const m = result.missedShoe;
      setMissedDemand(prev => {
        const idx = prev.findIndex(d => d.shoeId === m.shoeId && d.size === m.size);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], count: next[idx].count + 1 };
          return next;
        }
        return [...prev, { ...m, count: 1 }];
      });
    }

    setActiveCustomer(null);
  }

  // ── Auth / save gates ─────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="auth-loading">
        <div className="auth-loading-brand">SOLE PROPRIETOR</div>
        <div className="auth-loading-msg">Loading…</div>
      </div>
    );
  }

  if (user && !currentSaveId) {
    return (
      <>
        <SaveSelectScreen
          saves={saveSlots}
          loading={false}
          onLoad={handleSelectSave}
          onNewRun={handleNewRun}
          onDelete={handleDeleteSave}
          onBack={prevSaveIdRef.current ? () => setCurrentSaveId(prevSaveIdRef.current) : undefined}
        />
        {authModal && (
          <AuthModal
            initialMode={authModal}
            onClose={authModal === "setpassword" ? undefined : () => setAuthModal(null)}
            onPasswordUpdated={() => { setAuthModal(null); loadSaves(user?.id); }}
          />
        )}
      </>
    );
  }

  // ── Phase renders ──────────────────────────────────────────────────────────

  if (phase === "bailout") {
    return (
      <BailoutScreen
        shortfall={bailoutContext.shortfall}
        bailoutLoan={bailoutContext.bailoutLoan}
        newLoanBalance={bailoutContext.newLoanBalance}
        weeklyPayment={WEEKLY_LOAN}
        day={fmtDay(day)}
        onExtend={handleExtendLoan}
        onClose={handleCloseShop}
      />
    );
  }

  if (phase === "gameover") {
    return (
      <div className="container" style={{ textAlign: "center", paddingTop: 80 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
        <h2>Shop Closed</h2>
        <p style={{ color: "var(--text-2)", marginBottom: 32 }}>
          You couldn't cover expenses. The shop is done.
        </p>
        <button className="primary-btn" onClick={() => window.location.reload()}>
          Start Over
        </button>
      </div>
    );
  }

  if (phase === "endofday") {
    const fakes = inventory.filter(i => i.isFake);
    const { results: kmResults, income: kmIncome } = endOfDayKm;

    return (
      <EndOfDayScreen
        day={fmtDay(day)}
        nextDay={fmtDay(day + 1)}
        cash={cash}
        transactions={transactions}
        fakes={fakes}
        kmIncome={kmIncome}
        kmResults={kmResults}
        onAdjustPrices={() => {
          setInventory(prev => prev.filter(i => !i.isFake));
          setFakesReceived(fakes);
          if (kmResults.length > 0) {
            const keptShoes = kmResults.filter(r => !r.won).map(r => ({ ...r.shoe, totalEarned: r.shoe.totalEarned + r.earned }));
            const winLog    = kmResults.filter(r => r.won).map(r => ({ week: Math.ceil(day / 7), label: `Key Master Win: ${r.shoe.model} Sz ${r.shoe.size}`, amount: 0 }));
            setKeyMasterShoes(keptShoes);
            if (winLog.length > 0) setExpenseLog(prev => [...prev, ...winLog]);
          }
          handleGoToBetween(kmIncome);
        }}
      />
    );
  }

  if (phase === "between") {
    const currentWeek  = Math.ceil(day / 7);
    const rafflesReady = day >= 8 && day % 7 === 1 && rafflesDoneForWeek < currentWeek;
    const isWeekBoundary = day % 7 === 1 && day > 1;
    const betweenTab     = isWeekBoundary && ["inventory", "growth"].includes(tab) ? tab
                         : isWeekBoundary ? "growth"
                         : "inventory";
    return (
      <div>
        <div className="top-bar">
          <div className="top-bar-left">
            <span className="top-bar-brand">SOLE PROPRIETOR</span>
            <span className="top-bar-day">{fmtDay(day)}</span>
          </div>
          <div className="top-bar-right">
            <span className="top-bar-stat">
              <span className="top-bar-stat-label">Cash</span>
              ${cash.toLocaleString()}
            </span>
            <span className="top-bar-stat top-bar-due">
              <span className="top-bar-stat-label">Due EOW</span>
              ${projectedWeeklyTotal.toLocaleString()}
            </span>
            <span className={`top-bar-stat${inventoryCount >= effectiveInventoryCap - 5 ? " inv-warn" : ""}`}>
              <span className="top-bar-stat-label">Inv</span>
              {inventoryCount}/{effectiveInventoryCap}
            </span>
          </div>
          <div className="top-bar-auth">
            {user ? (
              <>
                <button className="top-bar-signout" onClick={() => { prevSaveIdRef.current = currentSaveId; setCurrentSaveId(null); }} title="Switch run">💾</button>
                <button className="top-bar-signout" onClick={() => supabase.auth.signOut()} title="Sign out">↪</button>
              </>
            ) : (
              <button className="top-bar-save-prompt" onClick={() => setAuthModal("login")}>Log in</button>
            )}
          </div>
        </div>

        {betweenTab === "inventory" && (
          <InventoryTab
            inventory={inventory}
            setInventory={setInventory}
            dailyMarkets={dailyMarkets}
            prevDailyMarkets={prevDailyMarkets}
            brandTrends={brandTrends}
            styleTrends={styleTrends}
            missedDemand={missedDemand}
            canEditPrices={true}
            onStartDay={handleStartNextDay}
            onRaffle={rafflesReady ? () => setPhase("raffle") : null}
            day={fmtDay(day)}
            inventoryCount={inventoryCount}
            effectiveInventoryCap={effectiveInventoryCap}
            featuredShoes={featuredShoes}
            onFeatureToggle={handleFeatureToggle}
            adActive={adActive}
            onBuyAd={handleBuyAd}
            cash={cash}
            keyMasterShoes={keyMasterShoes}
            hasKeyMaster={upgrades.hasKeyMaster}
            onAddToKeyMaster={handleAddToKeyMaster}
            onRemoveFromKeyMaster={handleRemoveFromKeyMaster}
          />
        )}

        {betweenTab === "growth" && (
          <GrowthTab
            upgrades={upgrades}
            cash={cash}
            phase={phase}
            day={day}
            onBuyUpgrade={handleBuyUpgrade}
          />
        )}

        <div className="bottom-nav">
          <button className={betweenTab === "inventory" ? "active" : ""} onClick={() => setTab("inventory")}>
            Inventory
          </button>
          {isWeekBoundary && (
            <button className={betweenTab === "growth" ? "active" : ""} onClick={() => setTab("growth")}>
              Growth
            </button>
          )}
        </div>

        {authModal && (
          <AuthModal
            initialMode={authModal}
            onClose={authModal === "setpassword" ? undefined : () => setAuthModal(null)}
            onPasswordUpdated={() => { setAuthModal(null); loadSaves(user?.id); }}
          />
        )}
      </div>
    );
  }

  if (phase === "raffle") {
    return (
      <RaffleScreen
        releases={raffleReleases}
        cash={cash}
        weekNumber={Math.ceil(day / 7)}
        inventoryCount={inventoryCount}
        inventoryCap={effectiveInventoryCap}
        onComplete={handleCompleteRaffles}
        onSkip={() => { setRecentReleaseIds([]); setRafflesDoneForWeek(Math.ceil(day / 7)); setPhase("between"); }}
      />
    );
  }

  // ── Phase: day ─────────────────────────────────────────────────────────────
  const unserved = customers.filter(c => !c.served);
  const canServeAny =
    (unserved.some(c => c.type === "BUY")   && hoursLeft >= 0.25) ||
    (unserved.some(c => c.type === "SELL" || c.type === "TRADE") && hoursLeft >= 0.5);
  const allDone = !canServeAny;
  const nearCap = inventoryCount >= effectiveInventoryCap - 5;

  return (
    <div>
      <div className="top-bar">
        <div className="top-bar-left">
          <span className="top-bar-brand">SOLE PROPRIETOR</span>
          <span className="top-bar-day">{fmtDay(day)}</span>
        </div>
        <div className="top-bar-right">
          <span className="top-bar-stat">
            <span className="top-bar-stat-label">Cash</span>
            ${cash.toLocaleString()}
          </span>
          <span className="top-bar-stat top-bar-due">
            <span className="top-bar-stat-label">Due EOW</span>
            ${projectedWeeklyTotal.toLocaleString()}
          </span>
          <span className={`top-bar-stat${hoursLeft <= 1 ? " inv-warn" : ""}`}>
            <span className="top-bar-stat-label">Hours</span>
            {hoursLeft.toFixed(2)}h
          </span>
          <span className={`top-bar-stat${nearCap ? " inv-warn" : ""}`}>
            <span className="top-bar-stat-label">Inv</span>
            {inventoryCount}/{effectiveInventoryCap}
          </span>
        </div>
        <div className="top-bar-auth">
          {user ? (
            <>
              <button className="top-bar-signout" onClick={() => { prevSaveIdRef.current = currentSaveId; setCurrentSaveId(null); }} title="Switch run">💾</button>
              <button className="top-bar-signout" onClick={() => supabase.auth.signOut()} title="Sign out">↪</button>
            </>
          ) : (
            <button className="top-bar-save-prompt" onClick={() => setAuthModal("login")}>Log in</button>
          )}
        </div>
      </div>

      {tab === "customers" && (
        <CustomersTab
          customers={customers}
          hoursLeft={hoursLeft}
          allDone={allDone}
          onMeetType={(type) => {
            const next = customers.find(c => c.type === type && !c.served);
            if (next) setActiveCustomer(next);
          }}
          onEndDay={() => {
            const results = upgrades.hasKeyMaster ? keyMasterShoes.map(shoe => ({
              shoe,
              earned: Math.round((dailyMarkets[shoe.shoeId]?.low ?? 0) * 0.02),
              won:    Math.random() < 0.01,
            })) : [];
            setEndOfDayKm({ results, income: results.reduce((s, r) => s + r.earned, 0) });
            setPhase("endofday");
          }}
        />
      )}

      {tab === "inventory" && (
        <InventoryTab
          inventory={inventory}
          setInventory={setInventory}
          dailyMarkets={dailyMarkets}
          prevDailyMarkets={prevDailyMarkets}
          brandTrends={brandTrends}
          styleTrends={styleTrends}
          missedDemand={missedDemand}
          canEditPrices={false}
          inventoryCount={inventoryCount}
          effectiveInventoryCap={effectiveInventoryCap}
          keyMasterShoes={keyMasterShoes}
          hasKeyMaster={upgrades.hasKeyMaster}
        />
      )}

      {tab === "growth" && (
        <GrowthTab
          upgrades={upgrades}
          cash={cash}
          phase={phase}
          day={day}
          onBuyUpgrade={handleBuyUpgrade}
        />
      )}

      {tab === "transactions" && (
        <TransactionsTab transactions={transactions} />
      )}

      {tab === "expenses" && (
        <ExpensesTab
          loanBalance={loanBalance}
          expenseLog={expenseLog}
          day={day}
          weeklyLoan={WEEKLY_LOAN}
          weeklyRent={WEEKLY_RENT}
          weeklyUtil={WEEKLY_UTIL}
          upgrades={upgrades}
        />
      )}

      <div className="bottom-nav">
        <button className={tab === "customers"    ? "active" : ""} onClick={() => setTab("customers")}>
          Customers
        </button>
        <button className={tab === "transactions" ? "active" : ""} onClick={() => setTab("transactions")}>
          Sales
        </button>
        <button className={tab === "inventory"    ? "active" : ""} onClick={() => setTab("inventory")}>
          Inventory
        </button>
        <button className={tab === "expenses"     ? "active" : ""} onClick={() => setTab("expenses")}>
          Expenses
        </button>
        <button className={tab === "growth"       ? "active" : ""} onClick={() => setTab("growth")}>
          Growth
        </button>
      </div>

      {showGuide && <StartupGuide onClose={() => setShowGuide(false)} />}

      {!user && day >= 3 && phase === "day" && tab === "customers" && (
        <div className="save-nudge">
          <span>Log in to save your progress across sessions.</span>
          <button onClick={() => setAuthModal("login")}>Log in / Sign up</button>
          <button className="save-nudge-dismiss" onClick={e => e.currentTarget.parentElement.remove()}>✕</button>
        </div>
      )}

      {authModal && (
        <AuthModal
          initialMode={authModal}
          onClose={authModal === "setpassword" ? undefined : () => setAuthModal(null)}
          onPasswordUpdated={() => { setAuthModal(null); loadSaves(user?.id); }}
        />
      )}

      {activeCustomer && (
        <InteractionModal
          customer={activeCustomer}
          inventory={inventory}
          dailyMarkets={dailyMarkets}
          brandTrends={brandTrends}
          styleTrends={styleTrends}
          cash={cash}
          inventoryCount={inventoryCount}
          inventoryCap={effectiveInventoryCap}
          hoursLeft={hoursLeft}
          authTier={upgrades.authTier}
          onTransaction={handleTransaction}
          onClose={() => setActiveCustomer(null)}
        />
      )}
    </div>
  );
}
