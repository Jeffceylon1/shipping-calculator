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
   * q: { brand, route?, number, dateText, countText, weightText, chargedText?,
   *      items: [{ name, meta, price, ship, cost }], totals: { price, ship, cost }, shippingNote?,
   *      amountCur, totalLabel, primary, secondary?, fxLine?, note?, contact? }
   * number: digits only (e.g. "1001"); shown as "No. 1001".
   * route: the admin's destination name; "" hides it everywhere.
   */
  function drawQuote(q) {
    const draft = document.createElement("canvas");
    draft.width = W;
    draft.height = 2000 + q.items.length * 84;
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
    const subtitle = [q.brand ? "Cost estimate" : "", q.route].filter(Boolean).join(" · ");
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

    // Products table: Product (name + weight × qty) | Buying price | Shipping | Cost
    const col = { name: PAD, price: PAD + 600, ship: PAD + 790, cost: W - PAD };
    const NAME_MAX = 460;
    const fit = (text, max) => {
      if (x.measureText(text).width <= max) return text;
      let t = text;
      while (t.length > 1 && x.measureText(`${t}…`).width > max) t = t.slice(0, -1);
      return `${t.trimEnd()}…`;
    };
    const cell = (text, xPos, align, weight, baseline) => {
      x.textAlign = align;
      x.font = `${weight} 26px ${FONT}`;
      x.fillText(text, xPos, baseline);
    };
    const rule = (color = C.line) => { x.fillStyle = color; x.fillRect(PAD, y - 1, inner, 2); };
    y += 64;
    fieldLabel(x, "Product", col.name, y);
    x.textAlign = "right";
    fieldLabel(x, "Buying price", col.price, y);
    fieldLabel(x, "Shipping", col.ship, y);
    fieldLabel(x, `Cost (${q.amountCur})`, col.cost, y);
    x.textAlign = "left";
    y += 18;
    rule();
    for (const it of q.items) {
      x.fillStyle = C.ink;
      x.font = `600 26px ${FONT}`;
      cell(fit(it.name, NAME_MAX), col.name, "left", 600, y + 36);
      x.fillStyle = C.muted;
      x.font = `400 20px ${FONT}`;
      x.textAlign = "left";
      x.fillText(fit(it.meta, NAME_MAX), col.name, y + 66);
      x.fillStyle = C.ink;
      cell(it.price, col.price, "right", 400, y + 48);
      cell(it.ship, col.ship, "right", 400, y + 48);
      cell(it.cost, col.cost, "right", 700, y + 48);
      y += 84;
      rule();
    }
    // Totals row
    x.fillStyle = C.ink;
    cell("All products", col.name, "left", 700, y + 40);
    cell(q.totals.price, col.price, "right", 700, y + 40);
    cell(q.totals.ship, col.ship, "right", 700, y + 40);
    cell(q.totals.cost, col.cost, "right", 700, y + 40);
    y += 60;
    if (q.shippingNote) {
      x.fillStyle = C.muted;
      x.font = `400 22px ${FONT}`;
      x.textAlign = "left";
      for (const line of wrap(x, q.shippingNote, inner)) { y += 30; x.fillText(line, PAD, y); }
    }
    x.textAlign = "left";

    // Total: thin rule, then right-aligned label / amount / converted amount
    y += 36;
    rule();
    y += 44;
    x.textAlign = "right";
    fieldLabel(x, q.totalLabel, W - PAD, y);
    y += 60;
    x.fillStyle = C.ink;
    fitFont(x, q.primary, 800, 52, 30, FONT, inner);
    x.fillText(q.primary, W - PAD, y);
    if (q.secondary) {
      y += 40;
      x.fillStyle = C.muted;
      x.font = `400 26px ${FONT}`;
      x.fillText(q.secondary, W - PAD, y);
    }
    x.textAlign = "left";

    if (q.fxLine) {
      y += 52;
      x.fillStyle = C.muted;
      x.font = `400 22px ${FONT}`;
      x.fillText(`Exchange rate: ${q.fxLine}`, PAD, y);
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
  const caption = (q) => `${q.brand ? q.brand + " – " : ""}Cost estimate No. ${q.number}: ${q.items.length} product${q.items.length > 1 ? "s" : ""}, `
    + `${q.weightText} · Total cost ${q.primary}${q.secondary ? ` (${q.secondary})` : ""}`;

  /** Full plain-text quote (Copy text / Email). */
  function text(q) {
    const lines = [
      `${q.brand ? q.brand + " – " : ""}COST ESTIMATE No. ${q.number}`,
      ...(q.route ? [q.route] : []),
      `Date: ${q.dateText}`,
      `${q.countText} · Total weight: ${q.weightText}${q.chargedText ? ` (charged as ${q.chargedText})` : ""}`,
      "",
      ...q.items.map((it, i) => `${i + 1}. ${it.name} (${it.meta}): buying price ${it.price} + shipping ${it.ship} = ${it.cost}`),
      "",
      `Buying price: ${q.totals.price}`,
      `Shipping: ${q.totals.ship}${q.shippingNote ? ` (${q.shippingNote.toLowerCase()})` : ""}`,
      `${q.totalLabel.toUpperCase()}: ${q.primary}`,
    ];
    if (q.secondary) lines.push(q.secondary);
    if (q.fxLine) lines.push(`Exchange rate: ${q.fxLine}`);
    if (q.note) lines.push("", q.note);
    if (q.contact) lines.push("", q.contact);
    return lines.join("\n");
  }

  global.Quote = { drawQuote, toBlob, toPdfBlob, download, caption, text };
})(window);
