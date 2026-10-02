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

  global.Shipping = { num, round2, calculate, formatMoney };
})(window);
