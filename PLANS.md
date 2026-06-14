# Implementation Plans

This file stores finalized plans before implementation.

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

