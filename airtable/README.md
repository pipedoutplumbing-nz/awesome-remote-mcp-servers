# Tradehouse HQ inside Airtable

These two files are the code behind the two custom pages in the **Tradehouse HQ** Airtable base.
They are a backup copy. The live versions are stored in Airtable itself.

| File | Airtable page | Who uses it |
|---|---|---|
| `crew-app.tsx` | **Field App** interface → **Crew app** page | Everyone in the field (Emil, Shane on his own jobs) |
| `office-app.tsx` | **Owner Dashboard** interface → **Office app** page | Shane and Sara only |

## How sign-in works

There's no PIN. People open the page in the Airtable phone app, already signed in to Airtable.
The page looks up their **Airtable login email** in the **Staff** table's **Email** field to work out who they are.
If the emails don't match exactly, the page says so.

## What each page reads and writes

**Crew app**
- Reads: Jobs (no prices), Staff (no pay rates), Businesses, Clients (name, contact, phone), Time entries (last 14 days).
- Writes:
  - Jobs: Status (Scheduled → In Progress → Completed), Completion Date, Notes and Work Done Summary. New jobs are created here too.
  - Time entries: clocking on creates an entry with Status "In progress". Clocking off fills in End Time and sets Status to "Todo".

**Office app**
- Reads: Jobs (with Total Charge), Invoices (amounts and what's still owed, from the Xero sync), Staff, Businesses, Time entries.
- Writes:
  - Jobs: allocating a job sets Assigned To (Staff). A "New Lead" also becomes "Scheduled".
  - Time entries: approving sets Status to "Done".
- It doesn't create invoices or send emails. Your existing Xero sync and Zaps keep doing that.

## Keeping money private

Hiding the money screens only works if the **Owner Dashboard** interface is shared **only with Shane and Sara**.
Check this in Airtable: open the interface → **Share** → people list.
