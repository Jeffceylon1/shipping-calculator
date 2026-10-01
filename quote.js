// Quote rendering and export for the customer page: one canvas design feeds print, PNG, PDF and share.
(function (global) {
  const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  const C = { accent: "#1f5eff", ink: "#1d2433", muted: "#6b7385", line: "#e3e6ec", soft: "#f0f4ff", ok: "#067647" };
  const W = 1080;
  const PAD = 72;

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

  function box(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
    ctx.fill();
  }

  /**
   * q: { brand, route, id, dateText, weightText, chargedText?, zone?, totalLabel, primary, secondary?,
   *      free, fxLine?, note?, contact? }
   */
  function drawQuote(q) {
    const draft = document.createElement("canvas");
    draft.width = W;
    draft.height = 2400;
    const x = draft.getContext("2d");
    x.fillStyle = "#fff";
    x.fillRect(0, 0, W, draft.height);
    x.textBaseline = "alphabetic";

    // Header band
    const headH = 230;
    x.fillStyle = C.accent;
    x.fillRect(0, 0, W, headH);
    x.fillStyle = "#fff";
    x.font = `700 54px ${FONT}`;
    x.fillText(q.brand || "Shipping Quote", PAD, 112);
    x.globalAlpha = 0.85;
    x.font = `400 32px ${FONT}`;
    x.fillText(q.brand ? `Shipping quote · ${q.route}` : q.route, PAD, 168);
    x.globalAlpha = 1;

    // Detail rows
    let y = headH + 84;
    const row = (label, value) => {
      x.textAlign = "left";
      x.font = `400 32px ${FONT}`;
      x.fillStyle = C.muted;
      x.fillText(label, PAD, y);
      x.textAlign = "right";
      x.font = `600 34px ${FONT}`;
      x.fillStyle = C.ink;
      x.fillText(value, W - PAD, y);
      y += 72;
    };
    row("Quote no.", q.id);
    row("Date", q.dateText);
    row("Parcel weight", q.weightText);
    if (q.chargedText) row("Charged weight", q.chargedText);
    if (q.zone) row("Destination", q.zone);

    // Total
    y += 8;
    const boxH = q.secondary || q.free ? 300 : 244;
    x.fillStyle = C.soft;
    box(x, PAD, y, W - PAD * 2, boxH, 28);
    x.textAlign = "center";
    x.fillStyle = C.muted;
    x.font = `400 32px ${FONT}`;
    x.fillText(q.totalLabel, W / 2, y + 72);
    x.fillStyle = C.ink;
    x.font = `700 96px ${FONT}`;
    x.fillText(q.primary, W / 2, y + 182);
    if (q.free) {
      x.fillStyle = C.ok;
      x.font = `600 34px ${FONT}`;
      x.fillText("Free shipping applied", W / 2, y + 250);
    } else if (q.secondary) {
      x.fillStyle = C.muted;
      x.font = `400 34px ${FONT}`;
      x.fillText(q.secondary, W / 2, y + 250);
    }
    y += boxH + 64;

    // Exchange rate and note
    x.textAlign = "left";
    x.fillStyle = C.muted;
    if (q.fxLine) {
      x.font = `400 26px ${FONT}`;
      for (const line of wrap(x, `Exchange rate: ${q.fxLine}`, W - PAD * 2)) { x.fillText(line, PAD, y); y += 38; }
      y += 14;
    }
    if (q.note) {
      x.font = `400 28px ${FONT}`;
      for (const line of wrap(x, q.note, W - PAD * 2)) { x.fillText(line, PAD, y); y += 40; }
      y += 14;
    }

    // Footer
    if (q.contact) {
      y += 10;
      x.fillStyle = C.line;
      x.fillRect(PAD, y, W - PAD * 2, 2);
      y += 62;
      x.fillStyle = C.ink;
      x.font = `600 32px ${FONT}`;
      for (const line of wrap(x, q.contact, W - PAD * 2)) { x.fillText(line, PAD, y); y += 44; }
    }
    y += 40;

    const out = document.createElement("canvas");
    out.width = W;
    out.height = Math.ceil(y);
    out.getContext("2d").drawImage(draft, 0, 0);
    return out;
  }

  const toBlob = (canvas, type, quality) =>
    new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), type, quality));

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

  function shareText(q, pageUrl) {
    const lines = [
      `${q.brand ? q.brand + " – " : ""}Shipping quote (${q.route})`,
      `Quote no.: ${q.id}`,
      `Parcel weight: ${q.weightText}${q.chargedText ? ` (charged as ${q.chargedText})` : ""}`,
    ];
    if (q.zone) lines.push(`Destination: ${q.zone}`);
    lines.push(`${q.totalLabel}: ${q.primary}${q.free ? " (free shipping)" : ""}`);
    if (q.secondary) lines.push(q.secondary);
    if (q.fxLine) lines.push(`Exchange rate: ${q.fxLine}`);
    if (q.note) lines.push("", q.note);
    if (q.contact) lines.push("", q.contact);
    if (pageUrl) lines.push("", `Get a quote: ${pageUrl}`);
    return lines.join("\n");
  }

  global.Quote = { drawQuote, toBlob, toPdfBlob, download, shareText };
})(window);
