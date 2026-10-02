// Quote document (waybill style) for the customer page: one canvas design feeds print, PNG, PDF and share.
(function (global) {
  const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  const MONO = '"SF Mono", Menlo, Consolas, "Liberation Mono", monospace';
  const C = { accent: "#1f5eff", ink: "#1d2433", muted: "#667085", line: "#d0d5dd", band: "#f5f6f8", soft: "#f0f4ff", ok: "#067647" };
  const W = 1080;
  const PAD = 56;

  // Code 128 bar patterns for symbol values 0–106 (1 = bar module, 0 = space). Table from JsBarcode.
  const BARS = ("11011001100 11001101100 11001100110 10010011000 10010001100 10001001100 10011001000 10011000100 "
    + "10001100100 11001001000 11001000100 11000100100 10110011100 10011011100 10011001110 10111001100 "
    + "10011101100 10011100110 11001110010 11001011100 11001001110 11011100100 11001110100 11101101110 "
    + "11101001100 11100101100 11100100110 11101100100 11100110100 11100110010 11011011000 11011000110 "
    + "11000110110 10100011000 10001011000 10001000110 10110001000 10001101000 10001100010 11010001000 "
    + "11000101000 11000100010 10110111000 10110001110 10001101110 10111011000 10111000110 10001110110 "
    + "11101110110 11010001110 11000101110 11011101000 11011100010 11011101110 11101011000 11101000110 "
    + "11100010110 11101101000 11101100010 11100011010 11101111010 11001000010 11110001010 10100110000 "
    + "10100001100 10010110000 10010000110 10000101100 10000100110 10110010000 10110000100 10011010000 "
    + "10011000010 10000110100 10000110010 11000010010 11001010000 11110111010 11000010100 10001111010 "
    + "10100111100 10010111100 10010011110 10111100100 10011110100 10011110010 11110100100 11110010100 "
    + "11110010010 11011011110 11011110110 11110110110 10101111000 10100011110 10001011110 10111101000 "
    + "10111100010 11110101000 11110100010 10111011110 10111101110 11101011110 11110101110 11010000100 "
    + "11010010000 11010011100 1100011101011").split(" ");
  const START_B = 104;
  const STOP = 106;

  /** Code 128 set B module string for printable ASCII text. */
  function code128B(text) {
    const values = [START_B];
    let checksum = START_B;
    [...text].forEach((ch, i) => {
      const v = ch.charCodeAt(0) - 32;
      if (v < 0 || v > 95) throw new Error(`Barcode cannot encode "${ch}"`);
      values.push(v);
      checksum += v * (i + 1);
    });
    values.push(checksum % 103, STOP);
    return values.map((v) => BARS[v]).join("");
  }

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
   * q: { brand, route, from, to, id, dateText, countText, weightText, chargedText?,
   *      items: [{ name, meta, price, ship, cost }], totals: { price, ship, cost }, shippingNote?,
   *      amountCur, totalLabel, primary, secondary?, fxLine?, note?, contact? }
   */
  function drawQuote(q) {
    const draft = document.createElement("canvas");
    draft.width = W;
    draft.height = 2200 + q.items.length * 84;
    const x = draft.getContext("2d");
    x.fillStyle = "#fff";
    x.fillRect(0, 0, W, draft.height);
    x.textBaseline = "alphabetic";
    const inner = W - PAD * 2;

    // Header band: business left, quote number right
    const headH = 176;
    x.fillStyle = C.accent;
    x.fillRect(0, 0, W, headH);
    x.textAlign = "left";
    x.fillStyle = "#fff";
    fitFont(x, q.brand || "Cost Estimate", 700, 46, 28, FONT, inner * 0.58);
    x.fillText(q.brand || "Cost Estimate", PAD, 84);
    x.globalAlpha = 0.85;
    x.font = `400 26px ${FONT}`;
    x.fillText(q.brand ? `Cost estimate · ${q.route}` : `${q.route} · buying price + shipping`, PAD, 128);
    x.globalAlpha = 1;
    x.textAlign = "right";
    fieldLabel(x, "Quote no.", W - PAD, 76, "rgba(255,255,255,.8)");
    x.fillStyle = "#fff";
    x.font = `700 30px ${MONO}`;
    x.fillText(q.id, W - PAD, 120);
    x.textAlign = "left";

    // Barcode of the quote number
    let y = headH + 40;
    const module = 3;
    const bits = code128B(q.id);
    const bx = Math.round((W - bits.length * module) / 2);
    x.fillStyle = C.ink;
    for (let i = 0; i < bits.length; i++) if (bits[i] === "1") x.fillRect(bx + i * module, y, module, 104);
    y += 104 + 34;
    x.textAlign = "center";
    x.font = `500 24px ${MONO}`;
    x.letterSpacing = "6px";
    x.fillText(q.id, W / 2, y);
    x.letterSpacing = "0px";
    x.textAlign = "left";
    y += 34;

    // Shipment details grid (waybill boxes)
    const cellH = 112;
    const rows = [
      [["From", q.from], ["To", q.to]],
      [["Date", q.dateText], ["Products", q.countText], ["Total weight", q.weightText],
        ...(q.chargedText ? [["Charged weight", q.chargedText]] : [])],
    ];
    const gridTop = y;
    x.strokeStyle = C.ink;
    for (const row of rows) {
      const cw = inner / row.length;
      row.forEach(([label, value], i) => {
        const cx = PAD + i * cw;
        fieldLabel(x, label, cx + 18, y + 36);
        x.fillStyle = C.ink;
        fitFont(x, value, 700, 32, 20, FONT, cw - 36);
        x.fillText(value, cx + 18, y + 84);
        if (i) { x.lineWidth = 2; x.beginPath(); x.moveTo(cx, y); x.lineTo(cx, y + cellH); x.stroke(); }
      });
      y += cellH;
      x.lineWidth = 2;
      x.beginPath(); x.moveTo(PAD, y); x.lineTo(W - PAD, y); x.stroke();
    }
    x.lineWidth = 3;
    x.strokeRect(PAD, gridTop, inner, y - gridTop);

    // Products table: Product (name + weight × qty) | Buying price | Shipping | Cost
    const col = { name: PAD + 18, price: PAD + 600, ship: PAD + 790, cost: W - PAD - 18 };
    const NAME_MAX = 440;
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
    y += 36;
    x.fillStyle = C.band;
    x.fillRect(PAD, y, inner, 52);
    fieldLabel(x, "Product", col.name, y + 33);
    x.textAlign = "right";
    fieldLabel(x, "Buying price", col.price, y + 33);
    fieldLabel(x, "Shipping", col.ship, y + 33);
    fieldLabel(x, `Cost (${q.amountCur})`, col.cost, y + 33);
    x.textAlign = "left";
    y += 52;
    const rule = (color = C.line) => { x.fillStyle = color; x.fillRect(PAD, y - 1, inner, 2); };
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
    rule(C.ink);
    if (q.shippingNote) {
      x.fillStyle = C.muted;
      x.font = `400 22px ${FONT}`;
      x.textAlign = "left";
      for (const line of wrap(x, q.shippingNote, inner - 36)) { y += 34; x.fillText(line, col.name, y); }
      y += 18;
    }
    x.textAlign = "left";

    // Total
    const totalH = q.secondary ? 148 : 108;
    x.fillStyle = C.ink;
    x.fillRect(PAD, y, inner, totalH);
    fieldLabel(x, q.totalLabel, PAD + 24, y + 64, "rgba(255,255,255,.85)");
    x.textAlign = "right";
    x.fillStyle = "#fff";
    fitFont(x, q.primary, 800, 54, 30, FONT, inner * 0.62);
    x.fillText(q.primary, W - PAD - 24, y + 72);
    if (q.secondary) {
      x.globalAlpha = 0.85;
      x.font = `400 26px ${FONT}`;
      x.fillText(q.secondary, W - PAD - 24, y + 118);
      x.globalAlpha = 1;
    }
    x.textAlign = "left";
    y += totalH;

    if (q.fxLine) {
      y += 42;
      x.fillStyle = C.muted;
      x.font = `400 22px ${FONT}`;
      x.fillText(`Exchange rate: ${q.fxLine}`, PAD, y);
    }

    // Notes
    if (q.note) {
      y += 44;
      x.font = `400 24px ${FONT}`;
      const noteLines = wrap(x, q.note, inner - 36);
      const boxH = 58 + noteLines.length * 34 + 12;
      x.strokeStyle = C.line;
      x.lineWidth = 2;
      x.strokeRect(PAD, y, inner, boxH);
      fieldLabel(x, "Notes", PAD + 18, y + 36);
      x.fillStyle = C.ink;
      x.font = `400 24px ${FONT}`;
      noteLines.forEach((line, i) => x.fillText(line, PAD + 18, y + 72 + i * 34));
      y += boxH;
    }

    // Footer band
    y += 40;
    x.font = `600 28px ${FONT}`;
    const contactLines = q.contact ? wrap(x, q.contact, inner) : [];
    const footH = 72 + contactLines.length * 40 + (contactLines.length ? 8 : 0);
    x.fillStyle = C.band;
    x.fillRect(0, y, W, footH);
    let fy = y + 46;
    x.fillStyle = C.ink;
    for (const line of contactLines) { x.fillText(line, PAD, fy); fy += 40; }
    x.fillStyle = C.muted;
    x.font = `400 22px ${FONT}`;
    x.fillText("Thank you for your business.", PAD, fy);
    y += footH;

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
  const caption = (q) => `${q.brand ? q.brand + " – " : ""}Cost estimate ${q.id}: ${q.items.length} product${q.items.length > 1 ? "s" : ""}, `
    + `${q.weightText} · Total cost ${q.primary}${q.secondary ? ` (${q.secondary})` : ""}`;

  /** Full plain-text quote (Copy text / Email). */
  function text(q) {
    const lines = [
      `${q.brand ? q.brand + " – " : ""}COST ESTIMATE ${q.id}`,
      `${q.from} → ${q.to}`,
      `Date: ${q.dateText}`,
      `Products: ${q.countText} · Total weight: ${q.weightText}${q.chargedText ? ` (charged as ${q.chargedText})` : ""}`,
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
