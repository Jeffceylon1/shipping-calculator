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
   * q: { brand, route, number, dateText, countText, weightText, chargedText?, title?,
   *      items: [{ name, meta, buying, hst?, shipping, cost, sellUnit, markup, sell, img? }],
   *      totals: { price, hst?, ship, cost, sell }, hstLabel, profit, shippingNote?,
   *      amountCur, fxLine?, note?, contact? }
   * number: digits only (e.g. "1001"); shown as "No. 1001".
   * route: the admin's destination name; "" hides it everywhere.
   * profit: formatted, may start with "-" (shown red) else green.
   * title: optional estimate title shown under the header ("" hides it).
   * items[].img: optional decoded HTMLImageElement, drawn as a 64px thumbnail beside the name.
   */
  function drawQuote(q) {
    const draft = document.createElement("canvas");
    draft.width = W;
    draft.height = 2400 + 150 + q.items.length * 220;
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

    // Optional estimate title (max 3 lines, ellipsis on the last)
    const title = String(q.title || "").trim();
    if (title) {
      x.fillStyle = C.ink;
      x.font = `700 32px ${FONT}`;
      let tl = wrap(x, title, inner);
      if (tl.length > 3) tl = [tl[0], tl[1], `${tl.slice(2).join(" ")}`];
      tl.forEach((line, i) => {
        if (i === 2) {
          let t = line;
          if (x.measureText(t).width > inner) {
            while (t.length > 1 && x.measureText(`${t}…`).width > inner) t = t.slice(0, -1);
            t = `${t.trimEnd()}…`;
          }
          line = t;
        }
        y += i ? 40 : 52;
        x.fillText(line, PAD, y);
      });
      y += 12;
    }

    // Shipment summary line
    y += 52;
    const summary = `${q.countText} · ${q.weightText}${q.chargedText ? ` · charged as ${q.chargedText}` : ""}`;
    x.fillStyle = C.muted;
    fitFont(x, summary, 400, 24, 18, FONT, inner);
    x.fillText(summary, PAD, y);

    // Products table: Product (name / meta / buying / shipping) | Cost | Selling (each) + markup | Selling total
    const COLW = 200; // max width of each money column
    const col = { name: PAD, cost: PAD + 570, unit: PAD + 790, sell: W - PAD };
    const PHOTO = q.items.some((it) => it.img) ? 80 : 0; // thumbnail column width (64px image + 16px gap)
    const NAME_MAX = col.cost - COLW - 16 - PAD - PHOTO; // 354px without photos
    const textX = col.name + PHOTO;
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
      if (PHOTO && it.img) {
        const img = it.img, S = 64, iy = y + 14;
        const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
        const side = Math.min(iw, ih);
        x.save();
        x.beginPath();
        if (x.roundRect) x.roundRect(col.name, iy, S, S, 10); else x.rect(col.name, iy, S, S);
        x.clip();
        if (side > 0) x.drawImage(img, (iw - side) / 2, (ih - side) / 2, side, side, col.name, iy, S, S);
        x.restore();
        x.strokeStyle = C.line;
        x.lineWidth = 1;
        x.beginPath();
        if (x.roundRect) x.roundRect(col.name + 0.5, iy + 0.5, S - 1, S - 1, 10); else x.rect(col.name + 0.5, iy + 0.5, S - 1, S - 1);
        x.stroke();
      }
      // Full product name (exact shade/variant matters): wrap up to 3 lines instead of cutting it off
      x.textAlign = "left";
      x.fillStyle = C.ink;
      x.font = `600 25px ${FONT}`;
      let nameLines = wrap(x, it.name, NAME_MAX);
      if (nameLines.length > 3) nameLines = [...nameLines.slice(0, 2), fit(nameLines.slice(2).join(" "), NAME_MAX)];
      nameLines = nameLines.map((line) => fit(line, NAME_MAX));
      nameLines.forEach((line, i) => x.fillText(line, textX, y + 36 + i * 30));
      const extra = (nameLines.length - 1) * 30;
      x.fillStyle = C.muted;
      x.font = `400 20px ${FONT}`;
      x.fillText(fit(it.meta || "", NAME_MAX), textX, y + 62 + extra);
      const costLines = [`Buying ${it.buying}`, ...(it.hst ? [`HST ${it.hst}`] : []), `Shipping ${it.shipping}`];
      costLines.forEach((line, i) => x.fillText(fit(line, NAME_MAX), textX, y + 88 + extra + i * 24));
      money(it.cost, col.cost, 400, 24, y + 48);
      money(it.sellUnit, col.unit, 400, 24, y + 48);
      money(it.markup || "", col.unit, 400, 18, y + 76, C.muted);
      money(it.sell, col.sell, 700, 24, y + 48);
      y += Math.max(PHOTO ? 92 : 0, 82 + extra + costLines.length * 24);
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
    sumLine("Buying price", q.totals.price, 24, 400, C.ink, 48);
    if (q.totals.hst) sumLine(q.hstLabel, q.totals.hst, 24, 400, C.ink, 36);
    sumLine("Shipping", q.totals.ship, 24, 400, C.ink, 36);
    sumLine("Total cost", q.totals.cost, 30, 600, C.ink, 48);
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

  // ---- Editable data hidden inside the saved files (no database needed) ----
  // PNG: a tEXt chunk "CWGData"; PDF: a /CWGData entry in the document info. Both hold base64 JSON.
  const DATA_KEY = "CWGData";
  const toBase64 = (s) => {
    let bin = "";
    for (const b of new TextEncoder().encode(s)) bin += String.fromCharCode(b);
    return btoa(bin);
  };
  const fromBase64 = (s) => new TextDecoder().decode(Uint8Array.from(atob(s), (c) => c.charCodeAt(0)));
  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  const crc32 = (bytes) => {
    let c = 0xffffffff;
    for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };

  /** The PNG with `data` stored in a tEXt chunk just before IEND (always the last 12 bytes of a canvas PNG). */
  async function pngWithData(blob, data) {
    const png = new Uint8Array(await blob.arrayBuffer());
    const body = new TextEncoder().encode(`${DATA_KEY}\0${toBase64(JSON.stringify(data))}`);
    const chunk = new Uint8Array(12 + body.length);
    const view = new DataView(chunk.buffer);
    view.setUint32(0, body.length);
    chunk.set(new TextEncoder().encode("tEXt"), 4);
    chunk.set(body, 8);
    view.setUint32(8 + body.length, crc32(chunk.subarray(4, 8 + body.length)));
    const iend = png.length - 12;
    return new Blob([png.subarray(0, iend), chunk, png.subarray(iend)], { type: "image/png" });
  }

  /** Estimate data saved by this app inside a PNG or PDF, or null if the file has none. */
  async function readData(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const latin1 = (b) => new TextDecoder("latin1").decode(b);
    if (bytes[0] === 0x89 && latin1(bytes.subarray(1, 4)) === "PNG") {
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      for (let i = 8; i + 8 <= bytes.length;) {
        const len = view.getUint32(i);
        const type = latin1(bytes.subarray(i + 4, i + 8));
        if (type === "tEXt") {
          const text = latin1(bytes.subarray(i + 8, i + 8 + len));
          const sep = text.indexOf("\0");
          if (text.slice(0, sep) === DATA_KEY) return JSON.parse(fromBase64(text.slice(sep + 1)));
        }
        if (type === "IEND") break;
        i += 12 + len;
      }
      return null;
    }
    const match = latin1(bytes).match(/\/CWGData \(([A-Za-z0-9+/=]+)\)/);
    return match ? JSON.parse(fromBase64(match[1])) : null;
  }

  /** Single-page A4 PDF embedding the quote as a JPEG (and `data`, if given, in the document info). No dependencies. */
  async function toPdfBlob(canvas, data) {
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

    obj(6, () => push(`<< /Producer (Crown Way Global)${data ? ` /${DATA_KEY} (${toBase64(JSON.stringify(data))})` : ""} >>`));

    const xref = length;
    let table = "xref\n0 7\n0000000000 65535 f \n";
    for (let n = 1; n <= 6; n++) table += `${String(offsets[n]).padStart(10, "0")} 00000 n \n`;
    push(`${table}trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
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
  const caption = (q) => `${q.brand}${q.title ? ` – ${q.title}` : ""} – Cost estimate No. ${q.number}: ${q.items.length} product${q.items.length === 1 ? "" : "s"}, `
    + `${q.weightText} · Cost ${q.totals.cost} · Selling ${q.totals.sell}`;

  /** Full plain-text quote (Copy text / Email). */
  function text(q) {
    const lines = [
      `${q.brand} – COST ESTIMATE No. ${q.number}`,
      ...(q.title ? [`Title: ${q.title}`] : []),
      ...(q.route ? [q.route] : []),
      `Date: ${q.dateText}`,
      `${q.countText} · Total weight: ${q.weightText}${q.chargedText ? ` (charged as ${q.chargedText})` : ""}`,
      "",
      ...q.items.map((it, i) => `${i + 1}. ${it.name} (${it.meta}): cost ${it.cost} · selling ${it.sellUnit} each (${it.markup}) · total ${it.sell}`),
      "",
      `Buying price: ${q.totals.price}`,
      ...(q.totals.hst ? [`${q.hstLabel}: ${q.totals.hst}`] : []),
      `Shipping: ${q.totals.ship}`,
      `Total cost: ${q.totals.cost}`,
      `Selling total: ${q.totals.sell}`,
      `Profit: ${q.profit}`,
    ];
    if (q.fxLine) lines.push(q.fxLine);
    if (q.note) lines.push("", q.note);
    if (q.contact) lines.push("", q.contact);
    return lines.join("\n");
  }

  global.Quote = { drawQuote, toBlob, toPdfBlob, pngWithData, readData, download, caption, text };
})(window);
