'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../public/logic.js');

test('parseAmount reads German and English notation', () => {
  const ok = {
    '12,50': 1250, '12.50': 1250, '12': 1200, '0,5': 50, '7,05': 705, '1.234,56': 123456, '1,234.56': 123456,
    '1.234': 123400, '1 234,56': 123456, '€ 3,20': 320, '3,20 €': 320, '3,20 EUR': 320, '1.000.000,00': 100000000, '0': 0,
  };
  for (const [s, c] of Object.entries(ok)) assert.equal(L.parseAmount(s), c, s);
  for (const s of ['', 'abc', '-5', '12,345,6', '1.23.4', '1,234.567,8', '12.', ',50', '1.2345', '1,234.567']) {
    assert.ok(Number.isNaN(L.parseAmount(s)), 'should reject ' + JSON.stringify(s));
  }
});

test('formatAmount uses the right separators', () => {
  assert.equal(L.formatAmount(123456, 'de'), '1.234,56 €');
  assert.equal(L.formatAmount(123456, 'en'), '€1,234.56');
  assert.equal(L.formatAmount(5, 'de'), '0,05 €');
  assert.equal(L.formatAmount(100000000, 'de'), '1.000.000,00 €');
});

test('sumItems adds in cents without float errors', () => {
  assert.equal(L.sumItems([{ amount: '0,10' }, { amount: '0,20' }]), 30);
  assert.equal(L.sumItems([{ amount: '19,99' }, { amount: 'x' }, { amount: '' }, { amount: '0,01' }]), 2000);
  // 0.1 + 0.2 style sums over many rows stay exact
  assert.equal(L.sumItems(Array.from({ length: 1000 }, () => ({ amount: '0,10' }))), 10000);
});

test('amountInWords in German', () => {
  const de = {
    0: 'null Euro', 100: 'ein Euro', 101: 'ein Euro und ein Cent', 4250: 'zweiundvierzig Euro und fünfzig Cent',
    1700: 'siebzehn Euro', 2100: 'einundzwanzig Euro', 3000: 'dreißig Euro', 10100: 'einhundertein Euro',
    25000: 'zweihundertfünfzig Euro', 100000: 'eintausend Euro', 123456: 'eintausendzweihundertvierunddreißig Euro und sechsundfünfzig Cent',
    10100000: 'einhunderteintausend Euro', 100000000: 'eine Million Euro', 250000099: 'zwei Millionen fünfhunderttausend Euro und neunundneunzig Cent',
    199: 'ein Euro und neunundneunzig Cent', 11: 'null Euro und elf Cent',
  };
  for (const [c, w] of Object.entries(de)) assert.equal(L.amountInWords(+c, 'de'), w, c);
});

test('amountInWords in English', () => {
  const en = {
    0: 'zero euros', 100: 'one euro', 101: 'one euro and one cent', 4250: 'forty-two euros and fifty cents',
    10500: 'one hundred and five euros', 123456: 'one thousand two hundred and thirty-four euros and fifty-six cents',
    100500: 'one thousand and five euros', 100000000: 'one million euros',
  };
  for (const [c, w] of Object.entries(en)) assert.equal(L.amountInWords(+c, 'en'), w, c);
  assert.equal(L.amountInWords(-1, 'de'), '');
});

test('every German number 0..9999 is spelled without leftover "eins" before a unit or a gap', () => {
  for (let e = 0; e < 10000; e++) {
    const w = L.amountInWords(e * 100, 'de');
    assert.ok(/ Euro$/.test(w), e + ': ' + w);
    assert.ok(!/eins(tausend|hundert| Euro)/.test(w), e + ': ' + w);
    assert.ok(!/\s{2}|undefined/.test(w), e + ': ' + w);
  }
});

test('nextNumber counts per year', () => {
  assert.equal(L.nextNumber('', 2026), 'EB-2026-001');
  assert.equal(L.nextNumber('EB-2026-009', 2026), 'EB-2026-010');
  assert.equal(L.nextNumber('EB-2026-099', 2026), 'EB-2026-100');
  assert.equal(L.nextNumber('EB-2026-999', 2026), 'EB-2026-1000');
  assert.equal(L.nextNumber('EB-2025-042', 2026), 'EB-2026-001');
  assert.equal(L.nextNumber('garbage', 2026), 'EB-2026-001');
});

test('isLaterNumber compares year, then counter', () => {
  assert.ok(L.isLaterNumber('EB-2026-010', 'EB-2026-009'));
  assert.ok(L.isLaterNumber('EB-2026-1000', 'EB-2026-999'));
  assert.ok(L.isLaterNumber('EB-2027-001', 'EB-2026-500'));
  assert.ok(!L.isLaterNumber('EB-2026-001', 'EB-2026-001'));
  assert.ok(L.isLaterNumber('EB-2026-001', undefined));
  assert.ok(!L.isLaterNumber('my own no. 5', 'EB-2026-001'));
});

test('isISODate rejects impossible dates', () => {
  assert.ok(L.isISODate('2024-02-29'));
  assert.ok(!L.isISODate('2026-02-29'));
  assert.ok(!L.isISODate('2026-13-01'));
  assert.ok(!L.isISODate('19.10.2026'));
});

const good = () => ({
  issuerName: 'Max Muster', issuerAddress: 'Musterweg 1, 10115 Berlin', date: '2026-10-10', payee: 'Parkhaus Mitte, Berlin',
  items: [{ desc: 'Parken 2 Std.', amount: '6,00' }], payment: 'cash', purpose: 'Kundentermin bei Firma X', reason: 'machine',
  reasonText: '', attachments: '', place: 'Berlin', created: '2026-10-12', number: 'EB-2026-001',
});

test('validate accepts a complete receipt', () => {
  const r = L.validate(good(), '2026-10-19');
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
  assert.equal(r.total, 600);
});

test('validate flags every missing required field', () => {
  const r = L.validate({ items: [] }, '2026-10-19');
  const fields = r.errors.map((e) => e.field).sort();
  assert.deepEqual(fields, ['created', 'date', 'issuerName', 'items', 'payee', 'payment', 'place', 'purpose', 'reason'].sort());
});

test('validate checks dates, amounts and the "other" reason', () => {
  const codes = (d) => L.validate(Object.assign(good(), d), '2026-10-19').errors.map((e) => e.field + ':' + e.code);
  assert.deepEqual(codes({ date: '2026-10-20', created: '2026-10-20' }), ['date:date_future']);
  assert.deepEqual(codes({ date: '2026-02-30' }), ['date:date_invalid']);
  assert.deepEqual(codes({ created: '2026-10-09' }), ['created:created_before']);
  assert.deepEqual(codes({ items: [{ desc: 'x', amount: '0,00' }] }), ['item0_amount:amount_zero']);
  assert.deepEqual(codes({ items: [{ desc: 'x', amount: '12,3,4' }] }), ['item0_amount:amount_invalid']);
  assert.deepEqual(codes({ items: [{ desc: '', amount: '1' }, { desc: '', amount: '' }] }), ['item0_desc:required']);
  assert.deepEqual(codes({ reason: 'other' }), ['reasonText:required']);
  assert.deepEqual(codes({ reason: 'other', reasonText: 'Beleg vom Wind verweht' }), []);
});

test('validate warns above €250, for lost receipts, card payments and late receipts', () => {
  const w = (d) => L.validate(Object.assign(good(), d), '2026-10-19').warnings;
  assert.deepEqual(w({ items: [{ desc: 'a', amount: '250,00' }] }), []);
  assert.deepEqual(w({ items: [{ desc: 'a', amount: '250,01' }] }), ['over_250']);
  assert.deepEqual(w({ items: [{ desc: 'a', amount: '200' }, { desc: 'b', amount: '60' }] }), ['over_250']);
  assert.deepEqual(w({ reason: 'lost' }), ['ask_duplicate']);
  assert.deepEqual(w({ payment: 'card' }), ['attach_statement']);
  assert.deepEqual(w({ payment: 'card', attachments: 'Kontoauszug' }), []);
  assert.deepEqual(w({ date: '2026-09-01', created: '2026-10-19' }), ['late']);
  assert.equal(L.KLEINBETRAG_CENTS, 25000);
});

test('fileName is safe ASCII', () => {
  assert.equal(L.fileName(good()), 'Eigenbeleg_EB-2026-001_2026-10-10_Parkhaus-Mitte.pdf');
  assert.equal(L.fileName({ number: 'EB-2026-002', date: '2026-01-02', payee: 'Café Größe / Straße\nBerlin' }),
    'Eigenbeleg_EB-2026-002_2026-01-02_Cafe-Grosse-Strasse.pdf');
});
