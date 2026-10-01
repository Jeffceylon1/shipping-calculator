// Shared by the customer page (index.html) and the local admin page (../admin.html).
// This file is deployed publicly: never put admin-only values (base rate, hidden cost) here.
(function (global) {
  const num = (v) => {
    const n = parseFloat(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

  function roundUp(weight, step) {
    if (!step) return weight;
    // Tolerance stops float noise (e.g. 2.0000000001) from bumping a full step.
    return Math.ceil(weight / step - 1e-9) * step;
  }

  /**
   * Pure pricing function.
   * s: rate settings (hiddenPct optional; published customer rates have it baked into perKg/firstKg).
   * input: { weight, qty, len, wid, hei, zoneIndex, orderValue }
   */
  function calculate(s, input) {
    const qty = Math.max(1, Math.floor(num(input.qty)) || 1);
    const actualPer = num(input.weight);
    const dims = num(input.len) * num(input.wid) * num(input.hei);
    const volumetricPer = s.volDivisor > 0 && dims > 0 ? dims / s.volDivisor : 0;
    const billedPer = Math.max(actualPer, volumetricPer);
    const chargeablePer = roundUp(Math.max(billedPer, s.minWeight), s.roundTo);
    const chargeable = chargeablePer * qty;

    // Hidden cost is baked into the per-kg price the customer sees.
    const markup = 1 + (s.hiddenPct || 0) / 100;
    const ratePerKg = s.perKg * markup;
    const firstKgRate = s.firstKg * markup;
    // Rates apply per package: first kg of each package at firstKg rate when set.
    const perPackageWeightCharge = s.firstKg > 0
      ? (chargeablePer > 0 ? firstKgRate + Math.max(0, chargeablePer - 1) * ratePerKg : 0)
      : chargeablePer * ratePerKg;
    const zone = s.zones[input.zoneIndex] || s.zones[0] || { name: "-", multiplier: 1 };
    const weightCharge = perPackageWeightCharge * qty * zone.multiplier;
    const hiddenCost = weightCharge - weightCharge / markup;
    const fuel = weightCharge * (s.fuelPct / 100);
    const handling = s.handling * qty;
    const subtotalRaw = s.baseFee + weightCharge + fuel + handling;
    const minApplied = subtotalRaw > 0 && subtotalRaw < s.minCharge;
    let subtotal = minApplied ? s.minCharge : subtotalRaw;

    const orderValue = num(input.orderValue);
    const free = s.freeOver > 0 && orderValue >= s.freeOver;
    if (free) subtotal = 0;
    const tax = subtotal * (s.taxPct / 100);

    return {
      qty, actualPer, volumetricPer, chargeablePer, chargeable, zone,
      ratePerKg: round2(ratePerKg),
      hiddenCost: round2(hiddenCost),
      weightCharge: round2(weightCharge),
      fuel: round2(fuel),
      handling: round2(handling),
      baseFee: round2(s.baseFee),
      minApplied, free,
      subtotal: round2(subtotal),
      tax: round2(tax),
      total: round2(subtotal + tax),
    };
  }

  function formatMoney(n, cur) {
    try { return new Intl.NumberFormat(undefined, { style: "currency", currency: cur }).format(n); }
    catch { return `${cur} ${n.toFixed(2)}`; }
  }

  const FX_TARGET = "LKR";
  const FX_KEY = "shippingCalc.fx.v1";
  const DISPLAY_KEY = "shippingCalc.display.v1";

  async function fetchRate(base) {
    const sources = [
      ["Coinbase", async () => {
        const res = await fetch(`https://api.coinbase.com/v2/exchange-rates?currency=${base}`, { cache: "no-store" });
        return parseFloat((await res.json()).data.rates[FX_TARGET]);
      }],
      ["ExchangeRate-API", async () => {
        const res = await fetch(`https://open.er-api.com/v6/latest/${base}`, { cache: "no-store" });
        return parseFloat((await res.json()).rates[FX_TARGET]);
      }],
    ];
    for (const [source, get] of sources) {
      try {
        const rate = await get();
        if (rate > 0) return { base, rate, source, at: Date.now() };
      } catch {}
    }
    return null;
  }

  /**
   * Base-currency ↔ LKR display switch with a live exchange rate.
   * toggle: element containing buttons with data-cur="base" and data-cur="LKR".
   * Refreshes the rate on first use, on switching to LKR, every minute while visible, and on tab return.
   */
  function createCurrencyView({ toggle, getBase, onChange }) {
    let display = localStorage.getItem(DISPLAY_KEY) === FX_TARGET ? FX_TARGET : "base";
    let fx = null; // { base, rate, source, at }
    try { fx = JSON.parse(localStorage.getItem(FX_KEY)); } catch {}
    let error = false;
    let requestedFor = null;

    const ready = () => !!fx && fx.base === getBase();

    async function refresh() {
      const base = getBase();
      if (base === FX_TARGET) return;
      const next = await fetchRate(base);
      if (base !== getBase()) return; // base currency changed while fetching
      error = !next;
      if (next) { fx = next; localStorage.setItem(FX_KEY, JSON.stringify(fx)); }
      onChange();
    }

    toggle.addEventListener("click", (e) => {
      const cur = e.target.dataset.cur;
      if (!cur) return;
      display = cur === FX_TARGET ? FX_TARGET : "base";
      localStorage.setItem(DISPLAY_KEY, display);
      onChange();
      if (display === FX_TARGET) refresh();
    });
    setInterval(() => { if (!document.hidden) refresh(); }, 60_000);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
    return {
      /** Current display: "base" or "LKR". */
      display: () => display,
      /** Live rate for the current base currency, or null if not loaded. */
      fx: () => (ready() ? { ...fx } : null),
      money(n) {
        const base = getBase();
        return display === FX_TARGET && base !== FX_TARGET && ready()
          ? formatMoney(n * fx.rate, FX_TARGET)
          : formatMoney(n, base);
      },
      /** Updates the toggle and returns the exchange-rate status line. */
      sync() {
        const base = getBase();
        if (base !== FX_TARGET && requestedFor !== base) { requestedFor = base; refresh(); }
        toggle.hidden = base === FX_TARGET;
        toggle.querySelector('[data-cur="base"]').textContent = base;
        for (const b of toggle.children) b.classList.toggle("on", (b.dataset.cur === FX_TARGET) === (display === FX_TARGET));
        if (base === FX_TARGET) return "";
        if (ready()) {
          return `1 ${base} = ${fx.rate.toFixed(2)} ${FX_TARGET} · updated ${new Date(fx.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · ${fx.source}`
            + (error ? " · offline, using last known rate" : "");
        }
        return error ? `Could not load ${base} → ${FX_TARGET} rate; showing ${base}` : "Loading live exchange rate…";
      },
    };
  }

  global.Shipping = { num, round2, calculate, formatMoney, createCurrencyView };
})(window);
