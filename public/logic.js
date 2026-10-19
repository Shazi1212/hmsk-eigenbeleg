/* Eigenbeleg generator: pure logic (no DOM). Amounts are integer cents.
   Works in the browser (window.Eigenbeleg) and in Node (module.exports) for tests. */
(function (root) {
  'use strict';

  // § 33 UStDV: invoices up to €250 gross may be simplified (Kleinbetragsrechnung). As of 19 October 2026.
  var KLEINBETRAG_CENTS = 25000;
  var REASONS = ['lost', 'none', 'machine', 'tip', 'damaged', 'other'];
  var PAYMENTS = ['cash', 'card', 'transfer', 'other'];

  // "12,50", "12.50", "1.234,56", "1,234.56", "1 234,56", "€ 7" -> cents; NaN if not a valid amount.
  function parseAmount(input) {
    var s = String(input == null ? '' : input).replace(/[€\s ]|EUR/gi, '');
    if (!s || !/^\d[\d.,]*$/.test(s)) return NaN;
    var lastSep = Math.max(s.lastIndexOf(','), s.lastIndexOf('.'));
    var intPart = s, frac = '';
    if (lastSep >= 0 && s.length - lastSep - 1 <= 2 && s.length - lastSep - 1 >= 1) {
      intPart = s.slice(0, lastSep);
      frac = s.slice(lastSep + 1);
      if (intPart.indexOf(s[lastSep]) >= 0) return NaN; // "12,345,6": the decimal mark appears twice
    }
    // The integer part may only contain thousands separators in groups of three.
    if (/[.,]/.test(intPart)) {
      if (!/^\d{1,3}([.,]\d{3})+$/.test(intPart)) return NaN;
      if (/,/.test(intPart) && /\./.test(intPart)) return NaN;
      intPart = intPart.replace(/[.,]/g, '');
    }
    if (!/^\d+$/.test(intPart)) return NaN;
    if (frac.length === 1) frac += '0';
    var cents = parseInt(intPart, 10) * 100 + (frac ? parseInt(frac, 10) : 0);
    return cents > 99999999999 ? NaN : cents;
  }

  function formatAmount(cents, lang) {
    var neg = cents < 0; cents = Math.abs(Math.round(cents));
    var euros = Math.floor(cents / 100), c = cents % 100;
    var sep = lang === 'en' ? ',' : '.';
    var int = String(euros).replace(/\B(?=(\d{3})+(?!\d))/g, sep);
    var s = int + (lang === 'en' ? '.' : ',') + (c < 10 ? '0' : '') + c;
    return (neg ? '-' : '') + (lang === 'en' ? '€' + s : s + ' €');
  }

  function sumItems(items) {
    return (items || []).reduce(function (acc, it) {
      var c = typeof it.cents === 'number' ? it.cents : parseAmount(it.amount);
      return acc + (isFinite(c) ? c : 0);
    }, 0);
  }

  // ---------- amount in words ----------
  var DE_ONES = ['null', 'eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn', 'elf', 'zwölf',
    'dreizehn', 'vierzehn', 'fünfzehn', 'sechzehn', 'siebzehn', 'achtzehn', 'neunzehn'];
  var DE_TENS = ['', '', 'zwanzig', 'dreißig', 'vierzig', 'fünfzig', 'sechzig', 'siebzig', 'achtzig', 'neunzig'];

  function de999(n) { // 1..999, "eins" at the end
    var h = Math.floor(n / 100), r = n % 100, s = '';
    if (h) s += (h === 1 ? 'ein' : DE_ONES[h]) + 'hundert';
    if (r) {
      if (r < 20) s += DE_ONES[r];
      else s += (r % 10 ? (r % 10 === 1 ? 'ein' : DE_ONES[r % 10]) + 'und' : '') + DE_TENS[Math.floor(r / 10)];
    }
    return s;
  }
  function deWords(n) { // 0..999,999,999; trailing "eins" becomes "ein" (used before Euro/Cent)
    if (n === 0) return 'null';
    var m = Math.floor(n / 1e6), th = Math.floor((n % 1e6) / 1000), r = n % 1000, parts = [];
    if (m) parts.push(m === 1 ? 'eine Million' : de999(m).replace(/eins$/, 'ein') + ' Millionen');
    var s = '';
    if (th) s += de999(th).replace(/eins$/, 'ein') + 'tausend';
    if (r) s += de999(r);
    if (s) parts.push(s);
    return parts.join(' ').replace(/eins$/, 'ein');
  }

  var EN_ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
    'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  var EN_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  function en999(n) {
    var h = Math.floor(n / 100), r = n % 100, out = [];
    if (h) out.push(EN_ONES[h] + ' hundred');
    if (r) {
      var w = r < 20 ? EN_ONES[r] : EN_TENS[Math.floor(r / 10)] + (r % 10 ? '-' + EN_ONES[r % 10] : '');
      out.push(h ? 'and ' + w : w);
    }
    return out.join(' ');
  }
  function enWords(n) {
    if (n === 0) return 'zero';
    var m = Math.floor(n / 1e6), th = Math.floor((n % 1e6) / 1000), r = n % 1000, parts = [];
    if (m) parts.push(en999(m) + ' million');
    if (th) parts.push(en999(th) + ' thousand');
    if (r) parts.push((m || th) && r < 100 ? 'and ' + en999(r) : en999(r));
    return parts.join(' ');
  }

  function amountInWords(cents, lang) {
    cents = Math.round(cents);
    if (!(cents >= 0) || cents >= 1e11) return '';
    var e = Math.floor(cents / 100), c = cents % 100;
    if (lang === 'en') {
      var se = enWords(e) + (e === 1 ? ' euro' : ' euros');
      return c ? se + ' and ' + enWords(c) + (c === 1 ? ' cent' : ' cents') : se;
    }
    var sd = deWords(e) + ' Euro';
    return c ? sd + ' und ' + deWords(c) + ' Cent' : sd;
  }

  // ---------- receipt number ----------
  // EB-2026-001; the counter restarts each year.
  function nextNumber(last, year) {
    var m = /^EB-(\d{4})-(\d+)$/.exec(last || '');
    var n = m && +m[1] === year ? +m[2] + 1 : 1;
    return 'EB-' + year + '-' + (n < 10 ? '00' : n < 100 ? '0' : '') + n;
  }

  // True if receipt number a comes after b (both EB-YYYY-N); used to remember the highest number issued.
  function isLaterNumber(a, b) {
    var x = /^EB-(\d{4})-(\d+)$/.exec(a || ''), y = /^EB-(\d{4})-(\d+)$/.exec(b || '');
    if (!x) return false;
    if (!y) return true;
    return +x[1] !== +y[1] ? +x[1] > +y[1] : +x[2] > +y[2];
  }

  function isISODate(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return false;
    var p = s.split('-'), d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    return d.getUTCFullYear() === +p[0] && d.getUTCMonth() === +p[1] - 1 && d.getUTCDate() === +p[2];
  }
  function todayISO(now) {
    var d = now || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function blank(s) { return !String(s == null ? '' : s).trim(); }

  // Returns { errors: [{field, code}], warnings: [code], total }. Codes are translated in i18n.js.
  function validate(d, today) {
    var errors = [], warnings = [];
    today = today || todayISO();
    function err(field, code) { errors.push({ field: field, code: code || 'required' }); }
    if (blank(d.issuerName)) err('issuerName');
    if (!isISODate(d.date)) err('date', blank(d.date) ? 'required' : 'date_invalid');
    else if (d.date > today) err('date', 'date_future');
    if (blank(d.payee)) err('payee');
    var items = (d.items || []).filter(function (it) { return !blank(it.desc) || !blank(it.amount); });
    if (!items.length) err('items', 'items_none');
    items.forEach(function (it, i) {
      if (blank(it.desc)) err('item' + i + '_desc');
      var c = parseAmount(it.amount);
      if (blank(it.amount)) err('item' + i + '_amount');
      else if (!isFinite(c)) err('item' + i + '_amount', 'amount_invalid');
      else if (c <= 0) err('item' + i + '_amount', 'amount_zero');
    });
    if (blank(d.purpose)) err('purpose');
    if (REASONS.indexOf(d.reason) < 0) err('reason');
    else if (d.reason === 'other' && blank(d.reasonText)) err('reasonText');
    if (PAYMENTS.indexOf(d.payment) < 0) err('payment');
    if (blank(d.place)) err('place');
    if (!isISODate(d.created)) err('created', blank(d.created) ? 'required' : 'date_invalid');
    else if (isISODate(d.date) && d.created < d.date) err('created', 'created_before');

    var total = sumItems(items);
    if (total > KLEINBETRAG_CENTS) warnings.push('over_250');
    if (d.reason === 'lost') warnings.push('ask_duplicate');
    if ((d.payment === 'card' || d.payment === 'transfer') && blank(d.attachments)) warnings.push('attach_statement');
    if (isISODate(d.date) && isISODate(d.created) && daysBetween(d.date, d.created) > 31) warnings.push('late');
    return { errors: errors, warnings: warnings, total: total, items: items };
  }

  function daysBetween(a, b) {
    var x = a.split('-'), y = b.split('-');
    return Math.round((Date.UTC(+y[0], +y[1] - 1, +y[2]) - Date.UTC(+x[0], +x[1] - 1, +x[2])) / 86400000);
  }

  function fileName(d) {
    var payee = String(d.payee || '').split(/[\n,]/)[0].normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .replace(/ß/g, 'ss').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
    return ['Eigenbeleg', d.number || '', d.date || '', payee].filter(Boolean).join('_') + '.pdf';
  }

  var api = {
    KLEINBETRAG_CENTS: KLEINBETRAG_CENTS, REASONS: REASONS, PAYMENTS: PAYMENTS,
    parseAmount: parseAmount, formatAmount: formatAmount, sumItems: sumItems, amountInWords: amountInWords,
    nextNumber: nextNumber, isLaterNumber: isLaterNumber, isISODate: isISODate, todayISO: todayISO, validate: validate, fileName: fileName,
    daysBetween: daysBetween,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Eigenbeleg = api;
})(this);
