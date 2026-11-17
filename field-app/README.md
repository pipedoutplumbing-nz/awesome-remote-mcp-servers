# Tradehouse HQ — crew app

The phone app for Piped Out Plumbing & Drainage and Up Keep Property Maintenance,
built from the "Field App" design.

Everyone signs in with their name and a 4-digit PIN. What they see depends on who they are:

| Who | Lands on | Can also |
|---|---|---|
| **Field crew** (Liam, Tama) | Today's run sheet: only the jobs allocated to them | Open a job (map, call, access notes, notes, photos), start / complete it, clock on and off, add a new job |
| **Owner** (Shane) | Overview: invoiced, outstanding, overdue, ready to invoice | Allocate jobs, see his own run sheet, see who's on the clock, approve timesheets |
| **Office admin** (Sara) | All jobs | Create invoices, chase overdue ones, approve timesheets, take new jobs |

If someone works for both companies, they pick one after their PIN. They can switch any time
by tapping the company name at the top. Apex Access Hire shows as "coming soon".

## How to open it

It's just a web page, so there's nothing to install.

- **On your computer:** double-click `index.html`. Or, for the best result, run this in the `field-app` folder
  and open http://localhost:8000:

  ```bash
  python3 -m http.server 8000
  ```

- **On a phone:** put the `field-app` folder on any web host (for example GitHub Pages or Netlify)
  and open the link on the phone. It fills the screen like an app.

**Demo tip:** any 4-digit PIN works for now.

## What's in the folder

```
field-app/
├── index.html        the page itself
├── css/tokens.css    Piped Out design system: colours, fonts, spacing (don't edit by hand)
├── css/app.css       how each screen looks
├── js/data.js        the sample companies, staff, jobs and invoices  ← start here
├── js/app.js         the screens and what every button does
└── assets/           logos (water drop, Up Keep, Apex, Tradehouse HQ)
```

## Good to know

- **The data is sample data right now** (Wellington addresses, NZD, 15% GST). Anything you change
  (clocking on, notes, new jobs) is remembered **in that browser only**. To start fresh,
  clear the site's data in your browser settings.
- **Nothing is sent to Airtable or Xero yet.** Buttons like "Create invoice in Xero" and
  "Send reminder" show what *will* happen, but don't send anything yet. The next step is
  to swap the lists in `js/data.js` for live Airtable records.
- **PINs aren't checked yet.** That needs to happen on a server, not in the page,
  and it comes with the Airtable connection.
- Icons come from [Lucide](https://lucide.dev) and fonts from Google Fonts, so the phone needs
  internet the first time it opens the app.
