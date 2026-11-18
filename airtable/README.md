# The Trade Collective app inside Airtable

These two files are the code behind the two custom pages in the **Tradehouse HQ** Airtable base (The Trade Collective).
They are a backup copy. The live versions are stored in Airtable itself.

| File | Airtable page | Who uses it |
|---|---|---|
| `crew-app.tsx` | **Field App** interface → **Crew app** page | Everyone in the field (Emil, Shane on his own jobs) |
| `office-app.tsx` | **Owner Dashboard** interface → **Office app** page | Shane and Sara only |

## How sign-in works

1. Open the page in the Airtable phone app.
2. Tap your name.
3. Type your 4-digit PIN. The first time, you make up your own PIN and type it twice.
4. It stays unlocked on that phone for 12 hours. Tap the company name at the top, then **Sign out**, to lock it sooner.

- The Office app only lists people whose Staff **Role** contains "Owner" or "Admin".
- PINs are saved in the Staff table's **App PIN (scrambled)** field, scrambled so nobody can read them.
- **Forgot a PIN?** Clear that person's cell. They'll make a new PIN next time they open the app.
- Whoever's Airtable login email matches the Staff table goes to the top of the name list.

## What each page reads and writes

**Crew app**
- Reads: Jobs (no prices), Staff (no pay rates), Businesses, Clients (name, contact, phone), Time entries (last 14 days).
- Writes:
  - Staff: each person's own scrambled PIN, the first time they set one.
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
