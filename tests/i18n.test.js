'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/i18n.js'), 'utf8'), ctx);
const I = ctx.window.EB_I18N;
const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
const L = require('../public/logic.js');

test('English and German have the same keys and guide length', () => {
  assert.deepEqual(Object.keys(I.en).sort(), Object.keys(I.de).sort());
  assert.equal(I.en.guide.length, I.de.guide.length);
});

test('every text key used in the page and every validation code exists', () => {
  const used = new Set([...html.matchAll(/data-(?:i18n|ph)="([^"]+)"/g)].map((m) => m[1]));
  for (const k of used) assert.ok(k in I.en, 'missing key ' + k);
  for (const code of ['required', 'date_invalid', 'date_future', 'created_before', 'amount_invalid', 'amount_zero', 'items_none'])
    assert.ok('e_' + code in I.en, code);
  for (const w of ['over_250', 'ask_duplicate', 'attach_statement', 'late']) assert.ok('w_' + w in I.en, w);
  for (const r of L.REASONS) assert.ok('r_' + r in I.en, r);
  for (const p of L.PAYMENTS) assert.ok('pay_' + p in I.en, p);
  // field labels used by labelOf() for error messages
  for (const f of ['issuerName', 'date', 'payee', 'items', 'purpose', 'reason', 'reasonText', 'payment', 'place', 'created'])
    assert.ok(f in I.en, f);
  assert.ok(app.includes("'w_' + w") && app.includes("'e_' + e.code"));
});

test('sources carry an "as of" date and official URLs', () => {
  assert.match(I.en.sources_asof, /19 October 2026/);
  assert.match(I.de.sources_asof, /19\. Oktober 2026/);
  for (const s of ctx.window.EB_SOURCES) assert.match(s.url, /^https:\/\/www\.(gesetze-im-internet|bundesfinanzministerium)\.de\//);
});
