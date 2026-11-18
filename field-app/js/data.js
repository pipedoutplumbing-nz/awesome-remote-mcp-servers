/* ============================================================
   SAMPLE DATA
   ------------------------------------------------------------
   Everything the app shows comes from the lists below.
   Right now it is made-up Wellington sample data (NZD, 15% GST).
   Later, these lists are what we swap for real records from
   Airtable — the screens won't need to change.
   ============================================================ */

/* The companies you can work for. `soon: true` = shown but not set up yet. */
window.COMPANIES = [
  { key: 'pop', name: 'Piped Out Plumbing & Drainage', short: 'Piped Out Plumbing', badge: 'PO', bg: '#0F6B47', mark: 'assets/logo-drop.png', prefix: 'POP-', month: 18450 },
  { key: 'pm', name: 'Up Keep Property Maintenance', short: 'Up Keep', badge: 'UK', bg: '#2F3E46', mark: 'assets/up-keep-mark.svg', prefix: 'PM-0', month: 6320 },
  { key: 'scaf', name: 'Apex Access Hire', short: 'Apex Access Hire', badge: 'AA', bg: '#1F2A37', mark: 'assets/apex-mark.svg', soon: true }
];

/* Everyone who can sign in.
   role: 'owner' (Shane), 'admin' (office), or 'field' (crew).
   cos: which companies they work for. */
window.STAFF = [
  { key: 'shane', name: 'Shane', role: 'owner', roleLabel: 'Owner', initials: 'SH', color: '#0F6B47', field: true, lastWeek: 46.5, cos: ['pop', 'pm'] },
  { key: 'sara', name: 'Sara', role: 'admin', roleLabel: 'Office admin', initials: 'SA', color: '#6E4FB6', cos: ['pop', 'pm'] },
  { key: 'liam', name: 'Liam', role: 'field', roleLabel: 'Plumber', initials: 'LI', color: '#4F7CDB', field: true, lastWeek: 40, cos: ['pop', 'pm'] },
  { key: 'tama', name: 'Tama', role: 'field', roleLabel: 'Maintenance', initials: 'TA', color: '#C97A0C', field: true, lastWeek: 38.5, cos: ['pm'] }
];

/* A helper that fills in sensible defaults for a job. */
window.makeJob = function (id, co, who, time, end, title, addr, suburb, client, status, extra) {
  return Object.assign({
    id, co, who, time, end, title, addr, suburb, client, status,
    contact: 'Site contact', phone: '021 448 102', access: 'No access notes.', value: 350
  }, extra || {});
};

/* Today's jobs. `who: null` means nobody has been allocated yet.
   status: 'scheduled' | 'in-progress' | 'complete' | 'invoiced'
   value: price before GST. */
window.JOBS = [
  makeJob('POP-2461', 'pop', 'liam', '07:30', '08:30', 'Blocked kitchen drain', '14 Aro Street', 'Aro Valley', 'Stable Property', 'complete', { value: 412.5, contact: 'Megan Hart', access: 'Tenant home. Key in lockbox 4471.' }),
  makeJob('POP-2462', 'pop', 'liam', '09:00', '11:00', 'Leaking hot water cylinder', '22 Rintoul Street', 'Newtown', 'TP Services', 'in-progress', { urgent: true, contact: 'Rob Tane', phone: '027 310 884', access: 'Cylinder in hallway cupboard. Dog on property, keep gate shut.' }),
  makeJob('POP-2463', 'pop', 'liam', '11:30', '12:30', 'Replace toilet cistern valve', '7 Waterloo Road', 'Lower Hutt', 'Pinnacle Reach', 'scheduled', { contact: 'Aroha King', access: 'Ground floor unit. Park on street.' }),
  makeJob('POP-2464', 'pop', 'shane', '13:30', '15:00', 'CCTV drain inspection', '41 Mungavin Avenue', 'Porirua', 'J. Ngata', 'scheduled', { contact: 'James Ngata', value: 480 }),
  makeJob('POP-2465', 'pop', null, 'TBC', '', 'Outside tap replacement', '3 Woodmancote Road', 'Khandallah', 'TP Services', 'scheduled'),
  makeJob('POP-2466', 'pop', null, 'TBC', '', 'No hot water', '18 Hobson Street', 'Thorndon', 'Stable Property', 'scheduled', { urgent: true }),
  makeJob('PM-0412', 'pm', 'tama', '08:00', '10:00', 'Gutter clean and downpipe check', '56 Kent Terrace', 'Mt Victoria', 'Pinnacle Reach', 'complete', { value: 295 }),
  makeJob('PM-0413', 'pm', 'tama', '10:30', '12:00', 'Rehang sticking door', '9 Ghuznee Street', 'Te Aro', 'Stable Property', 'in-progress'),
  makeJob('PM-0414', 'pm', 'liam', '14:00', '15:00', 'Fence paling repair', '120 The Parade', 'Island Bay', 'J. Ngata', 'scheduled'),
  makeJob('PM-0415', 'pm', null, 'TBC', '', 'Tenancy check, unit 4', '2 Brougham Street', 'Mt Victoria', 'TP Services', 'scheduled')
];

/* Invoices already sent (amounts include GST). */
window.INVOICES = [
  { id: 'INV-1081', co: 'pop', client: 'TP Services', amount: 1240, state: 'overdue', due: '12 Oct', days: 14 },
  { id: 'INV-1084', co: 'pop', client: 'Pinnacle Reach', amount: 865, state: 'overdue', due: '19 Oct', days: 7 },
  { id: 'INV-1086', co: 'pop', client: 'Stable Property', amount: 386.5, state: 'sent', due: '9 Nov' },
  { id: 'INV-1087', co: 'pop', client: 'Pinnacle Reach', amount: 2150, state: 'sent', due: '10 Nov' },
  { id: 'INV-0221', co: 'pm', client: 'Pinnacle Reach', amount: 640, state: 'overdue', due: '15 Oct', days: 11 },
  { id: 'INV-0224', co: 'pm', client: 'TP Services', amount: 295, state: 'sent', due: '8 Nov' }
];
