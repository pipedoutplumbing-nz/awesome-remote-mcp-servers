/* ============================================================
   TRADEHOUSE HQ — crew app
   ------------------------------------------------------------
   How it works, in plain words:
   1. `state` holds everything: who's signed in, which company,
      which screen, the jobs, invoices, clocks…
   2. `render()` turns the state into the screen you see.
   3. Every button calls `set({...})`, which changes the state
      and draws the screen again.
   The state is saved in this browser, so a refresh keeps your place.
   ============================================================ */
(function () {
  'use strict';

  const COS = window.COMPANIES;
  const STAFF = window.STAFF;
  const FIELD = STAFF.filter(s => s.field);
  const GST = 1.15;
  const STORE_KEY = 'tradehouse-hq-v1';

  // Where each role lands after signing in, and the tabs along the bottom.
  const HOME = { field: 'today', owner: 'overview', admin: 'jobs' };
  const TABS = {
    field: [['today', 'list-checks', 'Today'], ['clock', 'timer', 'Clock'], ['intake', 'circle-plus', 'New job']],
    owner: [['overview', 'layout-dashboard', 'Overview'], ['jobs', 'clipboard-list', 'Jobs'], ['today', 'list-checks', 'My day'], ['team', 'users', 'Team']],
    admin: [['jobs', 'clipboard-list', 'Jobs'], ['invoices', 'receipt', 'Invoices'], ['team', 'users', 'Team'], ['intake', 'circle-plus', 'New job']]
  };
  const STATUS_LABEL = { scheduled: 'Scheduled', 'in-progress': 'In progress', complete: 'Complete', invoiced: 'Invoiced', overdue: 'Overdue', 'on-hold': 'On hold' };

  /* ---------- Small helpers ---------- */
  const pad = n => String(n).padStart(2, '0');
  const hm = d => pad(d.getHours()) + ':' + pad(d.getMinutes());
  const money = (n, dec = true) => '$' + n.toLocaleString('en-NZ', { minimumFractionDigits: dec ? 2 : 0, maximumFractionDigits: dec ? 2 : 0 });
  const dur = ms => { const m = Math.floor(ms / 60000); return Math.floor(m / 60) + 'h ' + pad(m % 60) + 'm'; };
  const clockTxt = ms => { const s = Math.floor(ms / 1000); return pad(Math.floor(s / 3600)) + ':' + pad(Math.floor(s / 60) % 60) + ':' + pad(s % 60); };
  const mapUrl = j => 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(j.addr + ', ' + j.suburb + ', New Zealand');
  const staff = k => STAFF.find(x => x.key === k);
  const company = k => COS.find(c => c.key === k);
  const isDone = j => j.status === 'complete' || j.status === 'invoiced';
  // Makes typed text safe to show on screen.
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (name, size = 18) => `<i data-lucide="${name}" width="${size}" height="${size}" stroke-width="${size <= 16 ? 1.75 : 2}" aria-hidden="true"></i>`;
  const avatar = (p, size, font) => `<span class="avatar" style="width:${size}px;height:${size}px;background:${p.color};font-size:${font}px" aria-hidden="true">${esc(p.initials)}</span>`;
  const pill = status => `<span class="pill ${status}">${STATUS_LABEL[status] || status}</span>`;
  const urgent = j => j.urgent ? '<span class="urgent">Urgent</span>' : '';
  const jobsToday = n => n === 1 ? '1 job today' : `${n} jobs today`;
  const blankIntake = () => ({ name: '', phone: '', addr: '', suburb: 'Wellington', priority: 'Standard', desc: '', who: null });

  /* ---------- State ---------- */
  function freshState() {
    const now = Date.now();
    return {
      user: null, screen: 'login', co: 'pop', filter: 'all', invTab: 'ready', jobId: null, from: null,
      jobs: window.JOBS.map(j => ({ ...j })),
      invoices: window.INVOICES.map(x => ({ ...x })),
      clock: {
        shane: { on: false, banked: 0, log: [] },
        sara: { on: false, banked: 0, log: [] },
        liam: { on: true, start: now - (2 * 3600 + 29 * 60) * 1000, banked: 0, log: [{ t: '07:12', text: 'Clocked on · Piped Out Plumbing' }] },
        tama: { on: true, start: now - (1 * 3600 + 56 * 60) * 1000, banked: 0, log: [{ t: '07:45', text: 'Clocked on · Up Keep' }] }
      },
      approved: {}, reminded: {}, created: { pop: 0, pm: 0 }, invSeq: { pop: 1088, pm: 225 }, seq: { pop: 2467, pm: 416 },
      notes: { 'POP-2462': [{ t: '09:12', text: 'Pressure relief valve dripping. Isolated cylinder, part on order from Plumbing World.' }] },
      photos: { 'POP-2461': 2, 'POP-2462': 1 },
      noteDraft: '', intake: blankIntake(), intakeErr: '',
      pinFor: null, pin: '', coFor: null, lastCo: { tama: 'pm' },
      // not saved:
      toast: '', sheet: false
    };
  }
  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY));
      if (saved && saved.jobs) return { ...freshState(), ...saved, toast: '', sheet: false };
    } catch (e) { /* storage blocked or empty: start fresh */ }
    return freshState();
  }
  function save() {
    try {
      const { toast, sheet, ...keep } = state;
      localStorage.setItem(STORE_KEY, JSON.stringify(keep));
    } catch (e) { /* fine, just won't remember */ }
  }

  let state = load();
  let toastTimer = null;

  function set(patch) {
    const p = typeof patch === 'function' ? patch(state) : patch;
    const screenChanged = p.screen && p.screen !== state.screen;
    state = { ...state, ...p };
    save();
    render(screenChanged);
  }
  function toast(msg) {
    set({ toast: msg });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => set({ toast: '' }), 2800);
  }

  /* ---------- Click handling ----------
     Each button gets data-act="N"; N points at a function in `actions`. */
  let actions = [];
  const act = fn => { actions.push(fn); return `data-act="${actions.length - 1}"`; };

  /* ============================================================
     RENDER
     ============================================================ */
  const root = document.getElementById('app');

  function render(resetScroll) {
    actions = [];
    const s = state;
    const now = Date.now(), nowT = hm(new Date());
    const me = staff(s.user);
    const role = me ? me.role : null;
    const boss = role === 'owner' || role === 'admin';
    const co = company(s.co);
    const coJobs = s.jobs.filter(j => j.co === s.co);
    const el = c => c.banked + (c.on ? now - c.start : 0);
    const go = (screen, extra) => () => set({ screen, sheet: false, ...(extra || {}) });
    const patchJob = (id, f) => set(c => ({ jobs: c.jobs.map(j => j.id === id ? { ...j, ...f } : j) }));

    const assign = (id, who) => {
      const j = s.jobs.find(x => x.id === id);
      patchJob(id, { who, time: j.time === 'TBC' ? '15:30' : j.time, end: j.end || '16:30' });
      toast(`${id} allocated to ${staff(who).name}. It's on their run sheet now.`);
    };
    const openJob = j => () => set({ screen: 'job', jobId: j.id, from: s.screen, noteDraft: '' });

    const createInvoice = j => {
      const n = s.invSeq[j.co];
      const id = 'INV-' + (j.co === 'pm' ? '0' : '') + n;
      const amount = Math.round(j.value * GST * 100) / 100;
      set(c => ({
        jobs: c.jobs.map(x => x.id === j.id ? { ...x, status: 'invoiced' } : x),
        invoices: [{ id, job: j.id, co: j.co, client: j.client, amount, state: 'sent', due: '9 Nov' }, ...c.invoices],
        invSeq: { ...c.invSeq, [j.co]: n + 1 },
        created: { ...c.created, [j.co]: (c.created[j.co] || 0) + amount }
      }));
      toast(`${id} for ${money(amount)} created in Xero and emailed to ${j.client}.`);
    };

    let body = '';
    if (!role) body = loginScreen();
    else {
      const screens = { today, job: jobDetail, clock, intake, overview, jobs: allJobs, invoices, team };
      body = (s.screen !== 'job' ? topBar() : '') + (screens[s.screen] || screens[HOME[role]])();
    }

    const scroller = root.querySelector('.scroll');
    const keepScroll = !resetScroll && scroller ? scroller.scrollTop : 0;

    root.innerHTML =
      `<div class="scroll">${body}</div>` +
      (role ? tabBar() : '') +
      (s.sheet && role ? sheet() : '') +
      (s.toast ? `<div class="toast" role="status"><span class="ok">${icon('circle-check', 18)}</span><span>${esc(s.toast)}</span></div>` : '');

    root.querySelector('.scroll').scrollTop = keepScroll;
    if (window.lucide) window.lucide.createIcons();

    /* ---------------- Pieces ---------------- */

    function topBar() {
      return `<div class="topbar">
        <button class="co-pill" ${act(() => set({ sheet: true }))} aria-label="Working for ${esc(co.short)}. Switch company or sign out">
          <span class="mark" style="width:34px;height:34px;border-radius:50%"><img src="${co.mark}" alt="" width="22" height="22"></span>
          <span class="name">${esc(co.short)}</span>
          <span class="chev">${icon('chevron-down', 16)}</span>
        </button>
        <button class="me-btn" style="background:${me.color}" ${act(() => set({ sheet: true }))} aria-label="${esc(me.name)}: account">${esc(me.initials)}</button>
      </div>`;
    }

    function tabBar() {
      return `<nav class="tabbar" aria-label="Main">${TABS[role].map(([k, ic, label]) => {
        const on = s.screen === k || (s.screen === 'job' && s.from === k);
        return `<button class="${on ? 'on' : ''}" ${on ? 'aria-current="page"' : ''} ${act(go(k))}>${icon(ic, 22)}${label}</button>`;
      }).join('')}</nav>`;
    }

    function sheet() {
      const rows = COS.map(c => {
        const sel = c.key === s.co;
        const sub = c.soon ? 'Coming soon' : jobsToday(s.jobs.filter(j => j.co === c.key && (boss || j.who === me.key)).length);
        const pick = () => {
          if (c.soon) return toast('Apex Access Hire is not set up yet. Ask the office to add it.');
          const cl = s.clock[me.key];
          set(x => ({
            co: c.key, sheet: false, screen: x.screen === 'job' ? HOME[role] : x.screen,
            clock: cl.on && c.key !== x.co ? { ...x.clock, [me.key]: { ...cl, log: [{ t: nowT, text: 'Switched to ' + c.short }, ...cl.log] } } : x.clock
          }));
          if (c.key !== s.co) toast(`Now working for ${c.short}.` + (cl.on ? ' Hours from here go to them.' : ''));
        };
        return `<button class="co-row ${sel ? 'on' : ''} ${c.soon ? 'soon' : ''}" ${act(pick)} ${sel ? 'aria-current="true"' : ''}>
          <span class="mark" style="width:40px;height:40px;border-radius:50%"><img src="${c.mark}" alt="" width="26" height="26"></span>
          <span class="grow stack gap-2"><span style="font:600 16px var(--font-sans)">${esc(c.name)}</span><span style="font:400 13px var(--font-sans);color:var(--fg-2)">${sub}</span></span>
          ${sel ? `<span style="color:var(--brand);display:flex">${icon('check', 20)}</span>` : ''}
        </button>`;
      }).join('');
      return `<div class="sheet" role="dialog" aria-modal="true" aria-label="Switch company">
        <button class="scrim" aria-label="Close" ${act(() => set({ sheet: false }))}></button>
        <div class="sheet-body">
          <span class="grabber" aria-hidden="true"></span>
          <span class="eyebrow">Working for</span>
          <div class="stack gap-8">${rows}</div>
          ${boss ? `<button class="btn btn-dashed" style="min-height:48px" ${act(() => { set({ sheet: false }); toast('Company setup opens in the office app: name, GST number, Xero org, job prefix.'); })}>${icon('plus', 16)}Add a company</button>` : ''}
          <div class="row gap-12" style="padding-top:14px;border-top:1px solid var(--border-soft)">
            ${avatar(me, 40, 14)}
            <span class="grow stack"><span style="font:600 16px var(--font-sans)">${esc(me.name)}</span><span style="font:400 13px var(--font-sans);color:var(--fg-2)">${esc(me.roleLabel)}</span></span>
            <button class="btn btn-outline h44" style="border-radius:10px" ${act(() => set({ user: null, screen: 'login', sheet: false, pinFor: null, pin: '', coFor: null }))}>Sign out</button>
          </div>
        </div>
      </div>`;
    }

    /* ---------------- Sign in ---------------- */
    function loginScreen() {
      const enter = (st, ck) => {
        set({ user: st.key, co: ck, screen: HOME[st.role], pin: '', pinFor: null, coFor: null, filter: 'all', lastCo: { ...s.lastCo, [st.key]: ck } });
        toast(`Signed in as ${st.name}, working for ${company(ck).short}.`);
      };
      const notYou = () => set({ pinFor: null, pin: '', coFor: null });
      let inner = '';

      if (s.coFor) {
        const st = staff(s.coFor);
        const last = s.lastCo[st.key];
        const list = st.cos.map(company).sort((a, b) => (b.key === last) - (a.key === last));
        inner = `<div class="stack gap-4"><h1 class="title-lg">Hi ${esc(st.name)}, who are you working for?</h1><p class="sub">You can switch any time from the top of the screen.</p></div>
          <div class="stack gap-10">${list.map(c => `
            <button class="card tap-card lift pick-row tall ${c.key === last ? 'selected' : ''}" ${act(() => enter(st, c.key))}>
              <span class="mark" style="width:52px;height:52px;border-radius:12px"><img src="${c.mark}" alt="" width="38" height="38"></span>
              <span class="grow stack gap-2"><span class="who">${esc(c.name)}</span><span class="role">${c.key === last ? 'Last used' : jobsToday(s.jobs.filter(j => j.co === c.key && (st.role !== 'field' || j.who === st.key)).length)}</span></span>
              <span class="chev">${icon('chevron-right', 18)}</span>
            </button>`).join('')}</div>
          <button class="btn-link" ${act(notYou)}>Not ${esc(st.name)}?</button>`;
      } else if (s.pinFor) {
        const st = staff(s.pinFor);
        const press = k => () => {
          if (k === 'del') return set(c => ({ pin: c.pin.slice(0, -1) }));
          const pin = s.pin + k;
          if (pin.length < 4) return set({ pin });
          // Demo: any 4-digit PIN works. Real PIN checking comes with Airtable.
          if (st.cos.length > 1) return set({ pin: '', pinFor: null, coFor: st.key });
          enter(st, st.cos[0]);
        };
        const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];
        inner = `<div class="stack gap-6" style="align-items:center;text-align:center"><h1 class="title-lg">Hi ${esc(st.name)}</h1><p class="sub">Enter your 4-digit PIN</p></div>
          <div class="dots" aria-label="${s.pin.length} of 4 digits entered">${[0, 1, 2, 3].map(n => `<span class="${n < s.pin.length ? 'on' : ''}"></span>`).join('')}</div>
          <div class="keypad">${keys.map(k => k === ''
            ? '<span class="blank"></span>'
            : `<button ${act(press(k))} ${k === 'del' ? 'aria-label="Delete"' : ''}>${k === 'del' ? icon('delete', 24) : k}</button>`).join('')}</div>
          <button class="btn-link" ${act(notYou)}>Not ${esc(st.name)}?</button>`;
      } else {
        inner = `<div class="stack gap-4"><h1 class="title-lg">Who's signing in?</h1><p class="sub">Tap your name.</p></div>
          <div class="stack gap-10">${STAFF.map(st => `
            <button class="card tap-card lift pick-row" ${act(() => set({ pinFor: st.key, pin: '' }))}>
              ${avatar(st, 44, 15)}
              <span class="grow stack gap-2"><span class="who">${esc(st.name)}</span><span class="role">${esc(st.roleLabel)}</span></span>
              <span class="chev">${icon('chevron-right', 18)}</span>
            </button>`).join('')}</div>`;
      }
      return `<div class="login">
        <div class="brand-lockup"><img src="assets/tradehouse-hq-mark.svg" alt="" width="72" height="72"><span>Tradehouse HQ</span></div>
        ${inner}
      </div>`;
    }

    /* ---------------- Today (my run sheet) ---------------- */
    function today() {
      const mine = coJobs.filter(j => j.who === me.key);
      const doneN = mine.filter(isDone).length;
      const c = s.clock[me.key];
      const dateLabel = new Date().toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long' }).replace(',', '');
      const chip = c.on
        ? `<button class="clock-chip on" ${act(go('clock'))}><span class="dot"></span><span class="grow">On the clock · ${dur(el(c))}</span>${icon('chevron-right', 18)}</button>`
        : `<button class="clock-chip" ${act(go('clock'))}><span class="dot"></span><span class="grow">Off the clock. Tap to clock on.</span>${icon('chevron-right', 18)}</button>`;
      const list = mine.length === 0
        ? `<div class="empty"><img src="assets/logo-drop.png" alt="" width="64" style="opacity:.5"><span style="font:600 17px var(--font-sans)">No jobs allocated to you</span><span class="sub">Nothing for ${esc(co.short)} today. Check the other company with the switcher above.</span></div>`
        : `<div class="between"><h2 class="h-section">Run sheet</h2><span style="font:500 14px var(--font-sans);color:var(--fg-2)">${doneN} of ${mine.length} done</span></div>
           <div class="stack gap-12" style="margin-top:-4px">${mine.map(j => `
             <button class="card tap-card lift job-card ${isDone(j) ? 'done' : ''}" ${act(openJob(j))}>
               <span class="row" style="justify-content:space-between;gap:8px;width:100%"><span class="time">${j.end ? `${esc(j.time)} – ${esc(j.end)}` : 'Time to be set'}</span>${pill(j.status)}</span>
               <span class="what">${esc(j.title)}</span>
               <span class="where">${icon('map-pin', 16)}${esc(j.addr)}, ${esc(j.suburb)}</span>
               <span class="meta" style="width:100%"><span class="mono">${esc(j.id)}</span><span>${esc(j.client)}</span><span class="grow"></span>${urgent(j)}</span>
             </button>`).join('')}</div>`;
      return `<div class="screen">
        <div class="stack gap-4"><span class="eyebrow">${esc(dateLabel)}</span><h1 class="title">My jobs</h1></div>
        ${chip}${list}
      </div>`;
    }

    /* ---------------- Job detail ---------------- */
    function jobDetail() {
      const job = s.jobs.find(j => j.id === s.jobId) || coJobs[0];
      if (!job) return today();
      const myClock = s.clock[me.key];
      const isMine = job.who === me.key;
      const notes = s.notes[job.id] || [];
      const pc = s.photos[job.id] || 0;
      const inv = s.invoices.find(x => x.job === job.id);
      const done = job.status === 'complete';
      const hasAction = isMine && (job.status === 'scheduled' || job.status === 'in-progress');
      const doAction = () => {
        if (job.status === 'scheduled') {
          patchJob(job.id, { status: 'in-progress' });
          if (!myClock.on) set(x => ({ clock: { ...x.clock, [me.key]: { on: true, start: Date.now(), banked: myClock.banked, log: [{ t: nowT, text: 'Clocked on · ' + co.short }, ...myClock.log] } } }));
          toast(`${job.id} started.` + (myClock.on ? '' : ' Clocked you on.'));
        } else {
          patchJob(job.id, { status: 'complete' });
          toast('Job complete. The office has it for invoicing.');
        }
      };
      const addNote = () => {
        const text = (state.noteDraft || '').trim();
        if (!text) return toast('Type a note first.');
        set(c => ({ notes: { ...c.notes, [job.id]: [...(c.notes[job.id] || []), { t: nowT, text, by: me.name }] }, noteDraft: '' }));
        toast('Note saved to ' + job.id + '.');
      };
      const invInfo = job.status === 'invoiced' && inv
        ? { label: `Invoiced · ${inv.id}`, detail: `${money(inv.amount)} incl. GST · due ${inv.due}`, bg: 'var(--job-invoiced-bg)', fg: 'var(--job-invoiced)' }
        : done
          ? { label: 'Ready to invoice', detail: boss ? `${money(job.value * GST)} incl. GST` : 'The office has been told. Nothing for you to do.', bg: 'var(--status-success-bg)', fg: 'var(--status-success)' }
          : { label: 'Not ready', detail: 'Mark the job complete and it goes to the office for invoicing.', bg: 'var(--bg-sunken)', fg: 'var(--fg-3)' };
      const who = job.who ? staff(job.who) : { name: 'Unassigned', initials: '?', color: '#C9CFCB' };

      return `<div class="job-head">
          <button class="btn-icon" aria-label="Back" ${act(go(s.from || HOME[role]))}>${icon('chevron-left', 24)}</button>
          <span style="font:600 13px var(--font-mono);color:var(--fg-2)">${esc(job.id)}</span><span class="grow"></span>${pill(job.status)}
        </div>
        <div class="screen" style="padding-bottom:28px">
          <div class="stack gap-6">
            <h1 style="margin:0;font:700 26px/1.15 var(--font-sans);letter-spacing:-0.01em">${esc(job.title)}</h1>
            <span class="sub">${job.end ? `${esc(job.time)} – ${esc(job.end)}` : 'Time to be set'} · ${esc(job.client)}</span>
            ${job.urgent ? '<span class="urgent" style="align-self:flex-start;margin-top:4px">Urgent</span>' : ''}
          </div>

          <div class="card list">
            <div class="info-row"><span class="icon">${icon('map-pin', 20)}</span><div class="grow stack"><span class="main">${esc(job.addr)}</span><span class="second">${esc(job.suburb)}</span></div>
              <a class="btn btn-soft h44" style="padding:0 14px" href="${mapUrl(job)}" target="_blank" rel="noopener">${icon('navigation', 16)}Go</a></div>
            <div class="info-row"><span class="icon">${icon('user', 20)}</span><div class="grow stack"><span class="main">${esc(job.contact)}</span><span class="second">${esc(job.phone)}</span></div>
              <a class="btn btn-soft h44" style="padding:0 14px" href="tel:${esc(String(job.phone).replace(/\s/g, ''))}">${icon('phone', 16)}Call</a></div>
          </div>

          <div class="access"><span style="color:var(--fg-2);display:flex;padding-top:1px">${icon('key-round', 18)}</span><span>${esc(job.access)}</span></div>

          ${boss ? `<div class="stack gap-10"><h2 class="h-section">Allocated to</h2>
            <div class="assign-grid">${FIELD.map(st => `<button class="${job.who === st.key ? 'on' : ''}" ${job.who === st.key ? 'aria-pressed="true"' : 'aria-pressed="false"'} ${act(() => job.who !== st.key && assign(job.id, st.key))}>${avatar(st, 28, 11)}${esc(st.name)}</button>`).join('')}</div></div>`
            : `<div class="row gap-10" style="font:500 15px var(--font-sans);color:var(--fg-2)">${avatar(who, 28, 11)}Allocated to ${esc(who.name)}</div>`}

          ${hasAction ? `<button class="btn btn-primary h56" ${act(doAction)}>${icon(job.status === 'scheduled' ? 'play' : 'check', 20)}${job.status === 'scheduled' ? 'Start job' : 'Mark complete'}</button>` : ''}

          <div class="stack gap-10">
            <h2 class="h-section">Notes</h2>
            ${notes.map(n => `<div class="note"><span class="text">${esc(n.text)}</span><span class="when">${esc(n.t)}${n.by ? ' · ' + esc(n.by) : ''}</span></div>`).join('')}
            <label class="stack gap-6"><span class="sr" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">New note</span>
              <textarea class="input" rows="3" data-field="noteDraft" placeholder="What did you find? Parts used?">${esc(s.noteDraft)}</textarea></label>
            <button class="btn btn-dark h44" style="align-self:flex-end;padding:0 18px" ${act(addNote)}>Save note</button>
          </div>

          <div class="stack gap-10">
            <div class="between"><h2 class="h-section">Photos</h2><span style="font:500 14px var(--font-sans);color:var(--fg-2)">${pc === 1 ? '1 photo' : `${pc} photos`}</span></div>
            <div class="photo-grid">
              ${Array.from({ length: pc }, () => `<div class="photo"><img src="assets/logo-drop.png" alt="" width="24" style="opacity:.25"><span>PHOTO</span></div>`).join('')}
              <button class="btn btn-dashed add-photo" ${act(() => { set(c => ({ photos: { ...c.photos, [job.id]: (c.photos[job.id] || 0) + 1 } })); toast('Photo added to ' + job.id + '.'); })}>${icon('camera', 22)}Add photo</button>
            </div>
          </div>

          <div class="stack gap-10">
            <h2 class="h-section">Invoice</h2>
            <div class="card flat stack gap-12" style="padding:14px 16px">
              <div class="row gap-12"><span class="inv-icon" style="background:${invInfo.bg};color:${invInfo.fg}">${icon('receipt', 18)}</span>
                <div class="stack gap-2"><span style="font:600 16px var(--font-sans)">${invInfo.label}</span><span style="font:400 14px var(--font-sans);color:var(--fg-2)">${invInfo.detail}</span></div></div>
              ${boss && done ? `<button class="btn btn-primary h48" style="font-size:16px" ${act(() => createInvoice(job))}>Create invoice in Xero</button>` : ''}
            </div>
          </div>
        </div>`;
    }

    /* ---------------- Timesheet / clock ---------------- */
    function clock() {
      const c = s.clock[me.key];
      const toggle = () => {
        const nc = c.on
          ? { on: false, banked: el(c), log: [{ t: nowT, text: 'Clocked off' }, ...c.log] }
          : { on: true, start: Date.now(), banked: c.banked, log: [{ t: nowT, text: 'Clocked on · ' + co.short }, ...c.log] };
        set(x => ({ clock: { ...x.clock, [me.key]: nc } }));
        toast(c.on ? `Clocked off. ${dur(el(c))} logged today.` : `Clocked on for ${co.short}.`);
      };
      return `<div class="screen">
        <h1 class="title">Timesheet</h1>
        <div class="clock-hero">
          <span class="eyebrow" style="color:${c.on ? 'var(--pop-light-green)' : 'var(--pop-mist)'}">${c.on ? 'On the clock' : 'Off the clock'}</span>
          <span class="big">${clockTxt(el(c))}</span>
          <span class="goes">Hours go to ${esc(co.short)}</span>
          <button style="background:${c.on ? '#fff' : 'var(--pop-light-green)'}" ${act(toggle)}>${c.on ? 'Clock off' : 'Clock on'}</button>
        </div>
        ${c.log.length ? `<div class="stack gap-10"><h2 class="h-section">Today</h2>
          <div class="card flat list">${c.log.map(l => `<div class="log-row"><span class="t">${esc(l.t)}</span><span style="font:400 15px var(--font-sans)">${esc(l.text)}</span></div>`).join('')}</div></div>` : ''}
        <div class="card flat row" style="justify-content:space-between;padding:14px 16px">
          <div class="stack gap-2"><span style="font:600 15px var(--font-sans)">Last week</span><span style="font:400 13px var(--font-sans);color:var(--fg-2)">${s.approved[me.key] ? 'Approved by the office' : 'Waiting for approval'}</span></div>
          <span class="num" style="font:700 20px var(--font-sans)">${me.lastWeek ? `${me.lastWeek} h` : '—'}</span>
        </div>
      </div>`;
    }

    /* ---------------- New job ---------------- */
    function intake() {
      const f = s.intake;
      const chip = (label, on, fn, cls = '') => `<button class="chip ${cls} ${on ? 'on' : ''}" aria-pressed="${on}" ${act(fn)}>${esc(label)}</button>`;
      const setI = (k, v) => () => set(c => ({ intake: { ...c.intake, [k]: v } }));
      const saveJob = () => {
        const fi = state.intake;
        if (!fi.name.trim() || !fi.addr.trim()) return set({ intakeErr: 'Add the customer and the address so the job can be found later.' });
        const n = s.seq[s.co]; const id = co.prefix + n;
        const who = boss ? fi.who : me.key;
        const nj = window.makeJob(id, s.co, who, who ? '15:30' : 'TBC', who ? '16:30' : '', fi.desc.trim() || 'New job', fi.addr.trim(), fi.suburb, fi.name.trim(), 'scheduled',
          { urgent: fi.priority === 'Urgent', phone: fi.phone || '—', contact: fi.name.trim() });
        set(c => ({ jobs: [...c.jobs, nj], seq: { ...c.seq, [c.co]: n + 1 }, intake: blankIntake(), intakeErr: '', screen: boss ? 'jobs' : 'today', filter: 'all' }));
        toast(`${id} added for ${co.short}.` + (who ? ` On ${staff(who).name}'s run sheet.` : ' Waiting to be allocated.'));
      };
      return `<div class="screen" style="padding-bottom:28px">
        <div class="stack gap-4"><h1 class="title">New job</h1><p class="sub">For ${esc(co.short)}. ${boss ? 'Allocate now or leave it for later.' : 'It goes on your run sheet and the office is told.'}</p></div>
        <label class="field">Customer or company<input class="input" data-field="intake.name" value="${esc(f.name)}" placeholder="e.g. Pinnacle Reach" autocomplete="off"></label>
        <label class="field">Phone<input class="input" data-field="intake.phone" value="${esc(f.phone)}" placeholder="021 000 000" inputmode="tel" autocomplete="off"></label>
        <label class="field">Address<input class="input" data-field="intake.addr" value="${esc(f.addr)}" placeholder="Street and number" autocomplete="off"></label>
        <fieldset class="stack gap-8" style="border:0;padding:0;margin:0"><legend style="font:600 14px var(--font-sans);padding:0;margin-bottom:8px">Area</legend>
          <div class="chips">${['Wellington', 'Hutt Valley', 'Porirua', 'Kāpiti'].map(x => chip(x, f.suburb === x, setI('suburb', x))).join('')}</div></fieldset>
        <fieldset class="stack gap-8" style="border:0;padding:0;margin:0"><legend style="font:600 14px var(--font-sans);padding:0;margin-bottom:8px">Priority</legend>
          <div class="row gap-8">${['Standard', 'Urgent'].map(x => chip(x, f.priority === x, setI('priority', x), 'square')).join('')}</div></fieldset>
        <label class="field">What's the job?<textarea class="input" data-field="intake.desc" rows="3" placeholder="e.g. Leaking tap in upstairs bathroom">${esc(f.desc)}</textarea></label>
        ${boss ? `<fieldset class="stack gap-8" style="border:0;padding:0;margin:0"><legend style="font:600 14px var(--font-sans);padding:0;margin-bottom:8px">Allocate to</legend>
          <div class="chips">${[{ key: null, name: 'Unassigned' }, ...FIELD].map(x => chip(x.name, f.who === x.key, setI('who', x.key))).join('')}</div></fieldset>` : ''}
        ${s.intakeErr ? `<div class="error" role="alert">${esc(s.intakeErr)}</div>` : ''}
        <button class="btn btn-primary h56" ${act(saveJob)}>Save job</button>
      </div>`;
    }

    /* ---------------- Owner overview ---------------- */
    function overview() {
      const coInv = s.invoices.filter(x => x.co === s.co);
      const outstanding = coInv.filter(x => x.state !== 'paid').reduce((a, x) => a + x.amount, 0);
      const overdue = coInv.filter(x => x.state === 'overdue');
      const ready = coJobs.filter(j => j.status === 'complete');
      const unassigned = coJobs.filter(j => !j.who);
      const kpis = [
        { label: 'Invoiced this month', value: money(co.month + (s.created[s.co] || 0), false), color: 'var(--fg-1)' },
        { label: 'Outstanding', value: money(outstanding, false), color: 'var(--fg-1)' },
        { label: 'Overdue', value: money(overdue.reduce((a, x) => a + x.amount, 0), false), color: 'var(--status-danger)', sub: `${overdue.length} invoices` },
        { label: 'Ready to invoice', value: money(ready.reduce((a, j) => a + j.value * GST, 0), false), color: 'var(--status-success)', sub: `${ready.length} jobs` }
      ];
      const month = new Date().toLocaleDateString('en-NZ', { month: 'long' });
      return `<div class="screen">
        <div class="stack gap-4"><span class="eyebrow">${esc(month)}</span><h1 class="title">Overview</h1></div>
        <div class="kpis">${kpis.map(k => `<div class="card kpi"><span class="label">${k.label}</span><span class="value" style="color:${k.color}">${k.value}</span>${k.sub ? `<span class="note2">${k.sub}</span>` : ''}</div>`).join('')}</div>
        <button class="btn btn-outline h48" ${act(go('invoices', { invTab: 'overdue' }))}>${icon('receipt', 16)}Chase overdue invoices</button>
        ${unassigned.length ? `<div class="warn"><span style="color:var(--status-warning);display:flex">${icon('triangle-alert', 20)}</span><span class="text">${unassigned.length === 1 ? '1 job needs allocating' : `${unassigned.length} jobs need allocating`}</span>
          <button class="btn btn-dark h44" ${act(go('jobs', { filter: 'unassigned' }))}>Allocate</button></div>` : ''}
        <div class="stack gap-10"><h2 class="h-section">Today</h2>
          <div class="stat-pair"><div class="card flat">${coJobs.filter(isDone).length} of ${coJobs.length} jobs done</div><div class="card flat">${FIELD.filter(st => s.clock[st.key].on).length} crew on the clock</div></div></div>
        <div class="stack gap-10"><h2 class="h-section">All companies this month</h2>
          <div class="card flat list">${COS.filter(c => !c.soon).map(c => `
            <button class="split-row" ${act(() => set({ co: c.key }))} aria-label="Switch to ${esc(c.short)}">
              <span class="avatar" style="width:30px;height:30px;background:${c.bg};font-size:11px" aria-hidden="true">${c.badge}</span>
              <span class="grow" style="font:500 15px var(--font-sans)">${esc(c.short)}</span>
              <span class="num" style="font:700 16px var(--font-sans)">${money(c.month + (s.created[c.key] || 0), false)}</span>
            </button>`).join('')}</div></div>
      </div>`;
    }

    /* ---------------- All jobs / allocate ---------------- */
    function allJobs() {
      const F = { all: () => true, unassigned: j => !j.who, 'in-progress': j => j.status === 'in-progress', complete: isDone };
      const list = coJobs.filter(F[s.filter] || F.all);
      const filters = [['all', 'All'], ['unassigned', 'Unassigned'], ['in-progress', 'In progress'], ['complete', 'Done']];
      return `<div class="screen tight">
        <h1 class="title">${role === 'owner' ? 'Allocate' : 'All jobs'}</h1>
        <div class="chips scroll-x">${filters.map(([k, l]) => `<button class="chip ${s.filter === k ? 'on' : ''}" aria-pressed="${s.filter === k}" ${act(() => set({ filter: k }))}>${l} ${coJobs.filter(F[k]).length}</button>`).join('')}</div>
        ${list.length === 0 ? '<div class="empty-sm">Nothing here. Every job is allocated.</div>' : ''}
        ${list.map(j => {
          const who = j.who ? staff(j.who) : null;
          return `<div class="card job-row">
            <button class="open" ${act(openJob(j))}>
              <span class="row" style="justify-content:space-between;gap:8px;width:100%"><span style="font:600 12px var(--font-mono);color:var(--fg-2)">${esc(j.id)} · ${esc(j.time)}</span>${pill(j.status)}</span>
              <span style="font:600 17px/1.25 var(--font-sans)">${esc(j.title)}</span>
              <span class="row gap-8" style="font:400 14px var(--font-sans);color:var(--fg-2);width:100%"><span class="grow">${esc(j.suburb)} · ${esc(j.client)}</span>${urgent(j)}</span>
            </button>
            ${who
              ? `<div class="row gap-8" style="font:500 14px var(--font-sans);color:var(--fg-2)">${avatar(who, 24, 10)}${esc(who.name)}</div>`
              : `<div class="alloc"><span class="label">Allocate to</span>
                 ${FIELD.map(st => `<button class="alloc-chip" ${act(() => assign(j.id, st.key))}>${avatar(st, 28, 10)}${esc(st.name)}</button>`).join('')}</div>`}
          </div>`;
        }).join('')}
      </div>`;
    }

    /* ---------------- Invoices ---------------- */
    function invoices() {
      const coInv = s.invoices.filter(x => x.co === s.co);
      const ready = coJobs.filter(j => j.status === 'complete');
      const counts = { ready: ready.length, sent: coInv.filter(x => x.state === 'sent').length, overdue: coInv.filter(x => x.state === 'overdue').length };
      const rows = s.invTab === 'ready'
        ? ready.map(j => ({ id: j.id, client: j.client, title: j.title, amount: money(j.value * GST), meta: 'Completed today', metaColor: 'var(--fg-2)', btn: 'Create invoice', primary: true, act: () => createInvoice(j) }))
        : coInv.filter(x => x.state === s.invTab).map(x => ({
            id: x.id, client: x.client, title: x.job || '', amount: money(x.amount),
            meta: x.state === 'overdue' ? `${x.days} days overdue · was due ${x.due}` : `Due ${x.due}`,
            metaColor: x.state === 'overdue' ? 'var(--status-danger)' : 'var(--fg-2)',
            btn: x.state === 'overdue' ? (s.reminded[x.id] ? 'Reminder sent' : 'Send reminder') : null,
            primary: !s.reminded[x.id],
            act: () => { if (s.reminded[x.id]) return; set(c => ({ reminded: { ...c.reminded, [x.id]: true } })); toast(`Reminder for ${x.id} emailed to ${x.client}.`); }
          }));
      return `<div class="screen tight">
        <h1 class="title">Invoices</h1>
        <div class="segmented" role="tablist">${[['ready', 'Ready'], ['sent', 'Sent'], ['overdue', 'Overdue']].map(([k, l]) => `<button role="tab" aria-selected="${s.invTab === k}" class="${s.invTab === k ? 'on' : ''}" ${act(() => set({ invTab: k }))}>${l} ${counts[k]}</button>`).join('')}</div>
        ${rows.length === 0 ? '<div class="empty-sm">All clear.</div>' : ''}
        ${rows.map(r => `<div class="card stack gap-10" style="padding:14px 16px">
          <div class="between"><span style="font:600 13px var(--font-mono);color:var(--fg-2)">${esc(r.id)}</span><span class="num" style="font:700 18px var(--font-sans)">${r.amount}</span></div>
          <div class="stack gap-2"><span style="font:600 16px var(--font-sans)">${esc(r.client)}</span>${r.title ? `<span style="font:400 14px var(--font-sans);color:var(--fg-2)">${esc(r.title)}</span>` : ''}<span style="font:500 13px var(--font-sans);color:${r.metaColor}">${r.meta}</span></div>
          ${r.btn ? `<button class="btn h44" style="border-radius:10px;background:${r.primary ? 'var(--brand)' : 'var(--bg-sunken)'};color:${r.primary ? '#fff' : 'var(--fg-2)'}" ${act(r.act)}>${r.btn}</button>` : ''}
        </div>`).join('')}
      </div>`;
    }

    /* ---------------- Team & timesheets ---------------- */
    function team() {
      const pending = FIELD.filter(st => !s.approved[st.key]).length;
      const lastSun = new Date(); lastSun.setDate(lastSun.getDate() - ((lastSun.getDay() + 7) % 7 || 7));
      return `<div class="screen">
        <h1 class="title">Team</h1>
        <div class="card list">${FIELD.map(st => {
          const c = s.clock[st.key];
          const jobsT = s.jobs.filter(j => j.who === st.key && j.co === s.co);
          const cur = jobsT.find(j => j.status === 'in-progress');
          return `<div class="member">${avatar(st, 40, 13)}
            <span class="grow stack gap-2"><span style="font:600 16px var(--font-sans)">${esc(st.name)}</span><span style="font:400 13px var(--font-sans);color:var(--fg-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${cur ? `${esc(cur.title)}, ${esc(cur.suburb)}` : jobsToday(jobsT.length)}</span></span>
            <span class="status-tag" style="background:${c.on ? 'var(--brand-soft)' : 'var(--bg-sunken)'};color:${c.on ? 'var(--brand)' : 'var(--fg-2)'}">${c.on ? `On · ${dur(el(c))}` : 'Off'}</span></div>`;
        }).join('')}</div>
        <div class="between"><h2 class="h-section">Timesheets</h2><span style="font:500 14px var(--font-sans);color:var(--fg-2)">Week ending ${lastSun.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })}</span></div>
        <div class="card flat list">${FIELD.map(st => `<div class="ts-row">
          <span class="grow" style="font:600 15px var(--font-sans)">${esc(st.name)}</span><span class="num" style="font:700 16px var(--font-sans)">${st.lastWeek} h</span>
          ${s.approved[st.key]
            ? `<span class="approved">${icon('check', 16)}Approved</span>`
            : `<button class="btn btn-brand-outline h44" style="padding:0 14px;font-size:14px" ${act(() => { set(c => ({ approved: { ...c.approved, [st.key]: true } })); toast(`${st.name}'s timesheet approved and sent to Xero payroll.`); })}>Approve</button>`}
        </div>`).join('')}</div>
        ${pending ? `<button class="btn btn-primary h52" ${act(() => { set({ approved: Object.fromEntries(FIELD.map(st => [st.key, true])) }); toast('All timesheets approved and sent to Xero payroll.'); })}>Approve all and send to payroll</button>` : ''}
      </div>`;
    }
  }

  /* ---------- Wire up clicks and typing (once) ---------- */
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b || !root.contains(b)) return;
    const fn = actions[+b.dataset.act];
    if (fn) fn();
  });
  // Typing updates the state quietly (no redraw), so the keyboard stays open.
  root.addEventListener('input', e => {
    const f = e.target.dataset && e.target.dataset.field;
    if (!f) return;
    const v = e.target.value;
    if (f.startsWith('intake.')) {
      const k = f.slice(7);
      state = { ...state, intake: { ...state.intake, [k]: v }, intakeErr: '' };
      const err = root.querySelector('.error'); if (err) err.remove();
    } else {
      state = { ...state, [f]: v };
    }
    save();
  });

  // Tick once a second so running clocks count up — but never while someone is typing.
  setInterval(() => {
    if (!state.user || state.sheet || !['today', 'clock', 'team'].includes(state.screen)) return;
    const a = document.activeElement;
    if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) return;
    render(false);
  }, 1000);

  render(true);
})();
