# Eigenbeleg Generator

Lost a receipt, or never got one (parking meter, tip, small cash payment)? This makes an Eigenbeleg, the replacement
receipt German tax offices accept as an exception, as a PDF in your browser.

**Use it free:** https://hmsk.life/tools/eigenbeleg/

## What it does

- A form with every field an Eigenbeleg needs: issuer, date, payee, line items with gross amounts, payment method,
  business purpose, why there is no original receipt, attachments, place, date and signature lines.
- Builds the PDF in the browser with a small built-in PDF writer (no library, no server, no upload).
- Adds the VAT note (no input VAT deduction from an Eigenbeleg, § 15 Abs. 1 Satz 1 Nr. 1 UStG), the total in words,
  and optionally a line for the payee to confirm (useful for tips).
- Checks the input (required fields, dates, amounts) and warns above €250 (§ 33 UStDV), for lost receipts,
  card payments without a bank statement reference, and receipts written more than a month later.
- Numbers receipts per year (EB-2026-001, ...). Your details are kept in localStorage for the next receipt; one click deletes them.
- English and German interface (`?lang=de`); the PDF in German (default, for the Finanzamt) or English.

## Quick start

It is a static page with no build step and no dependencies.

```sh
python3 -m http.server 8080 --directory public   # then open http://localhost:8080
```

Or copy the `public/` folder to any web server. Site links (tool page, imprint, invoice tool, email signup) point to
`https://hmsk.life`; change `siteBase` in `public/config.js` for your own copy.

## Tests

Logic (`public/logic.js`) and the PDF writer (`public/pdf.js`) have no DOM dependency and are tested with Node's
built-in test runner (Node 18+):

```sh
node --test tests/
```

The tests cover amount parsing (German and English notation), cent-exact sums, the amount in words (every value from
0 to 9,999 euros in German), receipt numbering, validation and warnings, file names, PDF structure (xref offsets,
stream lengths, WinAnsi encoding of umlauts and €, page breaks, line wrapping), and that every text exists in EN and DE.

## Legal basis

GoBD (BMF letter of 28 Nov 2019, last amended 14 July 2025), § 15 UStG, § 33 UStDV, § 147 AO,
§ 4 Abs. 5 Satz 1 Nr. 2 EStG and the BMF letter of 19 Nov 2025 on business meals. State: 19 October 2026.

Not tax advice. Whether an Eigenbeleg is accepted is decided by the tax office case by case.

## License

MIT, see [LICENSE](LICENSE). Fonts: Newsreader and Public Sans (SIL Open Font License), in `public/fonts/`; the shared hmsk.life look is in `public/letterpress.css`.
