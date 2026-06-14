# Implementation Plans

This file stores finalized plans before implementation.

## 2026-06-14 - Fixed-Price Retainer/Recurrent Pricing

### Summary

- Retainer and recurrent services are fixed-price root items.
- They are not multiplied by quantity or periods.
- Discounts apply normally.
- VAT/taxability uses existing `taxApplicable` / `chargeTax` flags and current VAT config behavior.
- Replace browser confirm with system modal.
- Align document mock data with current workflow rules.

### Key Changes

- Fixed-price pricing:
  - Retainer root total = `unitPrice - discount`.
  - Recurrent root total = `unitPrice - discount`.
  - Quantity and periods do not multiply retainer/recurrent root price.
  - Periods remain scheduling/billing-selection metadata only.
  - Child service quantities remain descriptive scope details only.
- Shared calculations:
  - Item cards, billing summary, QT, PF, INV, PDF/preview, and draft creation use one fixed-price rule.
  - Retainer/recurrent purchased products use `hours: 1`.
  - Standard/product lines keep `unitPrice * quantity`.
  - Contractual phases keep phase quantity pricing.
  - Discount applies after base amount for all line types.
  - VAT/tax remains controlled by `taxApplicable`; current config only supports `VAT Included` vs `Not Applied`.
- UI:
  - Retainer/recurrent root rows show fixed price, discount, VAT status, and period metadata separately.
  - Remove misleading `price x quantity` display for retainer/recurrent roots.
  - Keep period labels in document selection and generated document descriptions.
- Proper modal:
  - Replace `window.confirm` for already-quoted items with `VDialog` + `DialogActionBar`.
  - Dialog lists affected items and lets user Cancel or Continue.
  - Continue resumes pending quotation creation.
- Mock data:
  - Update deal seeds so retainer/recurrent root `quantity` does not imply billing quantity.
  - Recalculate seeded QT/PF/INV purchased products, totals, balances, and payments using shared pricing.
  - Converted quotation seeds use `Converted` plus `convertedProformaId` / `convertedInvoiceId`.
  - Converted proforma seeds use `convertedInvoiceId` and matching invoice records.
  - Receipts link to invoices, not proformas.
  - Approval/conversion/revision seed examples match current rules.

### Test Plan

- Run targeted typecheck for touched files only.
- Manual checks:
  - Retainer fixed price stays same for 1 period or many periods.
  - Recurrent fixed price stays same for 1 period or many periods.
  - Discount changes totals correctly.
  - VAT/taxability labels remain correct.
  - Item card total matches QT/PF/INV totals.
  - Mock converted/revised documents are locked correctly.
  - Already-quoted warning uses system modal.

### Assumptions

- No numeric VAT calculation will be added because config has no VAT rate field today.
- `VAT when necessary` means preserve/apply existing taxable flags and VAT-included display consistently.
- Retainer/recurrent periods are for billing-period selection and descriptions only, not pricing.

## 2026-06-14 - Deals Module Locks, Approval, Billing, Calculation Fixes

### Summary

- Tighten document locks, approval rules, billing summary display, shared calculations, and quotation duplicate warnings.
- Do not run `npm build` / `pnpm build` after each change.

### Key Changes

- Converted quotations and converted proformas cannot be edited or deleted.
  - Deals page and Finance quotation tab show: `This document is converted and locked. Create a revision instead.`
  - Older revisions stay locked with: `Older revisions cannot be edited or deleted. Use the latest revision.`
  - Store-level guards remain so UI bypass cannot mutate locked docs.
- Quotation conversion requires approval for all quotations.
  - Block conversion to proforma or invoice unless quotation status is `Approval`.
  - Show: `Client approval is required before conversion.`
  - Apply in both Deals document actions and Finance quotations actions.
- Billing summary becomes invoice-only.
  - Paid / unpaid / remaining values use invoices only.
  - Proformas do not contribute to paid totals.
  - Show only a small proforma hint under total amount, e.g. `Proformas: $X across N documents.`
  - Remove proforma mention from the Paid tile/title.
- Fix calculations through shared helpers.
  - Use one pricing source for quotation, proforma, invoice, item card, event totals, and billing summary.
  - Replace duplicated subtotal/discount/grand-total math in Deals item cards and Deal billing summary.
  - Document totals use purchased-product pricing first, with stored document total only as fallback.
  - Paid/unpaid derive consistently from invoice payments/balance and clamp so totals cannot go negative.
- Warn when creating a quotation for already quoted items.
  - Track quotation usage per selected item/phase/period.
  - Show `Already quoted` indication on affected item rows.
  - When user creates a quotation containing already quoted items, show a confirmation warning listing affected items; user can continue or cancel.
  - This is warning-only, not a hard block.

### Test Plan

- Verify converted quotation/proforma edit/delete actions show lock message and do not mutate data.
- Verify older revisions still cannot be edited/deleted.
- Verify quotation conversion is blocked unless status is `Approval`.
- Verify invoice billing summary ignores proforma totals except for hint under total.
- Verify item card, billing summary, quotation, proforma, and invoice totals match for same selected items.
- Verify already quoted items show warning before new quotation creation.
- Run targeted typecheck/static checks for touched files only; skip full build unless explicitly requested.

### Assumptions

- Every quotation needs client approval before conversion, not only phase/period quotations.
- Already quoted items should warn and allow user confirmation, not permanently block quotation creation.
- `Create revision instead` is the message users see for converted quotation/proforma edit/delete attempts.

## 2026-06-14 - Deals Module Quotation, Proforma, Invoice Rules

### Summary

Update Deals document workflow around quotation status, revisions, proforma-to-invoice conversion, and billing summary. Use targeted validation only; no routine `pnpm build`.

### Key Changes

- Quotation statuses:
  - Use `Active`, `Sent`, `Approval`, `Converted`, plus legacy terminal `Lost`/`Canceled`.
  - New quotations default to `Active`.
  - Successful email send marks quotation `Sent`, unless status is already `Approval`, `Converted`, `Lost`, or `Canceled`.
  - Client-approved quotations use `Approval`.
  - Any conversion sets quotation status to `Converted`; target detail stays in `convertedProformaId` / `convertedInvoiceId`.
  - Migrate stored values: `Pending -> Active`, `Approved -> Approval`, `Converted to Invoice/Converted to Proforma -> Converted`.

- Revision and converted locks:
  - Older revised quotation/proforma/invoice records cannot be edited or deleted.
  - Converted proformas are locked: no edit, delete, payment, or reconversion.
  - Store-level update/remove actions refuse locked records, so UI bypass cannot mutate them.
  - Latest non-converted revision remains editable/deletable.

- Deals list actions:
  - Remove `Duplicate` from Deals list row action menu and handler.
  - Keep edit, Todo, Meeting, Email, Change Stage, Delete.

- Conversion rules:
  - Quotations with phase/period content cannot convert unless status is `Approval`.
  - If invoice creation targets a selection that already has a proforma, convert that proforma to invoice; do not create a separate invoice draft.
  - If invoice creation targets a selection with no proforma, auto-create required proforma first, immediately convert it to invoice, then lock the proforma.
  - Source links update consistently: quotation gets `Converted`, proforma gets `convertedInvoiceId`, invoice gets copied document lines/client/deal links.

- Payments and receipts:
  - Remove Pay action and proforma payment drawer from Deals proforma level.
  - Payments can be added only on invoice level.
  - If any legacy/external proforma receipt path remains, route it through proforma conversion first, then apply receipt/payment to generated invoice.
  - Receipts created from invoice payments link to invoice, not proforma.

- Billing summary:
  - Billing Summary totals count invoices only for Paid, Unpaid, and To Be Invoiced.
  - Under the Paid metric, show small proforma indicator like `Proforma exists: $X` when deal has active/converted proformas.
  - Proforma indicator is informational only and does not add to Paid total.

### Public Types / Interfaces

- `QuotationStatus` includes `Active | Sent | Approval | Converted | Lost | Canceled`.
- Quotation record supports:
  - `convertedProformaId?: number | null`
  - `convertedInvoiceId?: number | null`
- Proforma record keeps `convertedInvoiceId?: number | null`; non-null means locked/converted.

### Test Plan

- Run `pnpm run typecheck`.
- Manual checks:
  - New quotation starts `Active`.
  - Email send marks quotation `Sent`.
  - Approved/client-approved quotation shows `Approval`.
  - Older revision edit/delete disabled and store update/remove refused.
  - Converted proforma locked everywhere.
  - Deals list no longer shows Duplicate.
  - Phase/period quotation conversion disabled until `Approval`.
  - Invoice creation with existing proforma converts that proforma.
  - Invoice creation without proforma creates proforma, converts it, locks it.
  - Proforma Pay action gone; invoice Pay still works.
  - Invoice payment creates invoice-linked receipt.
  - Billing Summary totals are invoice-only, with proforma indicator under Paid.
