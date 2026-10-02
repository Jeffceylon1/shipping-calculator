// Cost estimate document (simple receipt style) for the customer page: one canvas design feeds print, PNG, PDF and share.
(function (global) {
  const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  const C = { accent: "#1f5eff", ink: "#1d2433", muted: "#667085", line: "#d0d5dd" };
  const W = 1080;
  const PAD = 56;

  function wrap(ctx, text, maxWidth) {
    const lines = [];
    for (const para of String(text).split("\n")) {
      let line = "";
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const next = line ? `${line} ${word}` : word;
        if (line && ctx.measureText(next).width > maxWidth) { lines.push(line); line = word; }
        else line = next;
      }
      lines.push(line);
    }
    return lines;
  }

  /** Set the largest font (down to min) at which text fits maxWidth. */
  function fitFont(ctx, text, weight, size, min, family, maxWidth) {
    for (; size > min; size -= 1) {
      ctx.font = `${weight} ${size}px ${family}`;
      if (ctx.measureText(text).width <= maxWidth) return;
    }
    ctx.font = `${weight} ${min}px ${family}`;
  }

  function fieldLabel(ctx, text, x, y, color = C.muted) {
    ctx.font = `700 18px ${FONT}`;
    ctx.fillStyle = color;
    ctx.letterSpacing = "2px";
    ctx.fillText(text.toUpperCase(), x, y);
    ctx.letterSpacing = "0px";
  }

  /**
   * q: { brand, route, number, dateText, countText, weightText, chargedText?,
   *      items: [{ name, meta, buying, shipping, cost, sellUnit, markup, sell }],
   *      totals: { price, ship, cost, sell }, profit, shippingNote?,
   *      amountCur, fxLine?, note?, contact? }
   * number: digits only (e.g. "1001"); shown as "No. 1001".
   * route: the admin's destination name; "" hides it everywhere.
   * profit: formatted, may start with "-" (shown red) else green.
   */
  function drawQuote(q) {
    const draft = document.createElement("canvas");
    draft.width = W;
    draft.height = 2200 + q.items.length * 132;
    const x = draft.getContext("2d");
    x.fillStyle = "#fff";
    x.fillRect(0, 0, W, draft.height);
    x.textBaseline = "alphabetic";
    const inner = W - PAD * 2;

    // Header: business + route left, receipt number + date right
    let y = PAD + 44;
    x.textAlign = "left";
    x.fillStyle = C.ink;
    fitFont(x, q.brand || "Cost Estimate", 700, 44, 28, FONT, inner * 0.62);
    x.fillText(q.brand || "Cost Estimate", PAD, y);
    const subtitle = q.route || "Cost estimate";
    if (subtitle) {
      x.fillStyle = C.muted;
      fitFont(x, subtitle, 400, 24, 18, FONT, inner * 0.62);
      x.fillText(subtitle, PAD, y + 40);
    }
    x.textAlign = "right";
    x.fillStyle = C.ink;
    fitFont(x, `No. ${q.number}`, 700, 32, 22, FONT, inner * 0.34);
    x.fillText(`No. ${q.number}`, W - PAD, y);
    x.fillStyle = C.muted;
    x.font = `400 24px ${FONT}`;
    x.fillText(q.dateText, W - PAD, y + 40);
    x.textAlign = "left";
    y += 72;
    x.fillStyle = C.accent;
    x.fillRect(PAD, y, inner, 4);
    y += 4;

    // Shipment summary line
    y += 52;
    const summary = `${q.countText} · ${q.weightText}${q.chargedText ? ` · charged as ${q.chargedText}` : ""}`;
    x.fillStyle = C.muted;
    fitFont(x, summary, 400, 24, 18, FONT, inner);
    x.fillText(summary, PAD, y);

    // Products table: Product (name / meta / buying / shipping) | Cost | Selling (each) + markup | Selling total
    const COLW = 200; // max width of each money column
    const col = { name: PAD, cost: PAD + 570, unit: PAD + 790, sell: W - PAD };
    const NAME_MAX = col.cost - COLW - 16 - PAD; // 354px
    const fit = (text, max) => {
      if (x.measureText(text).width <= max) return text;
      let t = text;
      while (t.length > 1 && x.measureText(`${t}…`).width > max) t = t.slice(0, -1);
      return `${t.trimEnd()}…`;
    };
    const money = (text, xPos, weight, size, baseline, color = C.ink) => {
      x.textAlign = "right";
      x.fillStyle = color;
      fitFont(x, text, weight, size, 14, FONT, COLW);
      x.fillText(text, xPos, baseline);
    };
    const rule = (color = C.line) => { x.fillStyle = color; x.fillRect(PAD, y - 1, inner, 2); };
    y += 64;
    fieldLabel(x, "Product", col.name, y);
    x.textAlign = "right";
    fieldLabel(x, `Cost (${q.amountCur})`, col.cost, y);
    fieldLabel(x, "Selling (each)", col.unit, y);
    fieldLabel(x, "Selling total", col.sell, y);
    x.textAlign = "left";
    y += 18;
    rule();
    for (const it of q.items) {
      x.textAlign = "left";
      x.fillStyle = C.ink;
      x.font = `600 26px ${FONT}`;
      x.fillText(fit(it.name, NAME_MAX), col.name, y + 36);
      x.fillStyle = C.muted;
      x.font = `400 20px ${FONT}`;
      x.fillText(fit(it.meta || "", NAME_MAX), col.name, y + 62);
      x.fillText(fit(`Buying ${it.buying}`, NAME_MAX), col.name, y + 88);
      x.fillText(fit(`Shipping ${it.shipping}`, NAME_MAX), col.name, y + 112);
      money(it.cost, col.cost, 400, 24, y + 48);
      money(it.sellUnit, col.unit, 400, 24, y + 48);
      money(it.markup || "", col.unit, 400, 18, y + 76, C.muted);
      money(it.sell, col.sell, 700, 24, y + 48);
      y += 130;
      rule();
    }
    // Totals row
    x.textAlign = "left";
    x.fillStyle = C.ink;
    x.font = `700 26px ${FONT}`;
    x.fillText("All products", col.name, y + 40);
    money(q.totals.cost, col.cost, 700, 24, y + 40);
    money(q.totals.sell, col.sell, 700, 24, y + 40);
    y += 60;
    if (q.shippingNote) {
      x.fillStyle = C.muted;
      x.font = `400 22px ${FONT}`;
      x.textAlign = "left";
      for (const line of wrap(x, q.shippingNote, inner)) { y += 30; x.fillText(line, PAD, y); }
    }

    // Summary: thin rule, then right-aligned label + amount lines
    y += 36;
    rule();
    const sumLine = (label, value, size, weight, color, gap) => {
      y += gap;
      x.textAlign = "right";
      x.fillStyle = color;
      fitFont(x, value, weight, size, Math.min(size, 26), FONT, inner * 0.6);
      const w = x.measureText(value).width;
      x.fillText(value, W - PAD, y);
      x.fillStyle = C.muted;
      x.font = `400 24px ${FONT}`;
      x.fillText(label, W - PAD - w - 24, y);
    };
    sumLine("Total cost", q.totals.cost, 30, 600, C.ink, 52);
    sumLine("Selling total", q.totals.sell, 50, 800, C.ink, 68);
    const neg = String(q.profit).trim().startsWith("-");
    sumLine("Profit", q.profit, 30, 700, neg ? "#b42318" : "#067647", 52);
    x.textAlign = "left";

    if (q.fxLine) {
      y += 52;
      x.fillStyle = C.muted;
      x.font = `400 22px ${FONT}`;
      x.fillText(q.fxLine, PAD, y);
    }

    if (q.note) {
      y += 16;
      x.fillStyle = C.muted;
      x.font = `400 24px ${FONT}`;
      for (const line of wrap(x, q.note, inner)) { y += 34; x.fillText(line, PAD, y); }
    }

    // Contact + thank-you
    y += 24;
    x.fillStyle = C.ink;
    x.font = `700 28px ${FONT}`;
    for (const line of q.contact ? wrap(x, q.contact, inner) : []) { y += 40; x.fillText(line, PAD, y); }
    y += 40;
    x.fillStyle = C.muted;
    x.font = `400 22px ${FONT}`;
    x.fillText("Thank you for your business.", PAD, y);
    y += PAD;

    const out = document.createElement("canvas");
    out.width = W;
    out.height = Math.ceil(y);
    out.getContext("2d").drawImage(draft, 0, 0);
    return out;
  }

  const toBlob = (canvas, type, quality) => {
    const { promise, resolve, reject } = Promise.withResolvers();
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), type, quality);
    return promise;
  };

  /** Single-page A4 PDF embedding the quote as a JPEG. No dependencies. */
  async function toPdfBlob(canvas) {
    const jpeg = new Uint8Array(await (await toBlob(canvas, "image/jpeg", 0.92)).arrayBuffer());
    const pageW = 595.28, pageH = 841.89, margin = 36;
    let drawW = pageW - margin * 2;
    let drawH = (drawW * canvas.height) / canvas.width;
    if (drawH > pageH - margin * 2) { drawH = pageH - margin * 2; drawW = (drawH * canvas.width) / canvas.height; }
    const left = (pageW - drawW) / 2;
    const bottom = pageH - margin - drawH;

    const enc = new TextEncoder();
    const chunks = [];
    const offsets = [];
    let length = 0;
    const push = (d) => { const b = typeof d === "string" ? enc.encode(d) : d; chunks.push(b); length += b.length; };
    const obj = (n, write) => { offsets[n] = length; push(`${n} 0 obj\n`); write(); push("\nendobj\n"); };

    push("%PDF-1.4\n");
    push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])); // binary marker comment
    obj(1, () => push("<< /Type /Catalog /Pages 2 0 R >>"));
    obj(2, () => push("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"));
    obj(3, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] `
      + "/Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>"));
    obj(4, () => {
      push(`<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} `
        + `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
      push(jpeg);
      push("\nendstream");
    });
    const content = `q ${drawW.toFixed(2)} 0 0 ${drawH.toFixed(2)} ${left.toFixed(2)} ${bottom.toFixed(2)} cm /Im0 Do Q`;
    obj(5, () => push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`));

    const xref = length;
    let table = "xref\n0 6\n0000000000 65535 f \n";
    for (let n = 1; n <= 5; n++) table += `${String(offsets[n]).padStart(10, "0")} 00000 n \n`;
    push(`${table}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    return new Blob(chunks, { type: "application/pdf" });
  }

  function download(blob, filename) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  }

  /** One-line caption sent alongside the quote image. */
  const caption = (q) => `${q.brand} – Cost estimate No. ${q.number}: ${q.items.length} product${q.items.length === 1 ? "" : "s"}, `
    + `${q.weightText} · Cost ${q.totals.cost} · Selling ${q.totals.sell}`;

  /** Full plain-text quote (Copy text / Email). */
  function text(q) {
    const lines = [
      `${q.brand} – COST ESTIMATE No. ${q.number}`,
      ...(q.route ? [q.route] : []),
      `Date: ${q.dateText}`,
      `${q.countText} · Total weight: ${q.weightText}${q.chargedText ? ` (charged as ${q.chargedText})` : ""}`,
      "",
      ...q.items.map((it, i) => `${i + 1}. ${it.name} (${it.meta}): cost ${it.cost} · selling ${it.sellUnit} each (${it.markup}) · total ${it.sell}`),
      "",
      `Total cost: ${q.totals.cost}`,
      `Selling total: ${q.totals.sell}`,
      `Profit: ${q.profit}`,
    ];
    if (q.fxLine) lines.push(q.fxLine);
    if (q.note) lines.push("", q.note);
    if (q.contact) lines.push("", q.contact);
    return lines.join("\n");
  }

  global.Quote = { drawQuote, toBlob, toPdfBlob, download, caption, text };
})(window);
