import React, {useMemo, useState, useEffect} from 'react';
import {
    initializeBlock,
    useBase,
    useRecords,
    useSession,
    CellRenderer,
    expandRecord,
} from '@airtable/blocks/interface/ui';
import type {Record as AtRecord, Table, Field} from '@airtable/blocks/interface/models';
import {
    CaretDownIcon,
    CheckIcon,
    CheckCircleIcon,
    WarningIcon,
    ReceiptIcon,
    SquaresFourIcon,
    ClipboardTextIcon,
    UsersIcon,
    CaretRightIcon,
    BackspaceIcon,
} from '@phosphor-icons/react';

const T = {
    jobs: 'tbl2OvJm0ux2VyZU2',
    staff: 'tblvVluTPMm0tPQ8J',
    biz: 'tblgHBJMrtZdUxUzN',
    time: 'tblPKOlSYxd3kc0wl',
    inv: 'tblEYrrsDiPaypE3l',
};
const F = {
    jobTitle: 'fldXz5FhJcGUKV6RQ',
    jobStatus: 'fldeoBEvdYtUvgb8q',
    jobAssigned: 'fldJ4DKeSTQlF6AJn',
    jobDate: 'fld2Vum12vSTXFg7S',
    jobDone: 'fldQVTWPCNXguWCui',
    jobPriority: 'fld9EaeRcV1sLaLsp',
    jobClientName: 'fldzAYfZodQ8JQAnY',
    jobAddress: 'fldcMoKMdB6uUenLa',
    jobBiz: 'fld5pga03JJva3QWr',
    jobNumber: 'fldL5Bk8ejWyGzzrz',
    jobCharge: 'fldp7hrt4XMFqpkPN',
    jobReadyCheck: 'fldToNbFMesHfKfZu',
    staffName: 'fldJFW2ceXO1Ic9Qr',
    staffEmail: 'fld7xpaXEfRIawome',
    staffRole: 'fld2UZ6Ngdbnfc9d7',
    staffActive: 'fldbnrpZqQ6PdkQpt',
    staffBiz: 'fld5DFKC8zRcOAI9s',
    bizName: 'fldUp6ORFThu87SPb',
    bizStatus: 'fld3aEx0pipFCR34R',
    timeDate: 'fldFb8kwBYuJPsIW4',
    timeStart: 'fldAC9xXpEV9v3e6B',
    timeEnd: 'fldcA1AlWstkVvESA',
    timeHours: 'fld8ckjTqoTucOwyK',
    timeStatus: 'fldOSvhgdXghJwNk7',
    timeStaff: 'fldpYYv7R4HnNmY7P',
    invName: 'fldtYEstFuMPGyaIr',
    invStatus: 'fld1BNwCDvDpiHvmE',
    invClient: 'fldp2f1YOAMjvxYEK',
    invAmount: 'fldHJyXNmP8B3Hx7c',
    invOwed: 'flddVZIGJ0dkQtwja',
    invDate: 'fld6edaArYV6x2Qpt',
    invDue: 'fldgHO5s463y9hlHv',
    invXero: 'flda8MkW9aYWfvo2l',
    invBiz: 'fldDzClz3TG5Ff2Em',
};

const AVATAR_COLORS = ['#0F6B47', '#6E4FB6', '#4F7CDB', '#C97A0C', '#2F3E46', '#993029'];
const ALL = 'all';

type Link = {id: string; name: string};
type Screen = 'overview' | 'allocate' | 'invoices' | 'team';

const pad = (n: number): string => String(n).padStart(2, '0');
const isoDay = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const money = (n: number, dec = false): string =>
    '$' + n.toLocaleString('en-NZ', {minimumFractionDigits: dec ? 2 : 0, maximumFractionDigits: dec ? 2 : 0});
const dur = (ms: number): string => {
    const m = Math.max(0, Math.floor(ms / 60000));
    return `${Math.floor(m / 60)}h ${pad(m % 60)}m`;
};
const initials = (name: string): string =>
    name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]!.toUpperCase())
        .join('') || '?';
const colorFor = (id: string): string => {
    let h = 0;
    for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return AVATAR_COLORS[h % AVATAR_COLORS.length]!;
};
const shortBiz = (name: string): string =>
    name.replace(/ & Drainage$/, '').replace(/ Property Maintenance( Ltd)?$/, '').replace(/ Ltd$/, '');
const niceDate = (d: string): string =>
    d ? new Date(d + 'T00:00').toLocaleDateString('en-NZ', {day: 'numeric', month: 'short'}) : '';

function fieldOf(table: Table | null, id: string): Field | null {
    return table ? table.getFieldIfExists(id) : null;
}
function cell(rec: AtRecord, table: Table | null, id: string): unknown {
    const f = fieldOf(table, id);
    return f ? rec.getCellValue(f) : null;
}
function text(rec: AtRecord, table: Table | null, id: string): string {
    const f = fieldOf(table, id);
    return f ? rec.getCellValueAsString(f) : '';
}
function num(rec: AtRecord, table: Table | null, id: string): number {
    return Number(cell(rec, table, id)) || 0;
}
function links(rec: AtRecord, table: Table | null, id: string): Link[] {
    const v = cell(rec, table, id);
    return Array.isArray(v) ? (v as Link[]) : [];
}
function selectName(rec: AtRecord, table: Table | null, id: string): string {
    const v = cell(rec, table, id) as {name?: string} | null;
    return v && v.name ? v.name : '';
}

const PIN_FIELD = 'fld8IvcPnVwArQNNE';
const LOCK_KEY = 'tradehouse-unlock';
const LOCK_HOURS = 12;

async function hashPin(recId: string, pin: string): Promise<string> {
    const data = new TextEncoder().encode(`tradehouse:${recId}:${pin}`);
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}
function readUnlock(): string | null {
    try {
        const v = JSON.parse(window.localStorage.getItem(LOCK_KEY) || 'null') as {id?: string; until?: number} | null;
        return v && v.id && v.until && v.until > Date.now() ? v.id : null;
    } catch {
        return null;
    }
}
function writeUnlock(id: string | null): void {
    try {
        if (id) window.localStorage.setItem(LOCK_KEY, JSON.stringify({id, until: Date.now() + LOCK_HOURS * 3600000}));
        else window.localStorage.removeItem(LOCK_KEY);
    } catch {
        return;
    }
}

function BrandMark(): React.ReactElement {
    return (
        <svg width="72" height="72" viewBox="0 0 120 120" aria-hidden="true">
            <rect width="120" height="120" rx="14" fill="#23292e" />
            <polyline points="26,70 60,42 94,70" fill="none" stroke="#f5f3ee" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="38" y1="88" x2="82" y2="88" stroke="#d8d3c8" strokeWidth="5" strokeLinecap="round" />
        </svg>
    );
}

function PinGate({
    people,
    staffT,
    loginEmail,
    onUnlock,
}: {
    people: AtRecord[];
    staffT: Table;
    loginEmail: string;
    onUnlock: (id: string) => void;
}): React.ReactElement {
    const [who, setWho] = useState<AtRecord | null>(null);
    const [pin, setPin] = useState('');
    const [firstTry, setFirstTry] = useState('');
    const [msg, setMsg] = useState('');
    const [busy, setBusy] = useState(false);
    const stored = who ? text(who, staffT, PIN_FIELD) : '';
    const creating = !!who && !stored;
    const isLogin = (r: AtRecord): number => (text(r, staffT, F.staffEmail).trim().toLowerCase() === loginEmail ? 1 : 0);
    const sorted = [...people].sort((a, b) => isLogin(b) - isLogin(a));
    const name = who ? text(who, staffT, F.staffName) : '';
    const firstName = name.split(' ')[0] || name;
    const back = (): void => {
        setWho(null);
        setPin('');
        setFirstTry('');
        setMsg('');
    };

    async function submit(full: string): Promise<void> {
        if (!who) return;
        setBusy(true);
        try {
            const h = await hashPin(who.id, full);
            if (!creating) {
                if (h === stored) {
                    writeUnlock(who.id);
                    onUnlock(who.id);
                } else {
                    setMsg('That PIN is not right. Try again.');
                    setPin('');
                }
            } else if (!firstTry) {
                setFirstTry(full);
                setPin('');
                setMsg('');
            } else if (full !== firstTry) {
                setMsg("Those two didn't match. Start again.");
                setFirstTry('');
                setPin('');
            } else if (!staffT.hasPermissionToUpdateRecords([who])) {
                setMsg("You can't save a PIN from this login. Ask the office.");
                setFirstTry('');
                setPin('');
            } else {
                await staffT.updateRecordAsync(who, {[PIN_FIELD]: h});
                writeUnlock(who.id);
                onUnlock(who.id);
            }
        } catch {
            setMsg('Could not check your PIN. Check your signal and try again.');
            setPin('');
        } finally {
            setBusy(false);
        }
    }
    const press = (k: string): void => {
        if (busy) return;
        if (k === 'del') {
            setPin(pin.slice(0, -1));
            return;
        }
        const next = pin + k;
        setPin(next);
        if (next.length < 4) {
            setMsg('');
            return;
        }
        void submit(next);
    };
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];
    const subtitle = creating
        ? firstTry
            ? 'Type the same PIN again to check'
            : 'First time here. Make up a 4-digit PIN'
        : 'Enter your 4-digit PIN';

    return (
        <div className="flex min-h-full flex-col items-stretch bg-[#F4F5F2] font-sans text-[#2A302D]">
            <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-6 pb-8 pt-6">
                <div className="mt-3 flex flex-col items-center gap-2.5">
                    <BrandMark />
                    <span className="text-2xl font-bold tracking-tight text-[#1A1F1D]">Tradehouse HQ</span>
                </div>
                {!who ? (
                    <>
                        <div className="flex flex-col gap-1">
                            <h1 className="text-[28px] font-bold leading-tight tracking-tight text-[#1A1F1D]">Who&apos;s signing in?</h1>
                            <p className="text-[15px] text-[#4B5550]">Tap your name.</p>
                        </div>
                        {sorted.length === 0 && (
                            <p className="text-[15px] text-[#4B5550]">
                                Nobody can sign in to this page yet. Check the Staff table has people ticked as Active.
                            </p>
                        )}
                        <ul className="flex flex-col gap-2.5">
                            {sorted.map((p) => {
                                const n = text(p, staffT, F.staffName);
                                return (
                                    <li key={p.id}>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setWho(p);
                                                setPin('');
                                                setFirstTry('');
                                                setMsg('');
                                            }}
                                            className="flex min-h-[68px] w-full items-center gap-3.5 rounded-2xl border border-[#E6E9E6] bg-white py-2.5 pl-3 pr-4 text-left shadow-sm hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F6B47]"
                                        >
                                            <Avatar name={n} id={p.id} size={44} />
                                            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                                <span className="truncate text-[17px] font-semibold">{n}</span>
                                                <span className="truncate text-sm text-[#4B5550]">{selectName(p, staffT, F.staffRole)}</span>
                                            </span>
                                            <CaretRightIcon size={18} className="flex-none text-[#7C857F]" />
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </>
                ) : (
                    <>
                        <div className="flex flex-col items-center gap-1.5 text-center">
                            <h1 className="text-[28px] font-bold leading-tight text-[#1A1F1D]">Hi {firstName}</h1>
                            <p className="text-[15px] text-[#4B5550]">{subtitle}</p>
                        </div>
                        <div className="flex justify-center gap-[18px]" aria-label={`${pin.length} of 4 digits entered`}>
                            {[0, 1, 2, 3].map((n) => (
                                <span
                                    key={n}
                                    className={`h-4 w-4 rounded-full border-2 border-[#0F6B47] ${n < pin.length ? 'bg-[#0F6B47]' : 'bg-transparent'}`}
                                />
                            ))}
                        </div>
                        {msg && (
                            <p role="alert" className="text-center text-[15px] font-medium text-[#993029]">
                                {msg}
                            </p>
                        )}
                        <div className="grid grid-cols-[repeat(3,72px)] justify-center gap-x-7 gap-y-3.5">
                            {keys.map((k, i) =>
                                k === '' ? (
                                    <span key={i} />
                                ) : (
                                    <button
                                        key={i}
                                        type="button"
                                        disabled={busy}
                                        aria-label={k === 'del' ? 'Delete' : k}
                                        onClick={() => press(k)}
                                        className="flex h-[72px] w-[72px] items-center justify-center rounded-full border border-[#E6E9E6] bg-white text-[26px] font-semibold text-[#2A302D] hover:bg-[#E3F0E8] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F6B47]"
                                    >
                                        {k === 'del' ? <BackspaceIcon size={24} /> : k}
                                    </button>
                                ),
                            )}
                        </div>
                        <button type="button" onClick={back} className="mx-auto min-h-[44px] px-4 text-[15px] font-semibold text-[#0F6B47]">
                            Not {firstName}?
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}

function Avatar({name, id, size = 40}: {name: string; id: string; size?: number}): React.ReactElement {
    return (
        <span
            aria-hidden="true"
            className="flex flex-none items-center justify-center rounded-full font-bold text-white"
            style={{width: size, height: size, background: colorFor(id), fontSize: Math.round(size / 3)}}
        >
            {initials(name)}
        </span>
    );
}

function OfficeApp(): React.ReactElement {
    const base = useBase();
    const session = useSession();
    const jobsT = base.getTableByIdIfExists(T.jobs);
    const staffT = base.getTableByIdIfExists(T.staff);
    const bizT = base.getTableByIdIfExists(T.biz);
    const timeT = base.getTableByIdIfExists(T.time);
    const invT = base.getTableByIdIfExists(T.inv);

    const jobs = useRecords(jobsT!);
    const staff = useRecords(staffT!);
    const businesses = useRecords(bizT!);
    const times = useRecords(timeT!);
    const invoices = useRecords(invT!);

    const [screen, setScreen] = useState<Screen>('overview');
    const [bizId, setBizId] = useState<string>(ALL);
    const [sheet, setSheet] = useState(false);
    const [filter, setFilter] = useState<'unassigned' | 'today' | 'active'>('unassigned');
    const [invTab, setInvTab] = useState<'ready' | 'unpaid' | 'overdue'>('overdue');
    const [toast, setToast] = useState('');
    const [busy, setBusy] = useState(false);
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        const iv = setInterval(() => setNow(Date.now()), 30000);
        return () => clearInterval(iv);
    }, []);
    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(''), 2800);
        return () => clearTimeout(t);
    }, [toast]);

    const email = (session.currentUser?.email || '').trim().toLowerCase();
    const [unlockedId, setUnlockedId] = useState<string | null>(() => readUnlock());
    const me = useMemo(() => staff.find((s) => s.id === unlockedId) || null, [staff, unlockedId]);
    const signOut = (): void => {
        writeUnlock(null);
        setUnlockedId(null);
        setSheet(false);
    };

    if (!jobsT || !staffT || !bizT || !timeT || !invT) {
        return (
            <div className="p-6 text-base">
                This page is missing one of its tables (Jobs, Staff, Businesses, Time entries or Invoices). Check the
                element&apos;s settings in the properties panel.
            </div>
        );
    }

    const isBoss = (r: AtRecord): boolean => /owner|admin/i.test(selectName(r, staffT, F.staffRole));
    if (!me || !isBoss(me)) {
        return (
            <PinGate
                people={staff.filter((s) => cell(s, staffT, F.staffActive) === true && isBoss(s))}
                staffT={staffT}
                loginEmail={email}
                onUnlock={(id) => setUnlockedId(id)}
            />
        );
    }

    const today = isoDay(new Date(now));
    const thisMonth = today.slice(0, 7);
    const bizList = businesses.map((b) => ({id: b.id, name: text(b, bizT, F.bizName)}));
    const biz = bizList.find((b) => b.id === bizId) || null;
    const inBiz = (rec: AtRecord, table: Table, fieldId: string): boolean =>
        bizId === ALL || links(rec, table, fieldId).some((l) => l.id === bizId);

    const field = staff
        .filter((s) => cell(s, staffT, F.staffActive) === true)
        .map((s) => ({id: s.id, name: text(s, staffT, F.staffName)}));
    const staffName = (id: string): string => field.find((s) => s.id === id)?.name || staff.find((s) => s.id === id)?.name || '';

    const coJobs = jobs.filter((j) => inBiz(j, jobsT, F.jobBiz));
    const coInv = invoices.filter((x) => inBiz(x, invT, F.invBiz));
    const st = (j: AtRecord): string => selectName(j, jobsT, F.jobStatus);
    const isOverdue = (x: AtRecord): boolean => {
        const s = selectName(x, invT, F.invStatus);
        const owed = num(x, invT, F.invOwed);
        const due = text(x, invT, F.invDue);
        return s === 'Overdue' || (owed > 0 && due !== '' && due < today && s !== 'Paid' && s !== 'Draft');
    };
    const unpaid = coInv.filter((x) => num(x, invT, F.invOwed) > 0 && !isOverdue(x));
    const overdue = coInv.filter(isOverdue);
    const readyJobs = coJobs.filter((j) => st(j) === 'Completed');
    const unassigned = coJobs.filter(
        (j) => ['New Lead', 'Scheduled'].includes(st(j)) && links(j, jobsT, F.jobAssigned).length === 0,
    );

    async function run(fn: () => Promise<void>, ok: string): Promise<void> {
        if (busy) return;
        setBusy(true);
        try {
            await fn();
            setToast(ok);
        } catch {
            setToast('That did not save. Check you have edit access and try again.');
        } finally {
            setBusy(false);
        }
    }

    const assign = (j: AtRecord, sid: string): void =>
        void run(
            () =>
                jobsT.updateRecordAsync(j, {
                    [F.jobAssigned]: [{id: sid}],
                    ...(st(j) === 'New Lead' ? {[F.jobStatus]: {name: 'Scheduled'}} : {}),
                }),
            `Job #${text(j, jobsT, F.jobNumber)} allocated to ${staffName(sid)}.`,
        );

    const openRec = (r: AtRecord, t: Table): void => {
        if (t.hasPermissionToExpandRecords()) expandRecord(r);
    };

    const h1 = 'text-[32px] font-bold leading-tight tracking-tight text-[#1A1F1D]';
    const h2 = 'text-[17px] font-semibold text-[#2A302D]';
    const chip = (on: boolean): string =>
        `flex-none min-h-[44px] rounded-full border px-4 text-sm font-semibold whitespace-nowrap ${on ? 'border-[#0F6B47] bg-[#0F6B47] text-white' : 'border-[#C9CFCB] bg-white text-[#2A302D]'}`;

    function Overview(): React.ReactElement {
        const invoicedMonth = coInv
            .filter((x) => text(x, invT!, F.invDate).startsWith(thisMonth))
            .reduce((a, x) => a + num(x, invT!, F.invAmount), 0);
        const owed = coInv.reduce((a, x) => a + num(x, invT!, F.invOwed), 0);
        const overdueSum = overdue.reduce((a, x) => a + num(x, invT!, F.invOwed), 0);
        const readySum = readyJobs.reduce((a, j) => a + num(j, jobsT!, F.jobCharge), 0);
        const todays = coJobs.filter((j) => text(j, jobsT!, F.jobDate) === today);
        const todayDone = todays.filter((j) => ['Completed', 'Invoiced', 'Paid'].includes(st(j))).length;
        const onClock = times.filter((t) => text(t, timeT!, F.timeStart) !== '' && text(t, timeT!, F.timeEnd) === '');
        const kpis = [
            {label: 'Invoiced this month', value: money(invoicedMonth), color: 'text-[#1A1F1D]', sub: ''},
            {label: 'Still owed', value: money(owed), color: 'text-[#1A1F1D]', sub: `${unpaid.length + overdue.length} invoices`},
            {label: 'Overdue', value: money(overdueSum), color: 'text-[#C2453B]', sub: overdue.length === 1 ? '1 invoice' : `${overdue.length} invoices`},
            {label: 'Ready to invoice', value: money(readySum), color: 'text-[#1F8A4C]', sub: readyJobs.length === 1 ? '1 completed job' : `${readyJobs.length} completed jobs`},
        ];
        return (
            <div className="flex flex-col gap-4 px-5 pb-6">
                <div className="flex flex-col gap-1">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#0F6B47]">
                        {new Date(now).toLocaleDateString('en-NZ', {month: 'long', year: 'numeric'})}
                    </span>
                    <h1 className={h1}>Overview</h1>
                </div>
                <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
                    {kpis.map((k) => (
                        <div key={k.label} className="flex flex-col gap-1 rounded-2xl border border-[#E6E9E6] bg-white p-3.5">
                            <span className="text-sm font-medium text-[#4B5550]">{k.label}</span>
                            <span className={`text-2xl font-bold tabular-nums ${k.color}`}>{k.value}</span>
                            {k.sub && <span className="text-sm text-[#4B5550]">{k.sub}</span>}
                        </div>
                    ))}
                </div>
                {overdue.length > 0 && (
                    <button
                        type="button"
                        onClick={() => {
                            setInvTab('overdue');
                            setScreen('invoices');
                        }}
                        className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-[#C9CFCB] bg-white text-[15px] font-semibold text-[#2A302D] hover:bg-[#E3F0E8]"
                    >
                        <ReceiptIcon size={18} />
                        See overdue invoices
                    </button>
                )}
                {unassigned.length > 0 && (
                    <div className="flex items-center gap-3 rounded-2xl bg-[#FBEFD9] p-4">
                        <WarningIcon size={20} weight="fill" className="flex-none text-[#9A5C06]" />
                        <span className="flex-1 text-[15px] font-semibold text-[#2A302D]">
                            {unassigned.length === 1 ? '1 job needs allocating' : `${unassigned.length} jobs need allocating`}
                        </span>
                        <button
                            type="button"
                            onClick={() => {
                                setFilter('unassigned');
                                setScreen('allocate');
                            }}
                            className="h-11 rounded-lg bg-[#2A302D] px-4 text-[15px] font-semibold text-white"
                        >
                            Allocate
                        </button>
                    </div>
                )}
                <section className="flex flex-col gap-2.5">
                    <h2 className={h2}>Today</h2>
                    <div className="grid grid-cols-2 gap-2.5 text-[15px] font-semibold">
                        <div className="rounded-2xl border border-[#E6E9E6] bg-white p-3.5">
                            {todayDone} of {todays.length} jobs done
                        </div>
                        <div className="rounded-2xl border border-[#E6E9E6] bg-white p-3.5">
                            {onClock.length} on the clock
                        </div>
                    </div>
                </section>
                <section className="flex flex-col gap-2.5">
                    <h2 className={h2}>Still owed by company</h2>
                    <ul className="divide-y divide-[#E6E9E6] overflow-hidden rounded-2xl border border-[#E6E9E6] bg-white">
                        {bizList.map((b) => {
                            const v = invoices
                                .filter((x) => links(x, invT!, F.invBiz).some((l) => l.id === b.id))
                                .reduce((a, x) => a + num(x, invT!, F.invOwed), 0);
                            return (
                                <li key={b.id}>
                                    <button
                                        type="button"
                                        onClick={() => setBizId(b.id)}
                                        className="flex min-h-[56px] w-full items-center gap-3 px-4 text-left hover:bg-[#F4F5F2]"
                                    >
                                        <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-[#2A302D]">{b.name}</span>
                                        <span className="text-base font-bold tabular-nums text-[#1A1F1D]">{money(v)}</span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </section>
            </div>
        );
    }

    function Allocate(): React.ReactElement {
        const lists = {
            unassigned,
            today: coJobs.filter((j) => text(j, jobsT!, F.jobDate) === today),
            active: coJobs.filter((j) => ['Scheduled', 'In Progress'].includes(st(j))),
        };
        const rows = lists[filter];
        return (
            <div className="flex flex-col gap-3.5 px-5 pb-6">
                <h1 className={h1}>Allocate</h1>
                <div className="-mx-5 flex gap-2 overflow-x-auto px-5">
                    {(
                        [
                            ['unassigned', 'Unassigned'],
                            ['today', 'Today'],
                            ['active', 'Scheduled and in progress'],
                        ] as const
                    ).map(([k, l]) => (
                        <button key={k} type="button" aria-pressed={filter === k} className={chip(filter === k)} onClick={() => setFilter(k)}>
                            {l} {lists[k].length}
                        </button>
                    ))}
                </div>
                {rows.length === 0 && (
                    <p className="py-8 text-center text-[15px] text-[#4B5550]">
                        {filter === 'unassigned' ? 'Every job is allocated.' : 'No jobs here.'}
                    </p>
                )}
                <ul className="flex flex-col gap-3">
                    {rows.map((j) => {
                        const who = links(j, jobsT!, F.jobAssigned)[0];
                        const statusF = fieldOf(jobsT, F.jobStatus);
                        return (
                            <li key={j.id} className="flex flex-col gap-2.5 rounded-2xl border border-[#E6E9E6] bg-white px-4 py-3.5">
                                <button type="button" onClick={() => openRec(j, jobsT!)} className="flex flex-col gap-1.5 text-left">
                                    <span className="flex w-full items-center justify-between gap-2">
                                        <span className="text-sm font-semibold tabular-nums text-[#4B5550]">
                                            #{text(j, jobsT!, F.jobNumber)}
                                            {text(j, jobsT!, F.jobDate) ? ` · ${niceDate(text(j, jobsT!, F.jobDate))}` : ' · No date'}
                                        </span>
                                        {statusF && <CellRenderer record={j} field={statusF} />}
                                    </span>
                                    <span className="text-[17px] font-semibold leading-snug text-[#2A302D]">
                                        {text(j, jobsT!, F.jobTitle) || 'Untitled job'}
                                    </span>
                                    <span className="truncate text-sm text-[#4B5550]">
                                        {[text(j, jobsT!, F.jobAddress), text(j, jobsT!, F.jobClientName)].filter(Boolean).join(' · ')}
                                    </span>
                                </button>
                                {who ? (
                                    <span className="flex items-center gap-2 text-sm font-medium text-[#4B5550]">
                                        <Avatar name={who.name} id={who.id} size={24} />
                                        {who.name}
                                    </span>
                                ) : (
                                    <div className="flex flex-wrap items-center gap-2 border-t border-[#E6E9E6] pt-2.5">
                                        <span className="mr-auto text-sm font-semibold text-[#9A5C06]">Allocate to</span>
                                        {field.map((s) => (
                                            <button
                                                key={s.id}
                                                type="button"
                                                disabled={busy}
                                                onClick={() => assign(j, s.id)}
                                                className="flex min-h-[44px] items-center gap-1.5 rounded-full border border-[#C9CFCB] bg-white py-1 pl-1.5 pr-3 text-sm font-semibold text-[#2A302D] hover:border-[#0F6B47] hover:bg-[#E3F0E8] disabled:opacity-60"
                                            >
                                                <Avatar name={s.name} id={s.id} size={28} />
                                                {s.name.split(' ')[0]}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            </div>
        );
    }

    function Invoices(): React.ReactElement {
        const tabs = [
            ['overdue', 'Overdue', overdue.length],
            ['unpaid', 'Sent, not paid', unpaid.length],
            ['ready', 'Ready', readyJobs.length],
        ] as const;
        const statusF = fieldOf(invT, F.invStatus);
        return (
            <div className="flex flex-col gap-3.5 px-5 pb-6">
                <h1 className={h1}>Invoices</h1>
                <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-[#ECEFEB] p-1" role="tablist">
                    {tabs.map(([k, l, n]) => (
                        <button
                            key={k}
                            type="button"
                            role="tab"
                            aria-selected={invTab === k}
                            onClick={() => setInvTab(k)}
                            className={`min-h-[44px] rounded-lg px-1 text-sm font-semibold ${invTab === k ? 'bg-[#0F6B47] text-white' : 'text-[#4B5550]'}`}
                        >
                            {l} {n}
                        </button>
                    ))}
                </div>
                {invTab === 'ready' ? (
                    readyJobs.length === 0 ? (
                        <p className="py-8 text-center text-[15px] text-[#4B5550]">No completed jobs waiting for an invoice.</p>
                    ) : (
                        <ul className="flex flex-col gap-3">
                            {readyJobs.map((j) => (
                                <li key={j.id}>
                                    <button
                                        type="button"
                                        onClick={() => openRec(j, jobsT!)}
                                        className="flex w-full flex-col gap-1.5 rounded-2xl border border-[#E6E9E6] bg-white px-4 py-3.5 text-left"
                                    >
                                        <span className="flex w-full items-baseline justify-between gap-2">
                                            <span className="text-sm font-semibold tabular-nums text-[#4B5550]">#{text(j, jobsT!, F.jobNumber)}</span>
                                            <span className="text-lg font-bold tabular-nums">{money(num(j, jobsT!, F.jobCharge), true)}</span>
                                        </span>
                                        <span className="text-base font-semibold text-[#2A302D]">{text(j, jobsT!, F.jobClientName) || 'No client'}</span>
                                        <span className="text-sm text-[#4B5550]">{text(j, jobsT!, F.jobTitle)}</span>
                                        {text(j, jobsT!, F.jobReadyCheck) && (
                                            <span className="text-sm font-medium text-[#9A5C06]">{text(j, jobsT!, F.jobReadyCheck)}</span>
                                        )}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )
                ) : (invTab === 'overdue' ? overdue : unpaid).length === 0 ? (
                    <p className="py-8 text-center text-[15px] text-[#4B5550]">All clear.</p>
                ) : (
                    <ul className="flex flex-col gap-3">
                        {(invTab === 'overdue' ? overdue : unpaid).map((x) => {
                            const due = text(x, invT!, F.invDue);
                            const days = due ? Math.floor((new Date(today).getTime() - new Date(due).getTime()) / 86400000) : 0;
                            return (
                                <li key={x.id}>
                                    <button
                                        type="button"
                                        onClick={() => openRec(x, invT!)}
                                        className="flex w-full flex-col gap-1.5 rounded-2xl border border-[#E6E9E6] bg-white px-4 py-3.5 text-left"
                                    >
                                        <span className="flex w-full items-baseline justify-between gap-2">
                                            <span className="min-w-0 truncate text-sm font-semibold text-[#4B5550]">
                                                {text(x, invT!, F.invXero) || text(x, invT!, F.invName)}
                                            </span>
                                            <span className="flex-none text-lg font-bold tabular-nums">{money(num(x, invT!, F.invOwed), true)}</span>
                                        </span>
                                        <span className="text-base font-semibold text-[#2A302D]">{text(x, invT!, F.invClient) || 'No client'}</span>
                                        <span className="flex items-center gap-2">
                                            {statusF && <CellRenderer record={x} field={statusF} />}
                                            <span className={`text-sm font-medium ${invTab === 'overdue' ? 'text-[#C2453B]' : 'text-[#4B5550]'}`}>
                                                {due ? (invTab === 'overdue' && days > 0 ? `${days} days overdue · was due ${niceDate(due)}` : `Due ${niceDate(due)}`) : 'No due date'}
                                            </span>
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
                <p className="text-sm text-[#4B5550]">Amounts are what is still owed, from the daily Xero sync. Tap one to open it.</p>
            </div>
        );
    }

    function Team(): React.ReactElement {
        const pending = times.filter((t) => selectName(t, timeT!, F.timeStatus) === 'Todo' && text(t, timeT!, F.timeEnd) !== '');
        const byStaff = field.map((s) => {
            const mine = times.filter((t) => links(t, timeT!, F.timeStaff).some((l) => l.id === s.id));
            const open = mine.find((t) => text(t, timeT!, F.timeStart) !== '' && text(t, timeT!, F.timeEnd) === '');
            const openMs = open ? now - new Date(cell(open, timeT!, F.timeStart) as string).getTime() : 0;
            const myPending = pending.filter((t) => links(t, timeT!, F.timeStaff).some((l) => l.id === s.id));
            const pendingHours = myPending.reduce((a, t) => a + num(t, timeT!, F.timeHours), 0);
            const current = jobs.find(
                (j) => st(j) === 'In Progress' && links(j, jobsT!, F.jobAssigned).some((l) => l.id === s.id),
            );
            return {s, open, openMs, myPending, pendingHours, current};
        });
        const approve = (recs: AtRecord[], who: string): void =>
            void run(async () => {
                for (let i = 0; i < recs.length; i += 50) {
                    await timeT!.updateRecordsAsync(
                        recs.slice(i, i + 50).map((r) => ({id: r.id, fields: {[F.timeStatus]: {name: 'Done'}}})),
                    );
                }
            }, `${who} approved.`);
        return (
            <div className="flex flex-col gap-4 px-5 pb-6">
                <h1 className={h1}>Team</h1>
                <ul className="divide-y divide-[#E6E9E6] overflow-hidden rounded-2xl border border-[#E6E9E6] bg-white">
                    {byStaff.map(({s, open, openMs, current}) => (
                        <li key={s.id} className="flex min-h-[68px] items-center gap-3 px-4 py-2">
                            <Avatar name={s.name} id={s.id} />
                            <span className="flex min-w-0 flex-1 flex-col">
                                <span className="text-base font-semibold text-[#2A302D]">{s.name}</span>
                                <span className="truncate text-sm text-[#4B5550]">
                                    {current ? text(current, jobsT!, F.jobTitle) : 'No job in progress'}
                                </span>
                            </span>
                            <span
                                className={`flex-none rounded-full px-2.5 py-1 text-sm font-semibold tabular-nums ${open ? 'bg-[#E3F0E8] text-[#0F6B47]' : 'bg-[#ECEFEB] text-[#4B5550]'}`}
                            >
                                {open ? `On · ${dur(openMs)}` : 'Off'}
                            </span>
                        </li>
                    ))}
                </ul>
                <div className="flex items-baseline justify-between">
                    <h2 className={h2}>Timesheets to approve</h2>
                    <span className="text-sm text-[#4B5550]">Last 14 days</span>
                </div>
                <ul className="divide-y divide-[#E6E9E6] overflow-hidden rounded-2xl border border-[#E6E9E6] bg-white">
                    {byStaff.map(({s, myPending, pendingHours}) => (
                        <li key={s.id} className="flex min-h-[60px] items-center gap-3 py-2 pl-4 pr-3">
                            <span className="flex-1 text-[15px] font-semibold text-[#2A302D]">{s.name}</span>
                            <span className="text-base font-bold tabular-nums">{Math.round(pendingHours * 10) / 10} h</span>
                            {myPending.length > 0 ? (
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => approve(myPending, `${s.name.split(' ')[0]}'s timesheet`)}
                                    className="h-11 rounded-lg border border-[#0F6B47] bg-white px-3.5 text-sm font-semibold text-[#0F6B47] hover:bg-[#E3F0E8] disabled:opacity-60"
                                >
                                    Approve
                                </button>
                            ) : (
                                <span className="flex h-11 items-center gap-1 px-2.5 text-sm font-semibold text-[#1F8A4C]">
                                    <CheckIcon size={16} weight="bold" />
                                    Up to date
                                </span>
                            )}
                        </li>
                    ))}
                </ul>
                {pending.length > 0 && (
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => approve(pending, 'All timesheets')}
                        className="h-[52px] rounded-xl bg-[#0F6B47] text-base font-semibold text-white hover:bg-[#0A4F34] disabled:opacity-60"
                    >
                        Approve all
                    </button>
                )}
            </div>
        );
    }

    const tabs: Array<[Screen, string, React.ReactElement]> = [
        ['overview', 'Overview', <SquaresFourIcon key="o" size={22} />],
        ['allocate', 'Jobs', <ClipboardTextIcon key="j" size={22} />],
        ['invoices', 'Invoices', <ReceiptIcon key="i" size={22} />],
        ['team', 'Team', <UsersIcon key="t" size={22} />],
    ];

    return (
        <div className="relative flex h-full min-h-full flex-col bg-[#F4F5F2] font-sans text-[#2A302D]">
            <main className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto pb-24" tabIndex={0}>
                <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-4">
                    <button
                        type="button"
                        onClick={() => setSheet(true)}
                        aria-label={`Showing ${biz ? biz.name : 'all companies'}. Switch company`}
                        className="flex min-h-[44px] min-w-0 max-w-[300px] items-center gap-2 rounded-full border border-[#C9CFCB] bg-white px-3 text-[15px] font-semibold text-[#2A302D] hover:bg-[#E3F0E8]"
                    >
                        <span className="truncate">{biz ? shortBiz(biz.name) : 'All companies'}</span>
                        <CaretDownIcon size={16} className="flex-none text-[#7C857F]" />
                    </button>
                    <span title={text(me, staffT, F.staffName)}>
                        <Avatar name={text(me, staffT, F.staffName)} id={me.id} size={44} />
                    </span>
                </div>
                {screen === 'overview' && Overview()}
                {screen === 'allocate' && Allocate()}
                {screen === 'invoices' && Invoices()}
                {screen === 'team' && Team()}
            </main>
            <nav
                aria-label="Office app"
                className="fixed bottom-0 left-0 right-0 z-20 flex justify-around border-t border-[#E6E9E6] bg-white/90 px-2 pb-5 pt-1.5 backdrop-blur"
            >
                {tabs.map(([k, label, icon]) => (
                    <button
                        key={k}
                        type="button"
                        aria-current={screen === k ? 'page' : undefined}
                        onClick={() => setScreen(k)}
                        className={`flex min-h-[52px] max-w-[160px] flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${screen === k ? 'text-[#0F6B47]' : 'text-[#4B5550]'}`}
                    >
                        {icon}
                        {label}
                    </button>
                ))}
            </nav>
            {sheet && (
                <div className="fixed inset-0 z-40 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Switch company">
                    <button type="button" aria-label="Close" className="absolute inset-0 bg-[#1A1F1D]/40" onClick={() => setSheet(false)} />
                    <div className="relative mx-auto flex w-full max-w-xl flex-col gap-3.5 rounded-t-[20px] bg-white px-5 pb-9 pt-2.5 shadow-lg">
                        <span aria-hidden="true" className="mx-auto h-1.5 w-10 rounded-full bg-[#C9CFCB]" />
                        <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#0F6B47]">Showing</span>
                        {[{id: ALL, name: 'All companies'}, ...bizList].map((b) => {
                            const sel = b.id === bizId;
                            return (
                                <button
                                    key={b.id}
                                    type="button"
                                    aria-current={sel ? 'true' : undefined}
                                    onClick={() => {
                                        setBizId(b.id);
                                        setSheet(false);
                                    }}
                                    className={`flex min-h-[56px] items-center gap-3 rounded-2xl border px-3.5 text-left ${sel ? 'border-[#0F6B47] bg-[#E3F0E8]' : 'border-[#E6E9E6] bg-white'}`}
                                >
                                    <span className="min-w-0 flex-1 truncate text-base font-semibold">{b.name}</span>
                                    {sel && <CheckIcon size={20} weight="bold" className="text-[#0F6B47]" />}
                                </button>
                            );
                        })}
                        <div className="flex items-center gap-3 border-t border-[#E6E9E6] pt-3.5">
                            <Avatar name={text(me, staffT, F.staffName)} id={me.id} />
                            <span className="min-w-0 flex-1 truncate text-base font-semibold">{text(me, staffT, F.staffName)}</span>
                            <button
                                type="button"
                                onClick={signOut}
                                className="h-11 flex-none rounded-lg border border-[#C9CFCB] bg-white px-4 text-[15px] font-semibold text-[#2A302D] hover:bg-[#ECEFEB]"
                            >
                                Sign out
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {toast && (
                <div
                    role="status"
                    className="fixed bottom-24 left-4 right-4 z-30 flex items-start gap-2 rounded-xl bg-[#1A1F1D] px-4 py-3 text-base text-white shadow-lg sm:left-auto sm:right-6 sm:max-w-sm"
                >
                    <CheckCircleIcon size={20} weight="fill" className="mt-0.5 flex-none text-[#6CC270]" />
                    <span>{toast}</span>
                </div>
            )}
        </div>
    );
}

initializeBlock({interface: () => <OfficeApp />});
