# Implementation Plans

This file stores finalized plans before implementation.

## 2026-06-14 - Client Approval Conversion Selection Fix

### Summary

- Separate client approval from internal request approval.
- Treat phase/period selection during conversion as the client-approved scope.

### Key Changes

- Do not add a standalone client approval menu item.
- When converting a phase/period quotation, open the line-selection modal even if the quotation is not already `Approval`.
- Build modal choices from real linked deal phases/periods, not the parent quotation line.
- In Deals, reuse the same PF/INV create selectors and billing-period selector for quotation conversion.
- The selected phases/periods are the client-approved scope; confirming marks the quotation `Approval` before converting selected lines.
- Keep `Request Approval` as internal approval workflow and do not treat it as client approval.
- For non-phase/period quotations, still block conversion until quotation status is client-approved.

### Test Plan

- Convert a phase/period quotation from Deals and verify selection modal opens before conversion.
- Convert the same kind of quotation from Finance and verify selection modal opens before conversion.
- Verify non-phase/period quotations still require client-approved status before conversion.

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

## 2026-06-14 - Deals Module Pricing, Conversion Selection, Descriptions, and Mock Data

### Summary

- Correct retainer/recurrent pricing to `amount x periods`.
- Make generated QT/PF/INV item descriptions clear and consistent.
- Add approval-gated phase/period conversion selection across Deals and Finance.
- Refresh mock data to match current workflow, locks, receipts, and totals.

### Key Changes

- Pricing and totals:
  - Retainer and recurrent root items use `unitPrice x period count`; root `quantity` stays non-billing metadata.
  - When converting/creating for one selected billing period, generated line `hours` is `1`; for the full term, `hours` is the period count.
  - Retainer/recurrent child service quantities remain descriptive only and do not multiply totals.
  - Standard/product lines keep `unitPrice x quantity`; contractual phases keep phase quantity pricing.
  - Discounts apply after base amount; VAT remains controlled by existing tax flags/config display, with no numeric VAT rate added.

- Generated item descriptions:
  - Centralize generated descriptions in `dealDocumentDraft.ts` for quotation, proforma, invoice, preview, and PDF paths.
  - Retainer/recurrent descriptions include base note/category, start/end dates, total periods, selected billing period when applicable, and included service names.
  - Contractual phase descriptions include phase name/context, phase note/category, and selected phase identity.
  - Standard/product descriptions include item note/category and selected item context.
  - QT/PF/INV preview tables and PDFs render descriptions visibly and preserve multiline formatting where practical.

- Conversion rules and modals:
  - Quotation conversion remains blocked unless status is `Approval`; show “Client approval is required before conversion.”
  - If an approved quotation contains phases or periods, show a system `VDialog` listing all convertible phases/periods with amount, discount, VAT status, and description.
  - User selects which phase/period lines become PF or invoice; Continue is disabled until at least one line is selected.
  - Apply the same conversion behavior in Deals document actions and Finance quotation actions.
  - If converting to invoice and a matching proforma exists, convert that proforma; otherwise create the required proforma automatically, then create the invoice and lock the proforma.

- Locks, billing summary, and mock data:
  - Converted quotations/proformas and older revisions remain non-editable/non-deletable with the existing locked/revision messages.
  - Billing summary remains invoice-only, with proformas shown only as a hint under total.
  - Recalculate all Deals/Finance mock QT/PF/INV data using `amount x periods`, updated descriptions, approval statuses, conversion links, locked converted records, and invoice-only receipts.
  - Ensure seeded receipts apply to invoices, not proformas.

### Test Plan

- Run targeted static/type checks for touched files only; skip full build unless explicitly requested.
- Verify retainer/recurrent full-term totals equal `amount x periods`, and selected single-period totals equal `amount x 1`.
- Verify item card, QT, PF, INV, billing summary, preview, and PDF totals match for the same selected items.
- Verify generated descriptions are readable in QT/PF/INV edit, preview, and PDF surfaces.
- Verify non-Approval quotations cannot convert in Deals or Finance.
- Verify approved phase/period quotations open the selection modal and only selected lines convert.
- Verify converted/older QT/PF records cannot be edited or deleted.
- Verify mock data reflects all current rules and no proforma has direct receipt payments.

### Assumptions

- Generated business-readable descriptions are required for automatic document lines; manually edited descriptions remain user-controlled.
- VAT remains the existing `Included` / `Not Applied` behavior because the current config has no numeric VAT rate.
- The existing `Reccurent Service` spelling in code/data is preserved unless a separate rename is requested.

## 2026-06-14 - Deals Document Sequence Unlock and Conversion Modal Fix

### Summary

- Fix document sequence cleanup so deleting downstream documents unlocks upstream documents.
- Fix Deals and Finance quotation conversion so approved phase/period quotations reliably open the system selection modal.
- Keep approval gating: non-`Approval` quotations still cannot convert.

### Key Changes

- Sequence unlock rules:
  - When an invoice is deleted, clear matching `proforma.convertedInvoiceId` and `quotation.convertedInvoiceId`.
  - Keep quotation `Converted` if it still has a related proforma; otherwise restore it to `Approval`.
  - When a proforma is deleted, clear matching `quotation.convertedProformaId`.
  - Restore quotation to `Approval` when no converted proforma or invoice link remains.
  - Run cleanup at store level so Deals and Finance behave the same.

- Delete behavior and locks:
  - Converted proformas stay locked while `convertedInvoiceId` exists.
  - Once invoice deletion clears `convertedInvoiceId`, the proforma becomes editable/deletable again.
  - Older revisions stay locked regardless of link cleanup.
  - Parent document deletion still removes revisions, and cleanup runs for every deleted ID.

- Quotation conversion modal:
  - Detect phase/period quotations from product metadata, linked deal items, and title/description fallback.
  - In Deals and Finance, approved phase/period quotations open a system modal before conversion.
  - Modal lines show title, description, qty/period or phase label, amount, discount, VAT/taxability status, and selected total.
  - Non-`Approval` quotations show `Client approval is required before conversion.`

- Conversion from selected lines:
  - Convert selected lines only.
  - Invoice conversion creates required proforma first, converts it to invoice, locks the proforma, and links both IDs.
  - Use the same helper logic in Deals and Finance where practical.

### Test Plan

- Verify invoice deletion unlocks related proformas.
- Verify proforma deletion clears quotation links and restores quotation status where appropriate.
- Verify older revisions stay locked.
- Verify approved phase/period quotations open the conversion modal in Deals and Finance.
- Verify non-approved quotation conversion is blocked in both tabs.
- Run targeted static checks for touched files only; do not run full build unless explicitly requested.

### Assumptions

- Restored upstream quotation status should be `Approval`.
- Link cleanup belongs in stores, not just UI handlers.
- “Whole sequence” means invoice -> proforma -> quotation links unwind when downstream documents are deleted.
