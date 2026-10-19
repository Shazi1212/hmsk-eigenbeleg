'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../public/pdf.js');

const data = () => ({
  issuerName: 'Jürgen Müller (Büro)', issuerAddress: 'Straße 1\n10115 Berlin', date: '2026-10-10', payee: 'Café Größe',
  items: [{ desc: 'Trinkgeld beim Kundenessen', amount: '5,00' }, { desc: 'Parken', amount: '3,50' }], payment: 'cash',
  purpose: 'Kundentermin', reason: 'tip', reasonText: '', attachments: '', place: 'Berlin', created: '2026-10-11',
  number: 'EB-2026-007', pdfLang: 'de', payeeLine: true,
});

function parse(bin) {
  assert.ok(bin.startsWith('%PDF-1.4\n'));
  assert.ok(bin.endsWith('%%EOF\n'));
  for (let i = 0; i < bin.length; i++) assert.ok(bin.charCodeAt(i) < 256, 'byte at ' + i);
  const sx = +/startxref\n(\d+)\n%%EOF\n$/.exec(bin)[1];
  assert.ok(bin.slice(sx).startsWith('xref\n'), 'startxref points at xref');
  const m = /xref\n0 (\d+)\n/.exec(bin.slice(sx));
  const n = +m[1];
  const rows = bin.slice(sx + m[0].length).split('\n').slice(0, n);
  assert.equal(rows[0], '0000000000 65535 f ');
  for (let i = 1; i < n; i++) {
    const off = +rows[i].slice(0, 10);
    assert.ok(bin.slice(off).startsWith(i + ' 0 obj\n'), 'xref entry ' + i + ' points at its object');
  }
  // every stream /Length matches its content
  const re = /<< \/Length (\d+) >>\nstream\n/g; let s;
  while ((s = re.exec(bin))) {
    const start = s.index + s[0].length;
    assert.equal(bin.slice(start + +s[1], start + +s[1] + 10), '\nendstream');
  }
  return bin;
}

test('receipt is a structurally valid PDF with correct xref offsets and stream lengths', () => {
  const bin = parse(P.receipt(data(), { now: new Date(Date.UTC(2026, 9, 19, 12, 0, 0)) }));
  assert.match(bin, /\/CreationDate \(D:20261019120000Z\)/);
  assert.match(bin, /\/Count 1 /);
});

test('German text, the euro sign and parentheses are encoded for WinAnsi', () => {
  const bin = P.receipt(data());
  assert.ok(bin.includes('(J\xFCrgen M\xFCller \\(B\xFCro\\))'), 'umlauts as Latin-1 bytes, parens escaped');
  assert.ok(bin.includes('8,50 \x80'), 'total with € as 0x80');
  assert.ok(bin.includes('achtzig') === false);
  assert.ok(bin.includes('acht Euro und f\xFCnfzig Cent'), 'amount in words');
  assert.ok(/\xA7 15 Abs\. 1 Satz 1/.test(bin), 'VAT note cites § 15 UStG');
  assert.ok(bin.includes('Best\xE4tigung des Zahlungsempf\xE4ngers'), 'payee confirmation line');
  assert.deepEqual(P.toWinAnsi('€„“–😀'), [0x80, 0x84, 0x93, 0x96, 0x3F]);
});

test('English receipt and the credit line can be switched off', () => {
  const d = Object.assign(data(), { pdfLang: 'en', credit: false, payeeLine: false });
  const bin = parse(P.receipt(d));
  assert.ok(bin.includes('\x808.50'));
  assert.ok(bin.includes('eight euros and fifty cents'));
  assert.ok(!bin.includes('hmsk.life/tools/eigenbeleg'));
});

test('long input wraps and flows onto further pages', () => {
  const long = 'Sehr lange Beschreibung '.repeat(40);
  const d = Object.assign(data(), { items: Array.from({ length: 30 }, (_, i) => ({ desc: long.slice(0, 60 + i * 10), amount: '1,00' })) });
  const bin = parse(P.receipt(d));
  const pages = +/\/Count (\d+) /.exec(bin)[1];
  assert.ok(pages >= 2, 'got ' + pages + ' pages');
  assert.ok(bin.includes('Seite 1/' + pages));
  assert.ok(bin.includes('30,00 \x80'));
});

test('wrap keeps every line inside the width, also for a single very long word', () => {
  const lines = P.wrap('a'.repeat(300) + ' kurz ' + 'Wort '.repeat(50), 10, 200);
  for (const ln of lines) assert.ok(P.textWidth(ln, 10) <= 200 + 1e-9, ln);
  assert.equal(lines.join('').replace(/\s/g, ''), ('a'.repeat(300) + 'kurz' + 'Wort'.repeat(50)));
  assert.deepEqual(P.wrap('eins\n\nzwei', 10, 200), ['eins', '', 'zwei']);
});

test('Helvetica widths match the AFM for a known string', () => {
  // "Eigenbeleg" in Helvetica: E667 i222 g556 e556 n556 b556 e556 l222 e556 g556 = 5003
  assert.equal(P.textWidth('Eigenbeleg', 1000), 5003);
});
