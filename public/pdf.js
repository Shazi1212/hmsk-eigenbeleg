/* Eigenbeleg generator: a small PDF 1.4 writer (Helvetica, WinAnsi) and the receipt layout.
   No dependencies, no network. Works in the browser (window.EigenbelegPDF) and in Node for tests. */
(function (root) {
  'use strict';
  var L = (typeof module !== 'undefined' && module.exports) ? require('./logic.js') : root.Eigenbeleg;

  // Helvetica / Helvetica-Bold advance widths (1/1000 em) for ASCII 32..126, from the standard AFM files.
  var W_REG = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556,
    556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833,
    722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556,
    278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
  var W_BOLD = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556,
    556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833,
    722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556,
    333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584];
  // Unicode -> WinAnsiEncoding byte for the 0x80..0x9F range.
  var WIN = { 0x20AC: 0x80, 0x201A: 0x82, 0x201E: 0x84, 0x2026: 0x85, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93,
    0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97 };

  // String -> array of WinAnsi byte values; characters outside WinAnsi become "?".
  function toWinAnsi(str) {
    var out = [];
    String(str).normalize('NFC').split('').forEach(function (ch) {
      var c = ch.charCodeAt(0);
      if (c === 0x09) c = 0x20;
      if (c >= 0x20 && c <= 0x7E) out.push(c);
      else if (c >= 0xA0 && c <= 0xFF) out.push(c);
      else if (WIN[c]) out.push(WIN[c]);
      else if (c >= 0xD800 && c <= 0xDBFF) { /* high surrogate: the pair becomes one "?" */ }
      else out.push(0x3F);
    });
    return out;
  }
  // Latin-1 letters measured like their base letter (close enough for wrapping).
  var BASE = 'AAAAAAACEEEEIIIIDNOOOOOxOUUUUYPsaaaaaaaceeeeiiiidnooooo/ouuuuypy';
  function byteWidth(b, bold) {
    var W = bold ? W_BOLD : W_REG;
    if (b >= 0x20 && b <= 0x7E) return W[b - 32];
    if (b === 0x80) return 556; // €
    if (b === 0xDF) return 611; // ß
    if (b >= 0xC0) return byteWidth(BASE.charCodeAt(b - 0xC0), bold);
    if (b === 0xA0) return 278;
    return 556;
  }
  function textWidth(str, size, bold) {
    return toWinAnsi(str).reduce(function (a, b) { return a + byteWidth(b, bold); }, 0) * size / 1000;
  }
  // Greedy word wrap; respects explicit newlines; breaks words longer than the line.
  function wrap(str, size, maxWidth, bold) {
    var lines = [];
    String(str == null ? '' : str).replace(/\r\n?/g, '\n').split('\n').forEach(function (para) {
      var words = para.split(/\s+/).filter(Boolean), line = '';
      if (!words.length) { lines.push(''); return; }
      words.forEach(function (w) {
        while (textWidth(w, size, bold) > maxWidth) {
          var k = w.length;
          while (k > 1 && textWidth(w.slice(0, k), size, bold) > maxWidth) k--;
          if (line) { lines.push(line); line = ''; }
          lines.push(w.slice(0, k)); w = w.slice(k);
        }
        var cand = line ? line + ' ' + w : w;
        if (textWidth(cand, size, bold) <= maxWidth) line = cand;
        else { lines.push(line); line = w; }
      });
      if (line) lines.push(line);
    });
    return lines;
  }
  function pdfString(str) {
    return '(' + toWinAnsi(str).map(function (b) {
      if (b === 0x28 || b === 0x29 || b === 0x5C) return '\\' + String.fromCharCode(b);
      return String.fromCharCode(b);
    }).join('') + ')';
  }
  function num(n) { return (Math.round(n * 100) / 100).toString(); }

  // ---------- document ----------
  function Doc() { this.pages = []; this.cur = null; this.addPage(); }
  Doc.prototype.W = 595.28; Doc.prototype.H = 841.89;
  Doc.prototype.addPage = function () { this.cur = []; this.pages.push(this.cur); };
  Doc.prototype.text = function (x, y, str, size, opt) {
    opt = opt || {};
    var gray = opt.gray != null ? opt.gray : 0;
    if (opt.align === 'right') x -= textWidth(str, size, opt.bold);
    this.cur.push(num(gray) + ' g BT /' + (opt.bold ? 'F2' : 'F1') + ' ' + num(size) + ' Tf ' + num(x) + ' ' + num(this.H - y) +
      ' Td ' + pdfString(str) + ' Tj ET');
  };
  Doc.prototype.line = function (x1, y1, x2, y2, w, gray) {
    this.cur.push(num(gray || 0) + ' G ' + num(w || 0.5) + ' w ' + num(x1) + ' ' + num(this.H - y1) + ' m ' + num(x2) + ' ' +
      num(this.H - y2) + ' l S');
  };
  Doc.prototype.rect = function (x, y, w, h, fillGray, strokeGray) {
    var ops = [];
    if (fillGray != null) ops.push(num(fillGray) + ' g ' + num(x) + ' ' + num(this.H - y - h) + ' ' + num(w) + ' ' + num(h) + ' re f');
    if (strokeGray != null) ops.push(num(strokeGray) + ' G 0.6 w ' + num(x) + ' ' + num(this.H - y - h) + ' ' + num(w) + ' ' + num(h) + ' re S');
    this.cur.push(ops.join(' '));
  };
  // Returns a "binary string" (every char code < 256). Byte offsets in the xref table are string indexes.
  Doc.prototype.output = function (meta) {
    meta = meta || {};
    var objs = [], self = this;
    function add(body) { objs.push(body); return objs.length; }
    var catalog = add(''), pagesId = add('');
    var f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    var f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    var kids = [];
    this.pages.forEach(function (ops) {
      var stream = ops.join('\n');
      var c = add('<< /Length ' + stream.length + ' >>\nstream\n' + stream + '\nendstream');
      kids.push(add('<< /Type /Page /Parent ' + pagesId + ' 0 R /MediaBox [0 0 ' + num(self.W) + ' ' + num(self.H) + '] ' +
        '/Resources << /Font << /F1 ' + f1 + ' 0 R /F2 ' + f2 + ' 0 R >> >> /Contents ' + c + ' 0 R >>'));
    });
    objs[catalog - 1] = '<< /Type /Catalog /Pages ' + pagesId + ' 0 R >>';
    objs[pagesId - 1] = '<< /Type /Pages /Kids [' + kids.map(function (k) { return k + ' 0 R'; }).join(' ') + '] /Count ' + kids.length + ' >>';
    var info = add('<< /Title ' + pdfString(meta.title || '') + ' /Producer ' + pdfString(meta.producer || 'hmsk.life Eigenbeleg') +
      (meta.date ? ' /CreationDate (D:' + meta.date + ')' : '') + ' >>');
    var out = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', offsets = [];
    objs.forEach(function (body, i) { offsets.push(out.length); out += (i + 1) + ' 0 obj\n' + body + '\nendobj\n'; });
    var xref = out.length;
    out += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n';
    offsets.forEach(function (o) { out += String(o).padStart(10, '0') + ' 00000 n \n'; });
    out += 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root ' + catalog + ' 0 R /Info ' + info + ' 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
    return out;
  };
  function toBytes(bin) {
    var u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i) & 0xFF;
    return u;
  }

  // ---------- receipt texts (the PDF language can differ from the UI) ----------
  var T = {
    de: {
      title: 'Eigenbeleg', sub: 'Ersatzbeleg für eine Ausgabe ohne Originalbeleg', no: 'Beleg-Nr.',
      issuer: 'Aussteller (Unternehmen / Name, Anschrift)', date: 'Datum der Ausgabe', payee: 'Zahlungsempfänger (Name, Anschrift)',
      payment: 'Zahlungsart', pos: 'Pos.', desc: 'Gegenstand der Ausgabe', amount: 'Betrag (brutto)', total: 'Gesamtbetrag (brutto)',
      words: 'in Worten', purpose: 'Betrieblicher Anlass / Zweck', reason: 'Grund für den Eigenbeleg', attachments: 'Anlagen',
      vat: 'Hinweis zur Umsatzsteuer: Aus diesem Eigenbeleg wird keine Vorsteuer abgezogen (§ 15 Abs. 1 Satz 1 Nr. 1 UStG). ' +
        'Der Betrag ist der gezahlte Bruttobetrag; eine darin enthaltene Umsatzsteuer ist nicht abziehbar.',
      confirm: 'Ich bestätige, dass ich den oben genannten Betrag gezahlt habe, dass die Ausgabe betrieblich veranlasst war und dass ' +
        'ein Originalbeleg nicht vorliegt.',
      place: 'Ort, Datum', sign: 'Unterschrift des Ausstellers', payeeSign: 'Bestätigung des Zahlungsempfängers (falls möglich)',
      footer: 'Erstellt mit hmsk.life/tools/eigenbeleg (im Browser, ohne Upload).', page: 'Seite',
      pay: { cash: 'Bar', card: 'Karte', transfer: 'Überweisung', other: 'Sonstige' },
      rs: { lost: 'Originalbeleg verloren gegangen', none: 'Vom Zahlungsempfänger kein Beleg ausgestellt',
        machine: 'Automat ohne Belegausgabe (z. B. Parkautomat)', tip: 'Trinkgeld (nicht auf der Rechnung ausgewiesen)',
        damaged: 'Originalbeleg beschädigt oder unleserlich', other: 'Sonstiger Grund' },
    },
    en: {
      title: 'Self-issued receipt (Eigenbeleg)', sub: 'Replacement record for an expense without an original receipt', no: 'Receipt no.',
      issuer: 'Issued by (business / name, address)', date: 'Date of the expense', payee: 'Paid to (name, address)',
      payment: 'Payment method', pos: 'No.', desc: 'What was paid for', amount: 'Amount (gross)', total: 'Total (gross)',
      words: 'in words', purpose: 'Business purpose', reason: 'Why there is no original receipt', attachments: 'Attachments',
      vat: 'VAT note: no input VAT is deducted from this self-issued receipt (§ 15 Abs. 1 Satz 1 Nr. 1 UStG). ' +
        'The amount is the gross amount paid; any VAT included in it is not deductible.',
      confirm: 'I confirm that I paid the amount above, that the expense was for business purposes and that no original receipt exists.',
      place: 'Place, date', sign: 'Signature of the issuer', payeeSign: 'Confirmation by the payee (if possible)',
      footer: 'Made with hmsk.life/tools/eigenbeleg (in the browser, nothing uploaded).', page: 'Page',
      pay: { cash: 'Cash', card: 'Card', transfer: 'Bank transfer', other: 'Other' },
      rs: { lost: 'Original receipt lost', none: 'The payee did not issue a receipt', machine: 'Machine without receipt (e.g. parking meter)',
        tip: 'Tip (not shown on the bill)', damaged: 'Original receipt damaged or illegible', other: 'Other reason' },
    },
  };

  function fmtDate(iso, lang) {
    if (!L.isISODate(iso)) return iso || '';
    var p = iso.split('-');
    return lang === 'en' ? p[2] + '/' + p[1] + '/' + p[0] : p[2] + '.' + p[1] + '.' + p[0];
  }

  // Builds the receipt. d: form data (see app.js collect()). Returns the PDF as a binary string.
  function receipt(d, opts) {
    opts = opts || {};
    var lang = d.pdfLang === 'en' ? 'en' : 'de', t = T[lang];
    var doc = new Doc(), M = 56, R = doc.W - M, CW = R - M, y = 64;
    var LABEL = 8, BODY = 10.5, LH = 14;

    function ensure(h) {
      if (y + h > doc.H - 60) { doc.addPage(); y = 64; }
    }
    function field(label, value) {
      var lines = wrap(value, BODY, CW);
      ensure(14 + lines.length * LH + 8);
      doc.text(M, y, label.toUpperCase(), LABEL, { bold: true, gray: 0.35 });
      y += 14;
      lines.forEach(function (ln) { doc.text(M, y, ln, BODY); y += LH; });
      y += 8;
    }

    // header
    doc.text(M, y, t.title, 20, { bold: true });
    doc.text(R, y - 4, t.no + ' ' + (d.number || ''), 10.5, { bold: true, align: 'right' });
    y += 18;
    doc.text(M, y, t.sub, 10, { gray: 0.35 });
    y += 12;
    doc.line(M, y, R, y, 1.2);
    y += 24;

    field(t.issuer, d.issuerName + (d.issuerAddress ? '\n' + d.issuerAddress : ''));
    // date + payment side by side
    ensure(40);
    var half = M + CW / 2;
    doc.text(M, y, t.date.toUpperCase(), LABEL, { bold: true, gray: 0.35 });
    doc.text(half, y, t.payment.toUpperCase(), LABEL, { bold: true, gray: 0.35 });
    y += 14;
    doc.text(M, y, fmtDate(d.date, lang), BODY);
    doc.text(half, y, t.pay[d.payment] || '', BODY);
    y += LH + 8;
    field(t.payee, d.payee);

    // items table
    var items = (d.items || []).filter(function (it) { return String(it.desc || '').trim() || String(it.amount || '').trim(); });
    var colAmt = R, colDesc = M + 34, descW = CW - 34 - 110;
    ensure(30);
    doc.rect(M, y - 4, CW, 20, 0.93);
    doc.text(M + 6, y + 9, t.pos, LABEL, { bold: true, gray: 0.25 });
    doc.text(colDesc, y + 9, t.desc.toUpperCase(), LABEL, { bold: true, gray: 0.25 });
    doc.text(colAmt - 6, y + 9, t.amount.toUpperCase(), LABEL, { bold: true, gray: 0.25, align: 'right' });
    y += 30;
    items.forEach(function (it, i) {
      var lines = wrap(it.desc, BODY, descW);
      ensure(lines.length * LH + 8);
      doc.text(M + 6, y, String(i + 1), BODY);
      doc.text(colAmt - 6, y, L.formatAmount(L.parseAmount(it.amount), lang), BODY, { align: 'right' });
      lines.forEach(function (ln) { doc.text(colDesc, y, ln, BODY); y += LH; });
      y += 4;
      doc.line(M, y - 8, R, y - 8, 0.4, 0.75);
    });
    var total = L.sumItems(items);
    ensure(44);
    y += 6;
    doc.text(colDesc, y, t.total, 11, { bold: true });
    doc.text(colAmt - 6, y, L.formatAmount(total, lang), 11, { bold: true, align: 'right' });
    y += 6;
    doc.line(M, y, R, y, 1);
    y += 16;
    wrap(t.words + ': ' + L.amountInWords(total, lang), 9.5, CW).forEach(function (ln) {
      ensure(LH); doc.text(M, y, ln, 9.5, { gray: 0.25 }); y += 13;
    });
    y += 14;

    field(t.purpose, d.purpose);
    var reason = (t.rs[d.reason] || '') + (String(d.reasonText || '').trim() ? (d.reason === 'other' ? ': ' : '. ') + d.reasonText.trim() : '');
    field(t.reason, reason);
    if (String(d.attachments || '').trim()) field(t.attachments, d.attachments);

    // VAT note box
    var vat = wrap(t.vat, 9.5, CW - 20);
    ensure(vat.length * 13 + 22);
    doc.rect(M, y - 2, CW, vat.length * 13 + 14, 0.95, 0.7);
    y += 12;
    vat.forEach(function (ln) { doc.text(M + 10, y, ln, 9.5); y += 13; });
    y += 18;

    var conf = wrap(t.confirm, 10, CW);
    ensure(conf.length * 14 + 110);
    conf.forEach(function (ln) { doc.text(M, y, ln, 10); y += 14; });
    y += 36;
    // signature lines: place/date (filled) | signature
    var sw = (CW - 30) / 2;
    doc.text(M, y - 6, (d.place || '') + ', ' + fmtDate(d.created, lang), BODY);
    doc.line(M, y, M + sw, y, 0.7);
    doc.line(M + sw + 30, y, R, y, 0.7);
    y += 12;
    doc.text(M, y, t.place, LABEL, { gray: 0.35 });
    doc.text(M + sw + 30, y, t.sign, LABEL, { gray: 0.35 });
    if (d.payeeLine) {
      y += 46;
      ensure(30);
      doc.line(M, y, M + sw, y, 0.7);
      y += 12;
      doc.text(M, y, t.payeeSign, LABEL, { gray: 0.35 });
    }

    // footer on every page
    var n = doc.pages.length;
    doc.pages.forEach(function (ops, i) {
      doc.cur = ops;
      if (d.credit !== false) doc.text(M, doc.H - 30, t.footer, 7.5, { gray: 0.5 });
      if (n > 1) doc.text(R, doc.H - 30, t.page + ' ' + (i + 1) + '/' + n, 7.5, { gray: 0.5, align: 'right' });
    });

    var now = opts.now || new Date();
    var stamp = now.getUTCFullYear() + String(now.getUTCMonth() + 1).padStart(2, '0') + String(now.getUTCDate()).padStart(2, '0') +
      String(now.getUTCHours()).padStart(2, '0') + String(now.getUTCMinutes()).padStart(2, '0') + String(now.getUTCSeconds()).padStart(2, '0') + 'Z';
    return doc.output({ title: t.title + ' ' + (d.number || ''), date: stamp });
  }

  var api = { Doc: Doc, toWinAnsi: toWinAnsi, textWidth: textWidth, wrap: wrap, pdfString: pdfString, toBytes: toBytes,
    receipt: receipt, TEXTS: T, fmtDate: fmtDate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EigenbelegPDF = api;
})(this);
