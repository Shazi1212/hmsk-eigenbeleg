/* UI for the Eigenbeleg generator. Logic in logic.js, PDF in pdf.js, texts in i18n.js.
   Everything stays in the browser: the form is kept in localStorage, the PDF is built locally. */
(function () {
  'use strict';
  var L = window.Eigenbeleg;
  var P = window.EigenbelegPDF;
  var I = window.EB_I18N;
  var CFG = window.EB_CONFIG || {};
  var SITE = CFG.siteBase || '';
  var KEY = 'eigenbeleg.v1';
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var form = $('#form');
  var lang = pickLang();
  var touched = false;

  function pickLang() {
    var q = new URLSearchParams(location.search).get('lang');
    if (q === 'de' || q === 'en') return q;
    var nav = (navigator.languages && navigator.languages[0]) || navigator.language || 'en';
    return /^de\b/i.test(nav) ? 'de' : 'en';
  }
  function t(key, vars) {
    var s = I[lang][key];
    if (s === undefined) s = I.en[key];
    if (vars) Object.keys(vars).forEach(function (k) { s = s.split('{' + k + '}').join(vars[k]); });
    return s;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function link(href) { return SITE + href; }

  // ---------- storage (never throws; the tool works without it) ----------
  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function save(state) { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* private mode */ } }
  var store = load();

  // ---------- items ----------
  function itemRow(it) {
    var row = document.createElement('div');
    row.className = 'item';
    row.innerHTML = '<input class="item__desc" maxlength="160" aria-label="' + esc(t('item_desc')) + '" placeholder="' + esc(t('item_desc_ph')) + '">' +
      '<input class="item__amt" inputmode="decimal" maxlength="16" aria-label="' + esc(t('item_amount')) + '" placeholder="0,00">' +
      '<button type="button" class="item__rm" aria-label="' + esc(t('remove_item')) + '" title="' + esc(t('remove_item')) + '">&times;</button>';
    $('.item__desc', row).value = it.desc || '';
    $('.item__amt', row).value = it.amount || '';
    $('.item__rm', row).addEventListener('click', function () {
      if ($$('#items .item').length > 1) row.remove();
      else { $('.item__desc', row).value = ''; $('.item__amt', row).value = ''; }
      update(); persist();
    });
    $('#items').appendChild(row);
  }
  function setItems(items) {
    $('#items').innerHTML = '';
    (items && items.length ? items : [{}]).forEach(itemRow);
  }

  // ---------- form <-> data ----------
  var TEXT = ['issuerName', 'issuerAddress', 'number', 'date', 'payee', 'purpose', 'reasonText', 'attachments', 'place', 'created'];
  function collect() {
    var d = {};
    TEXT.forEach(function (k) { d[k] = form.elements[k].value; });
    ['payment', 'reason', 'pdfLang'].forEach(function (k) {
      var el = form.querySelector('input[name="' + k + '"]:checked'); d[k] = el ? el.value : '';
    });
    d.payeeLine = form.elements.payeeLine.checked;
    d.credit = form.elements.credit.checked;
    d.items = $$('#items .item').map(function (r) { return { desc: $('.item__desc', r).value, amount: $('.item__amt', r).value }; });
    return d;
  }
  function fill(d) {
    TEXT.forEach(function (k) { form.elements[k].value = d[k] == null ? '' : d[k]; });
    ['payment', 'reason', 'pdfLang'].forEach(function (k) {
      $$('input[name="' + k + '"]', form).forEach(function (el) { el.checked = el.value === d[k]; });
    });
    if (!d.pdfLang) form.querySelector('input[name="pdfLang"][value="de"]').checked = true;
    form.elements.payeeLine.checked = !!d.payeeLine;
    form.elements.credit.checked = d.credit !== false;
    setItems(d.items);
  }
  function persist() { store.draft = collect(); save(store); }

  function freshDefaults(keep) {
    var today = L.todayISO();
    return {
      issuerName: keep.issuerName || '', issuerAddress: keep.issuerAddress || '', place: keep.place || '',
      pdfLang: keep.pdfLang || 'de', payeeLine: false, credit: keep.credit !== false,
      number: L.nextNumber(store.lastNumber, +today.slice(0, 4)), date: today, created: today, items: [{}],
    };
  }

  // ---------- render ----------
  function applyLang() {
    document.documentElement.lang = lang;
    document.title = t('title');
    $$('[data-i18n]').forEach(function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
    $$('[data-ph]').forEach(function (el) { el.placeholder = t(el.getAttribute('data-ph')); });
    $$('.item__desc').forEach(function (el) { el.placeholder = t('item_desc_ph'); el.setAttribute('aria-label', t('item_desc')); });
    $$('.item__amt').forEach(function (el) { el.setAttribute('aria-label', t('item_amount')); });
    $$('.item__rm').forEach(function (el) { el.setAttribute('aria-label', t('remove_item')); el.title = t('remove_item'); });
    $$('.lang button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === lang)); });
    $('#lnkHome').href = link(t('home_href'));
    $('#lnkImprint').href = link(t('imprint_href'));
    $('#lnkImprint').textContent = t('imprint');
    $('#lnkPrivacy').href = link(t('privacy_href'));
    $('#lnkPrivacy').textContent = t('privacy');
    $('#guide').innerHTML = t('guide').map(function (g) { return '<div><dt>' + esc(g[0]) + '</dt><dd>' + esc(g[1]) + '</dd></div>'; }).join('');
    $('#sourcesList').innerHTML = window.EB_SOURCES.map(function (s) {
      return '<li><a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s[lang]) + '</a><span class="src-url">' + esc(s.url) + '</span></li>';
    }).join('');
    var u = new URL(location.href);
    u.searchParams.set('lang', lang);
    history.replaceState(null, '', u.pathname + u.search + u.hash);
    update();
  }

  function fieldEl(name) {
    var m = /^item(\d+)_(desc|amount)$/.exec(name);
    if (m) {
      var rows = $$('#items .item').filter(function (r) { return $('.item__desc', r).value.trim() || $('.item__amt', r).value.trim(); });
      return rows[+m[1]] ? $(m[2] === 'desc' ? '.item__desc' : '.item__amt', rows[+m[1]]) : null;
    }
    if (name === 'items') return $('#items .item__desc');
    if (name === 'payment' || name === 'reason') return $('[data-field="' + name + '"]');
    return form.elements[name] || null;
  }
  function labelOf(name) {
    var m = /^item(\d+)_(desc|amount)$/.exec(name);
    if (m) return t('items') + ' ' + (+m[1] + 1) + ': ' + t(m[2] === 'desc' ? 'item_desc' : 'item_amount');
    return t(name === 'items' ? 'items' : name);
  }

  function update() {
    var d = collect();
    var r = L.validate(d, L.todayISO());
    var pdfLang = d.pdfLang === 'en' ? 'en' : 'de';
    $('#sumTotal').textContent = L.formatAmount(r.total, lang);
    $('#sumWords').textContent = r.total ? I[pdfLang].in_words + ': ' + L.amountInWords(r.total, pdfLang) : '';
    $('#warnings').innerHTML = r.warnings.map(function (w) { return '<li>' + esc(t('w_' + w)) + '</li>'; }).join('');
    $$('.is-bad', form).forEach(function (el) { el.classList.remove('is-bad'); el.removeAttribute('aria-invalid'); });
    var box = $('#errors');
    if (touched && r.errors.length) {
      r.errors.forEach(function (e) { var el = fieldEl(e.field); if (el) { el.classList.add('is-bad'); el.setAttribute('aria-invalid', 'true'); } });
      box.innerHTML = '<p>' + esc(t('fix')) + '</p><ul>' + r.errors.map(function (e) {
        return '<li><a href="#" data-f="' + esc(e.field) + '">' + esc(labelOf(e.field)) + '</a>: ' + esc(t('e_' + e.code)) + '</li>';
      }).join('') + '</ul>';
      box.hidden = false;
    } else box.hidden = true;
    return r;
  }

  function download() {
    touched = true;
    var r = update();
    if (r.errors.length) {
      var first = fieldEl(r.errors[0].field);
      $('#errors').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      if (first && first.focus) first.focus({ preventScroll: true });
      return;
    }
    var d = collect();
    var bytes = P.toBytes(P.receipt(d));
    var name = L.fileName(d);
    var url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);

    if (L.isLaterNumber(d.number, store.lastNumber)) store.lastNumber = d.number;
    store.downloads = (store.downloads || 0) + 1;
    persist();
    // Email is offered from the second PDF on, never before the first result.
    var html = '<p class="ok">' + esc(t('done', { file: name })) + '</p>';
    if (store.downloads >= 2) html += '<p class="small">' + esc(t('again')) + ' <a href="' + esc(link(t('contact_href'))) + '">' + esc(t('again_link')) + ' &rarr;</a></p>';
    html += '<p class="small">' + esc(t('invoice')) + ' <a href="' + esc(link(lang === 'de' ? '/de/tools/invoice/' : '/tools/invoice/')) + '">' + esc(t('invoice_link')) + ' &rarr;</a></p>';
    $('#after').innerHTML = html;
  }

  function nextReceipt() {
    var d = collect();
    if (L.isLaterNumber(d.number, store.lastNumber)) store.lastNumber = d.number;
    fill(freshDefaults(d));
    touched = false; $('#after').innerHTML = '';
    persist(); update();
    form.elements.date.focus();
  }

  function clearAll() {
    if (!window.confirm(t('clear_confirm'))) return;
    try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    store = {};
    fill(freshDefaults({}));
    touched = false; $('#after').innerHTML = '';
    update();
  }

  // ---------- wire ----------
  fill(store.draft || freshDefaults({}));
  applyLang();
  form.addEventListener('input', function () { update(); persist(); });
  form.addEventListener('change', function () { update(); persist(); });
  form.addEventListener('submit', function (e) { e.preventDefault(); });
  $('#addItem').addEventListener('click', function () { itemRow({}); $$('#items .item__desc').pop().focus(); persist(); });
  $('#downloadBtn').addEventListener('click', download);
  $('#newBtn').addEventListener('click', nextReceipt);
  $('#clearBtn').addEventListener('click', clearAll);
  $('#errors').addEventListener('click', function (e) {
    var a = e.target.closest('a[data-f]'); if (!a) return;
    e.preventDefault();
    var el = fieldEl(a.getAttribute('data-f'));
    if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); var f = el.matches('input,textarea') ? el : $('input', el); if (f) f.focus({ preventScroll: true }); }
  });
  $$('.lang button').forEach(function (b) {
    b.addEventListener('click', function () { lang = b.getAttribute('data-lang'); applyLang(); });
  });
})();
