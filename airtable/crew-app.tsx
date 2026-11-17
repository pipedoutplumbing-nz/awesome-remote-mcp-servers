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
    CaretLeftIcon,
    CaretRightIcon,
    CheckIcon,
    CheckCircleIcon,
    MapPinIcon,
    NavigationArrowIcon,
    PhoneIcon,
    PlayIcon,
    CameraIcon,
    ListChecksIcon,
    TimerIcon,
    PlusCircleIcon,
} from '@phosphor-icons/react';

const T = {
    jobs: 'tbl2OvJm0ux2VyZU2',
    staff: 'tblvVluTPMm0tPQ8J',
    biz: 'tblgHBJMrtZdUxUzN',
    time: 'tblPKOlSYxd3kc0wl',
    clients: 'tblwUCsmva3wXsIdd',
};
const F = {
    jobTitle: 'fldXz5FhJcGUKV6RQ',
    jobStatus: 'fldeoBEvdYtUvgb8q',
    jobAssigned: 'fldJ4DKeSTQlF6AJn',
    jobDate: 'fld2Vum12vSTXFg7S',
    jobDone: 'fldQVTWPCNXguWCui',
    jobPriority: 'fld9EaeRcV1sLaLsp',
    jobNotes: 'fldsZIMzAqd48vOFe',
    jobClient: 'fldm0JA9tiuWPEMsJ',
    jobClientName: 'fldzAYfZodQ8JQAnY',
    jobAddress: 'fldcMoKMdB6uUenLa',
    jobBiz: 'fld5pga03JJva3QWr',
    jobNumber: 'fldL5Bk8ejWyGzzrz',
    jobRunOrder: 'fldBJVCEeZFTyMKmv',
    jobSummary: 'fld8JWDTaUqOPze34',
    jobBefore: 'fldM2MCQx8H4mdsoN',
    jobAfter: 'fld9ZfiZ6HjXeZtiB',
    jobSiteName: 'fldCRK2oThrGAveT3',
    staffName: 'fldJFW2ceXO1Ic9Qr',
    staffEmail: 'fld7xpaXEfRIawome',
    staffRole: 'fld2UZ6Ngdbnfc9d7',
    staffActive: 'fldbnrpZqQ6PdkQpt',
    staffBiz: 'fld5DFKC8zRcOAI9s',
    bizName: 'fldUp6ORFThu87SPb',
    bizStatus: 'fld3aEx0pipFCR34R',
    clientName: 'fldrpy6oat4suvTED',
    clientContact: 'fldCF8BBx3BSBDoLT',
    clientPhone: 'fldzsRc97xUHYsSYp',
    timeName: 'fldwJ1w5UtnZ7U6zl',
    timeDate: 'fldFb8kwBYuJPsIW4',
    timeStart: 'fldAC9xXpEV9v3e6B',
    timeEnd: 'fldcA1AlWstkVvESA',
    timeHours: 'fld8ckjTqoTucOwyK',
    timeStatus: 'fldOSvhgdXghJwNk7',
    timeStaff: 'fldpYYv7R4HnNmY7P',
    timeJobs: 'fldTVzf6kUn2XTT6L',
    timeNotes: 'fldu0uyET3wUt6s8W',
};

const AVATAR_COLORS = ['#0F6B47', '#6E4FB6', '#4F7CDB', '#C97A0C', '#2F3E46', '#993029'];

type Link = {id: string; name: string};
type Screen = 'today' | 'job' | 'clock' | 'intake';

const pad = (n: number): string => String(n).padStart(2, '0');
const isoDay = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hm = (d: Date): string => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const dur = (ms: number): string => {
    const m = Math.max(0, Math.floor(ms / 60000));
    return `${Math.floor(m / 60)}h ${pad(m % 60)}m`;
};
const clockTxt = (ms: number): string => {
    const s = Math.max(0, Math.floor(ms / 1000));
    return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
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
const mapUrl = (addr: string): string =>
    'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(addr + ', New Zealand');

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
function links(rec: AtRecord, table: Table | null, id: string): Link[] {
    const v = cell(rec, table, id);
    return Array.isArray(v) ? (v as Link[]) : [];
}
function selectName(rec: AtRecord, table: Table | null, id: string): string {
    const v = cell(rec, table, id) as {name?: string} | null;
    return v && v.name ? v.name : '';
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

function Toast({message}: {message: string}): React.ReactElement | null {
    if (!message) return null;
    return (
        <div
            role="status"
            className="fixed bottom-24 left-4 right-4 z-30 flex items-start gap-2 rounded-xl bg-[#1A1F1D] px-4 py-3 text-base text-white shadow-lg sm:left-auto sm:right-6 sm:max-w-sm"
        >
            <CheckCircleIcon size={20} weight="fill" className="mt-0.5 flex-none text-[#6CC270]" />
            <span>{message}</span>
        </div>
    );
}

function CrewApp(): React.ReactElement {
    const base = useBase();
    const session = useSession();
    const jobsT = base.getTableByIdIfExists(T.jobs);
    const staffT = base.getTableByIdIfExists(T.staff);
    const bizT = base.getTableByIdIfExists(T.biz);
    const timeT = base.getTableByIdIfExists(T.time);
    const clientsT = base.getTableByIdIfExists(T.clients);

    const jobs = useRecords(jobsT!);
    const staff = useRecords(staffT!);
    const businesses = useRecords(bizT!);
    const times = useRecords(timeT!);
    const clients = useRecords(clientsT!);

    const [screen, setScreen] = useState<Screen>('today');
    const [jobId, setJobId] = useState<string | null>(null);
    const [bizId, setBizId] = useState<string | null>(null);
    const [sheet, setSheet] = useState(false);
    const [toast, setToast] = useState('');
    const [busy, setBusy] = useState(false);
    const [noteDraft, setNoteDraft] = useState('');
    const [now, setNow] = useState(Date.now());
    const [intake, setIntake] = useState({title: '', customer: '', phone: '', address: '', urgent: false});
    const [intakeErr, setIntakeErr] = useState('');

    useEffect(() => {
        const iv = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(iv);
    }, []);
    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(''), 2800);
        return () => clearTimeout(t);
    }, [toast]);

    const email = (session.currentUser?.email || '').trim().toLowerCase();
    const me = useMemo(
        () => staff.find((s) => text(s, staffT, F.staffEmail).trim().toLowerCase() === email) || null,
        [staff, staffT, email],
    );
    const meName = me ? text(me, staffT, F.staffName) : '';
    const firstName = meName.split(' ')[0] || meName;

    const myBizLinks = me ? links(me, staffT, F.staffBiz) : [];
    const bizList = businesses
        .filter((b) => myBizLinks.some((l) => l.id === b.id))
        .map((b) => ({id: b.id, name: text(b, bizT, F.bizName), status: selectName(b, bizT, F.bizStatus)}));
    const storeKey = me ? `tradehouse-co-${me.id}` : '';
    useEffect(() => {
        if (!me || bizId) return;
        let saved: string | null = null;
        try {
            saved = window.localStorage.getItem(storeKey);
        } catch {
            saved = null;
        }
        const pick = bizList.find((b) => b.id === saved) || bizList[0];
        if (pick) setBizId(pick.id);
    }, [me, bizId, storeKey, bizList]);
    const biz = bizList.find((b) => b.id === bizId) || null;

    const today = isoDay(new Date(now));
    const inBiz = (j: AtRecord): boolean => !biz || links(j, jobsT, F.jobBiz).some((l) => l.id === biz.id);
    const mine = jobs.filter((j) => me && links(j, jobsT, F.jobAssigned).some((l) => l.id === me.id) && inBiz(j));
    const isDone = (j: AtRecord): boolean => ['Completed', 'Invoiced', 'Paid'].includes(selectName(j, jobsT, F.jobStatus));
    const todayJobs = mine.filter((j) => {
        const d = text(j, jobsT, F.jobDate);
        const st = selectName(j, jobsT, F.jobStatus);
        if (d === today) return true;
        if (st === 'In Progress') return true;
        if (st === 'Completed') return text(j, jobsT, F.jobDone) === today;
        return st === 'Scheduled' && d !== '' && d < today;
    });
    const upcoming = mine.filter((j) => {
        const d = text(j, jobsT, F.jobDate);
        const st = selectName(j, jobsT, F.jobStatus);
        return st === 'Scheduled' && (d === '' || d > today);
    });

    const myTimes = times.filter((t) => me && links(t, timeT, F.timeStaff).some((l) => l.id === me.id));
    const openEntry = myTimes.find((t) => text(t, timeT, F.timeStart) !== '' && text(t, timeT, F.timeEnd) === '') || null;
    const openStart = openEntry ? new Date(cell(openEntry, timeT, F.timeStart) as string).getTime() : 0;
    const todayEntries = myTimes.filter((t) => text(t, timeT, F.timeDate) === today);
    const weekAgo = isoDay(new Date(now - 6 * 86400000));
    const weekHours = myTimes
        .filter((t) => {
            const d = text(t, timeT, F.timeDate);
            return d >= weekAgo && d <= today;
        })
        .reduce((a, t) => a + (Number(cell(t, timeT, F.timeHours)) || 0), 0);

    async function run(fn: () => Promise<void>, ok: string): Promise<void> {
        if (busy) return;
        setBusy(true);
        try {
            await fn();
            setToast(ok);
        } catch {
            setToast('That did not save. Check your signal and try again.');
        } finally {
            setBusy(false);
        }
    }

    function clockOn(note: string): Promise<void> {
        if (!timeT || !me) return Promise.resolve();
        const start = new Date();
        return timeT
            .createRecordAsync({
                [F.timeName]: `${meName} ${isoDay(start)}`,
                [F.timeDate]: isoDay(start),
                [F.timeStart]: start.toISOString(),
                [F.timeStaff]: [{id: me.id}],
                [F.timeStatus]: {name: 'In progress'},
                [F.timeNotes]: note,
            })
            .then(() => undefined);
    }
    function toggleClock(): void {
        if (!timeT || !me) return;
        if (openEntry) {
            void run(
                () =>
                    timeT.updateRecordAsync(openEntry, {
                        [F.timeEnd]: new Date().toISOString(),
                        [F.timeStatus]: {name: 'Todo'},
                    }),
                `Clocked off. ${dur(now - openStart)} logged.`,
            );
        } else {
            void run(() => clockOn(`Working for ${biz ? biz.name : ''}`), `Clocked on${biz ? ` for ${shortBiz(biz.name)}` : ''}.`);
        }
    }

    if (!jobsT || !staffT || !bizT || !timeT || !clientsT) {
        return (
            <div className="p-6 text-base">
                This page is missing one of its tables (Jobs, Staff, Businesses, Time entries or Clients). Check the
                element&apos;s settings in the properties panel.
            </div>
        );
    }

    if (!me) {
        return (
            <div className="flex min-h-full flex-col items-center justify-center gap-3 bg-[#F4F5F2] p-8 text-center">
                <h1 className="text-xl font-bold text-[#1A1F1D]">We don&apos;t know who you are yet</h1>
                <p className="max-w-prose text-base text-[#4B5550]">
                    You&apos;re signed in to Airtable as <strong>{email || 'an unknown user'}</strong>, but no one in the
                    Staff table has that email. Ask the office to put this exact email in your row of the Staff table.
                </p>
            </div>
        );
    }

    const job = jobId ? jobs.find((j) => j.id === jobId) || null : null;

    const topBar = (
        <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-4">
            <button
                type="button"
                onClick={() => setSheet(true)}
                className="flex min-h-[44px] min-w-0 max-w-[280px] items-center gap-2 rounded-full border border-[#C9CFCB] bg-white py-1 pl-3 pr-3 text-[15px] font-semibold text-[#2A302D] hover:bg-[#E3F0E8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F6B47]"
                aria-label={`Working for ${biz ? biz.name : 'no company'}. Switch company`}
            >
                <span className="truncate">{biz ? shortBiz(biz.name) : 'Pick a company'}</span>
                <CaretDownIcon size={16} className="flex-none text-[#7C857F]" />
            </button>
            <span title={meName}>
                <Avatar name={meName} id={me.id} size={44} />
            </span>
        </div>
    );

    const tabs: Array<[Screen, string, React.ReactElement]> = [
        ['today', 'Today', <ListChecksIcon key="t" size={22} />],
        ['clock', 'Clock', <TimerIcon key="c" size={22} />],
        ['intake', 'New job', <PlusCircleIcon key="n" size={22} />],
    ];

    const statusPill = (j: AtRecord): React.ReactElement | null => {
        const f = fieldOf(jobsT, F.jobStatus);
        return f ? <CellRenderer record={j} field={f} /> : null;
    };
    const urgentTag = (j: AtRecord): React.ReactElement | null => {
        const p = selectName(j, jobsT, F.jobPriority);
        return p === 'Urgent' || p === 'Emergency' ? (
            <span className="rounded-full bg-[#FBE6E4] px-2 py-0.5 text-xs font-semibold text-[#993029]">{p}</span>
        ) : null;
    };

    function JobCard({j}: {j: AtRecord}): React.ReactElement {
        const d = text(j, jobsT, F.jobDate);
        return (
            <li>
                <button
                    type="button"
                    onClick={() => {
                        setJobId(j.id);
                        setNoteDraft('');
                        setScreen('job');
                    }}
                    className={`flex w-full flex-col gap-2 rounded-2xl border border-[#E6E9E6] bg-white p-4 text-left shadow-sm hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F6B47] ${isDone(j) ? 'opacity-70' : ''}`}
                >
                    <span className="flex w-full items-center justify-between gap-2">
                        <span className="text-sm font-semibold tabular-nums text-[#4B5550]">
                            #{text(j, jobsT, F.jobNumber)}
                            {d && d !== today ? ` · ${new Date(d + 'T00:00').toLocaleDateString('en-NZ', {weekday: 'short', day: 'numeric', month: 'short'})}` : ''}
                        </span>
                        <span className="min-w-0">{statusPill(j)}</span>
                    </span>
                    <span className="text-lg font-semibold leading-snug text-[#2A302D]">
                        {text(j, jobsT, F.jobTitle) || 'Untitled job'}
                    </span>
                    {text(j, jobsT, F.jobAddress) && (
                        <span className="flex items-center gap-1.5 text-[15px] text-[#4B5550]">
                            <MapPinIcon size={16} className="flex-none" />
                            <span className="min-w-0 truncate">{text(j, jobsT, F.jobAddress)}</span>
                        </span>
                    )}
                    <span className="flex w-full items-center gap-2 text-sm text-[#4B5550]">
                        <span className="min-w-0 flex-1 truncate">{text(j, jobsT, F.jobClientName)}</span>
                        {urgentTag(j)}
                    </span>
                </button>
            </li>
        );
    }

    function TodayScreen(): React.ReactElement {
        const doneN = todayJobs.filter(isDone).length;
        return (
            <div className="flex flex-col gap-4 px-5 pb-6">
                <div className="flex flex-col gap-1">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#0F6B47]">
                        {new Date(now).toLocaleDateString('en-NZ', {weekday: 'long', day: 'numeric', month: 'long'})}
                    </span>
                    <h1 className="text-[32px] font-bold leading-tight tracking-tight text-[#1A1F1D]">My jobs</h1>
                </div>
                <button
                    type="button"
                    onClick={() => setScreen('clock')}
                    className={`flex min-h-[48px] items-center gap-2.5 rounded-xl border px-3.5 text-left text-[15px] font-semibold ${openEntry ? 'border-[#C9E4DA] bg-[#E3F0E8] text-[#0F6B47]' : 'border-[#C9CFCB] bg-white text-[#4B5550]'}`}
                >
                    <span className="h-2 w-2 flex-none rounded-full bg-current" />
                    <span className="flex-1">{openEntry ? `On the clock · ${dur(now - openStart)}` : 'Off the clock. Tap to clock on.'}</span>
                    <CaretRightIcon size={18} />
                </button>
                {todayJobs.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                        <span className="text-lg font-semibold text-[#2A302D]">No jobs for you today</span>
                        <span className="text-[15px] text-[#4B5550]">
                            Nothing allocated to you{biz ? ` for ${shortBiz(biz.name)}` : ''} today. Check the other company with the
                            switcher above.
                        </span>
                    </div>
                ) : (
                    <>
                        <div className="flex items-baseline justify-between">
                            <h2 className="text-[17px] font-semibold text-[#2A302D]">Run sheet</h2>
                            <span className="text-sm text-[#4B5550]">
                                {doneN} of {todayJobs.length} done
                            </span>
                        </div>
                        <ul className="flex flex-col gap-3">
                            {todayJobs.map((j) => (
                                <React.Fragment key={j.id}>{JobCard({j})}</React.Fragment>
                            ))}
                        </ul>
                    </>
                )}
                {upcoming.length > 0 && (
                    <>
                        <h2 className="mt-4 text-[17px] font-semibold text-[#2A302D]">Coming up</h2>
                        <ul className="flex flex-col gap-3">
                            {upcoming.map((j) => (
                                <React.Fragment key={j.id}>{JobCard({j})}</React.Fragment>
                            ))}
                        </ul>
                    </>
                )}
            </div>
        );
    }

    function JobScreen(): React.ReactElement {
        if (!job || !jobsT) {
            return (
                <div className="p-6 text-base">
                    This job is no longer on your list.{' '}
                    <button type="button" className="font-semibold text-[#0F6B47] underline" onClick={() => setScreen('today')}>
                        Back to today
                    </button>
                </div>
            );
        }
        const st = selectName(job, jobsT, F.jobStatus);
        const addr = text(job, jobsT, F.jobAddress);
        const clientLink = links(job, jobsT, F.jobClient)[0];
        const client = clientLink ? clients.find((c) => c.id === clientLink.id) : undefined;
        const contact = client ? text(client, clientsT, F.clientContact) || text(client, clientsT, F.clientName) : '';
        const phone = client ? text(client, clientsT, F.clientPhone) : '';
        const notes = text(job, jobsT, F.jobNotes);
        const summary = text(job, jobsT, F.jobSummary);
        const before = (cell(job, jobsT, F.jobBefore) as unknown[] | null)?.length || 0;
        const after = (cell(job, jobsT, F.jobAfter) as unknown[] | null)?.length || 0;
        const canEdit = jobsT.hasPermissionToUpdateRecords([job]);

        const start = (): void =>
            void run(async () => {
                await jobsT.updateRecordAsync(job, {[F.jobStatus]: {name: 'In Progress'}});
                if (!openEntry) await clockOn(`Started job #${text(job, jobsT, F.jobNumber)}`);
            }, `Job started.${openEntry ? '' : ' Clocked you on.'}`);
        const complete = (): void => {
            if (!summary.trim()) {
                setToast('Add a work done summary first. It goes on the invoice.');
                return;
            }
            void run(
                () => jobsT.updateRecordAsync(job, {[F.jobStatus]: {name: 'Completed'}, [F.jobDone]: today}),
                'Job complete. The office has it for invoicing.',
            );
        };
        const saveNote = (target: 'notes' | 'summary'): void => {
            const t = noteDraft.trim();
            if (!t) {
                setToast('Type something first.');
                return;
            }
            const stamp = `${hm(new Date())} ${new Date().toLocaleDateString('en-NZ')} · ${firstName}`;
            const fieldId = target === 'notes' ? F.jobNotes : F.jobSummary;
            const prev = target === 'notes' ? notes : summary;
            const next = target === 'notes' ? (prev ? `${prev}\n\n` : '') + `${stamp}: ${t}` : (prev ? `${prev}\n` : '') + t;
            void run(async () => {
                await jobsT.updateRecordAsync(job, {[fieldId]: next});
                setNoteDraft('');
            }, target === 'notes' ? 'Note saved.' : 'Work done summary saved.');
        };

        return (
            <div className="flex flex-col pb-8">
                <div className="flex min-h-[52px] items-center gap-1.5 px-2 pt-2">
                    <button
                        type="button"
                        aria-label="Back"
                        onClick={() => setScreen('today')}
                        className="flex h-11 w-11 items-center justify-center rounded-lg text-[#2A302D] hover:bg-[#ECEFEB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F6B47]"
                    >
                        <CaretLeftIcon size={24} />
                    </button>
                    <span className="text-sm font-semibold tabular-nums text-[#4B5550]">#{text(job, jobsT, F.jobNumber)}</span>
                    <span className="flex-1" />
                    <span className="pr-3">{statusPill(job)}</span>
                </div>
                <div className="flex flex-col gap-4 px-5">
                    <div className="flex flex-col gap-1.5">
                        <h1 className="text-[26px] font-bold leading-tight tracking-tight text-[#1A1F1D]">
                            {text(job, jobsT, F.jobTitle) || 'Untitled job'}
                        </h1>
                        <span className="text-[15px] text-[#4B5550]">{text(job, jobsT, F.jobClientName)}</span>
                        <span className="self-start">{urgentTag(job)}</span>
                    </div>

                    <div className="divide-y divide-[#E6E9E6] rounded-2xl border border-[#E6E9E6] bg-white">
                        <div className="flex items-center gap-3 py-3 pl-4 pr-3">
                            <MapPinIcon size={20} className="flex-none text-[#7C857F]" />
                            <span className="min-w-0 flex-1 text-base font-semibold text-[#2A302D]">{addr || 'No address yet'}</span>
                            {addr && (
                                <a
                                    href={mapUrl(addr)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex h-11 flex-none items-center gap-1.5 rounded-lg bg-[#E3F0E8] px-3.5 text-[15px] font-semibold text-[#0F6B47] no-underline"
                                >
                                    <NavigationArrowIcon size={16} />
                                    Go
                                </a>
                            )}
                        </div>
                        {(contact || phone) && (
                            <div className="flex items-center gap-3 py-3 pl-4 pr-3">
                                <PhoneIcon size={20} className="flex-none text-[#7C857F]" />
                                <span className="flex min-w-0 flex-1 flex-col">
                                    <span className="truncate text-base font-semibold text-[#2A302D]">{contact}</span>
                                    <span className="text-sm text-[#4B5550]">{phone || 'No phone number'}</span>
                                </span>
                                {phone && (
                                    <a
                                        href={`tel:${phone.replace(/\s/g, '')}`}
                                        className="flex h-11 flex-none items-center gap-1.5 rounded-lg bg-[#E3F0E8] px-3.5 text-[15px] font-semibold text-[#0F6B47] no-underline"
                                    >
                                        <PhoneIcon size={16} />
                                        Call
                                    </a>
                                )}
                            </div>
                        )}
                    </div>

                    {canEdit && st === 'Scheduled' && (
                        <button
                            type="button"
                            disabled={busy}
                            onClick={start}
                            className="flex h-14 items-center justify-center gap-2 rounded-xl bg-[#0F6B47] text-[17px] font-semibold text-white hover:bg-[#0A4F34] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#0F6B47]"
                        >
                            <PlayIcon size={20} weight="fill" />
                            Start job
                        </button>
                    )}
                    {canEdit && st === 'In Progress' && (
                        <button
                            type="button"
                            disabled={busy}
                            onClick={complete}
                            className="flex h-14 items-center justify-center gap-2 rounded-xl bg-[#0F6B47] text-[17px] font-semibold text-white hover:bg-[#0A4F34] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#0F6B47]"
                        >
                            <CheckIcon size={20} weight="bold" />
                            Mark complete
                        </button>
                    )}

                    <section className="flex flex-col gap-2.5">
                        <h2 className="text-[17px] font-semibold text-[#2A302D]">Work done summary</h2>
                        {summary ? (
                            <p className="whitespace-pre-wrap rounded-xl border border-[#E6E9E6] bg-white px-3.5 py-3 text-[15px] leading-relaxed text-[#2A302D]">
                                {summary}
                            </p>
                        ) : (
                            <p className="text-sm text-[#4B5550]">Not written yet. It goes on the invoice and the client email.</p>
                        )}
                        <h2 className="mt-2 text-[17px] font-semibold text-[#2A302D]">Notes</h2>
                        {notes && (
                            <p className="whitespace-pre-wrap rounded-xl border border-[#E6E9E6] bg-white px-3.5 py-3 text-[15px] leading-relaxed text-[#2A302D]">
                                {notes}
                            </p>
                        )}
                        {canEdit && (
                            <>
                                <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#2A302D]">
                                    Add to this job
                                    <textarea
                                        rows={3}
                                        value={noteDraft}
                                        onChange={(e) => setNoteDraft(e.target.value)}
                                        placeholder="What did you find? Parts used?"
                                        className="resize-none rounded-xl border border-[#C9CFCB] bg-white px-3.5 py-3 text-base font-normal text-[#2A302D] outline-none focus:border-[#0F6B47] focus:ring-2 focus:ring-[#0F6B47]/25"
                                    />
                                </label>
                                <div className="flex flex-wrap justify-end gap-2">
                                    <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() => saveNote('notes')}
                                        className="h-11 rounded-lg border border-[#C9CFCB] bg-white px-4 text-[15px] font-semibold text-[#2A302D] hover:bg-[#E3F0E8] disabled:opacity-60"
                                    >
                                        Save as note
                                    </button>
                                    <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() => saveNote('summary')}
                                        className="h-11 rounded-lg bg-[#2A302D] px-4 text-[15px] font-semibold text-white disabled:opacity-60"
                                    >
                                        Add to work done summary
                                    </button>
                                </div>
                            </>
                        )}
                    </section>

                    <section className="flex flex-col gap-2.5">
                        <div className="flex items-baseline justify-between">
                            <h2 className="text-[17px] font-semibold text-[#2A302D]">Photos</h2>
                            <span className="text-sm text-[#4B5550]">
                                {before} before · {after} after
                            </span>
                        </div>
                        {jobsT.hasPermissionToExpandRecords() && (
                            <button
                                type="button"
                                onClick={() => expandRecord(job)}
                                className="flex min-h-[56px] items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed border-[#C9CFCB] bg-white text-[15px] font-semibold text-[#0F6B47] hover:bg-[#E3F0E8]"
                            >
                                <CameraIcon size={22} />
                                Add before or after photos
                            </button>
                        )}
                    </section>
                </div>
            </div>
        );
    }

    function ClockScreen(): React.ReactElement {
        return (
            <div className="flex flex-col gap-4 px-5 pb-6">
                <h1 className="text-[32px] font-bold leading-tight tracking-tight text-[#1A1F1D]">Timesheet</h1>
                <div className="flex flex-col items-center gap-2.5 rounded-[20px] bg-[#1A1F1D] px-5 py-6 text-center text-white">
                    <span className={`text-xs font-bold uppercase tracking-[0.14em] ${openEntry ? 'text-[#6CC270]' : 'text-[#C9CFCB]'}`}>
                        {openEntry ? 'On the clock' : 'Off the clock'}
                    </span>
                    <span className="text-[56px] font-bold leading-none tabular-nums tracking-tight">
                        {clockTxt(openEntry ? now - openStart : 0)}
                    </span>
                    {biz && <span className="text-sm text-[#C9CFCB]">Working for {shortBiz(biz.name)}</span>}
                    <button
                        type="button"
                        disabled={busy || !timeT.hasPermissionToCreateRecords()}
                        onClick={toggleClock}
                        className={`mt-2 h-[60px] w-full rounded-xl text-lg font-bold text-[#1A1F1D] disabled:opacity-60 ${openEntry ? 'bg-white' : 'bg-[#6CC270]'}`}
                    >
                        {openEntry ? 'Clock off' : 'Clock on'}
                    </button>
                </div>
                {todayEntries.length > 0 && (
                    <section className="flex flex-col gap-2.5">
                        <h2 className="text-[17px] font-semibold text-[#2A302D]">Today</h2>
                        <ul className="divide-y divide-[#E6E9E6] overflow-hidden rounded-2xl border border-[#E6E9E6] bg-white">
                            {todayEntries.map((t) => {
                                const s = cell(t, timeT, F.timeStart) as string | null;
                                const e = cell(t, timeT, F.timeEnd) as string | null;
                                return (
                                    <li key={t.id} className="flex min-h-[48px] items-center gap-3.5 px-4">
                                        <span className="text-sm font-semibold tabular-nums text-[#4B5550]">
                                            {s ? hm(new Date(s)) : '--:--'} – {e ? hm(new Date(e)) : 'now'}
                                        </span>
                                        <span className="min-w-0 flex-1 truncate text-[15px] text-[#2A302D]">{text(t, timeT, F.timeNotes)}</span>
                                    </li>
                                );
                            })}
                        </ul>
                    </section>
                )}
                <div className="flex items-center justify-between rounded-2xl border border-[#E6E9E6] bg-white px-4 py-3.5">
                    <span className="text-[15px] font-semibold text-[#2A302D]">Last 7 days</span>
                    <span className="text-xl font-bold tabular-nums text-[#1A1F1D]">{Math.round(weekHours * 10) / 10} h</span>
                </div>
            </div>
        );
    }

    function IntakeScreen(): React.ReactElement {
        const canCreate = jobsT!.hasPermissionToCreateRecords();
        const save = (): void => {
            if (!intake.title.trim() || !intake.address.trim()) {
                setIntakeErr('Add what the job is and the address so it can be found later.');
                return;
            }
            const notes = [
                intake.customer.trim() && `Customer: ${intake.customer.trim()}`,
                intake.phone.trim() && `Phone: ${intake.phone.trim()}`,
                `Added by ${meName} in the crew app.`,
            ]
                .filter(Boolean)
                .join('\n');
            void run(async () => {
                await jobsT!.createRecordAsync({
                    [F.jobTitle]: intake.title.trim(),
                    [F.jobAddress]: intake.address.trim(),
                    [F.jobStatus]: {name: 'Scheduled'},
                    [F.jobPriority]: {name: intake.urgent ? 'Urgent' : 'Normal'},
                    [F.jobAssigned]: [{id: me!.id}],
                    [F.jobDate]: today,
                    [F.jobNotes]: notes,
                    ...(biz ? {[F.jobBiz]: [{id: biz.id}]} : {}),
                });
                setIntake({title: '', customer: '', phone: '', address: '', urgent: false});
                setIntakeErr('');
                setScreen('today');
            }, `Job added${biz ? ` for ${shortBiz(biz.name)}` : ''}. It's on your run sheet.`);
        };
        const input =
            'h-12 rounded-xl border border-[#C9CFCB] bg-white px-3.5 text-base font-normal text-[#2A302D] outline-none focus:border-[#0F6B47] focus:ring-2 focus:ring-[#0F6B47]/25';
        return (
            <div className="flex flex-col gap-4 px-5 pb-8">
                <div className="flex flex-col gap-1">
                    <h1 className="text-[32px] font-bold leading-tight tracking-tight text-[#1A1F1D]">New job</h1>
                    <p className="text-[15px] text-[#4B5550]">
                        {biz ? `For ${shortBiz(biz.name)}. ` : ''}It goes on your run sheet for today and the office sees it.
                    </p>
                </div>
                <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#2A302D]">
                    What&apos;s the job?
                    <input className={input} value={intake.title} onChange={(e) => setIntake({...intake, title: e.target.value})} placeholder="e.g. Leaking tap upstairs" />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#2A302D]">
                    Address
                    <input className={input} value={intake.address} onChange={(e) => setIntake({...intake, address: e.target.value})} placeholder="Street, suburb, city" />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#2A302D]">
                    Customer
                    <input className={input} value={intake.customer} onChange={(e) => setIntake({...intake, customer: e.target.value})} placeholder="Name or company" />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#2A302D]">
                    Phone
                    <input className={input} inputMode="tel" value={intake.phone} onChange={(e) => setIntake({...intake, phone: e.target.value})} placeholder="021 000 000" />
                </label>
                <fieldset className="flex flex-col gap-2">
                    <legend className="mb-2 text-sm font-semibold text-[#2A302D]">Priority</legend>
                    <div className="flex gap-2">
                        {[false, true].map((u) => (
                            <button
                                key={String(u)}
                                type="button"
                                aria-pressed={intake.urgent === u}
                                onClick={() => setIntake({...intake, urgent: u})}
                                className={`min-h-[44px] flex-1 rounded-xl border text-[15px] font-semibold ${intake.urgent === u ? 'border-[#0F6B47] bg-[#0F6B47] text-white' : 'border-[#C9CFCB] bg-white text-[#2A302D]'}`}
                            >
                                {u ? 'Urgent' : 'Normal'}
                            </button>
                        ))}
                    </div>
                </fieldset>
                {intakeErr && (
                    <div role="alert" className="rounded-xl bg-[#FBE6E4] px-3.5 py-3 text-sm font-medium text-[#993029]">
                        {intakeErr}
                    </div>
                )}
                <button
                    type="button"
                    disabled={busy || !canCreate}
                    onClick={save}
                    className="h-14 rounded-xl bg-[#0F6B47] text-[17px] font-semibold text-white hover:bg-[#0A4F34] disabled:opacity-60"
                >
                    Save job
                </button>
            </div>
        );
    }

    return (
        <div className="relative flex h-full min-h-full flex-col bg-[#F4F5F2] font-sans text-[#2A302D]">
            <main className="mx-auto w-full max-w-xl flex-1 overflow-y-auto pb-24" tabIndex={0}>
                {screen !== 'job' && topBar}
                {screen === 'today' && TodayScreen()}
                {screen === 'job' && JobScreen()}
                {screen === 'clock' && ClockScreen()}
                {screen === 'intake' && IntakeScreen()}
            </main>
            <nav
                aria-label="Crew app"
                className="fixed bottom-0 left-0 right-0 z-20 flex justify-around border-t border-[#E6E9E6] bg-white/90 px-2 pb-5 pt-1.5 backdrop-blur"
            >
                {tabs.map(([k, label, icon]) => {
                    const on = screen === k || (screen === 'job' && k === 'today');
                    return (
                        <button
                            key={k}
                            type="button"
                            aria-current={on ? 'page' : undefined}
                            onClick={() => setScreen(k)}
                            className={`flex min-h-[52px] max-w-[160px] flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${on ? 'text-[#0F6B47]' : 'text-[#4B5550]'}`}
                        >
                            {icon}
                            {label}
                        </button>
                    );
                })}
            </nav>
            {sheet && (
                <div className="fixed inset-0 z-40 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Switch company">
                    <button type="button" aria-label="Close" className="absolute inset-0 bg-[#1A1F1D]/40" onClick={() => setSheet(false)} />
                    <div className="relative mx-auto flex w-full max-w-xl flex-col gap-3.5 rounded-t-[20px] bg-white px-5 pb-9 pt-2.5 shadow-lg">
                        <span aria-hidden="true" className="mx-auto h-1.5 w-10 rounded-full bg-[#C9CFCB]" />
                        <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#0F6B47]">Working for</span>
                        <div className="flex flex-col gap-2">
                            {bizList.map((b) => {
                                const sel = b.id === bizId;
                                const count = jobs.filter(
                                    (j) =>
                                        links(j, jobsT, F.jobAssigned).some((l) => l.id === me.id) &&
                                        links(j, jobsT, F.jobBiz).some((l) => l.id === b.id) &&
                                        !isDone(j),
                                ).length;
                                return (
                                    <button
                                        key={b.id}
                                        type="button"
                                        aria-current={sel ? 'true' : undefined}
                                        onClick={() => {
                                            setBizId(b.id);
                                            setSheet(false);
                                            try {
                                                window.localStorage.setItem(storeKey, b.id);
                                            } catch {
                                                return;
                                            }
                                            if (!sel) setToast(`Now working for ${shortBiz(b.name)}.`);
                                        }}
                                        className={`flex min-h-[60px] items-center gap-3 rounded-2xl border px-3.5 py-2 text-left ${sel ? 'border-[#0F6B47] bg-[#E3F0E8]' : 'border-[#E6E9E6] bg-white'}`}
                                    >
                                        <span className="flex min-w-0 flex-1 flex-col">
                                            <span className="truncate text-base font-semibold text-[#2A302D]">{b.name}</span>
                                            <span className="text-sm text-[#4B5550]">{count === 1 ? '1 open job' : `${count} open jobs`}</span>
                                        </span>
                                        {sel && <CheckIcon size={20} weight="bold" className="text-[#0F6B47]" />}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="flex items-center gap-3 border-t border-[#E6E9E6] pt-3.5">
                            <Avatar name={meName} id={me.id} />
                            <span className="flex min-w-0 flex-1 flex-col">
                                <span className="truncate text-base font-semibold">{meName}</span>
                                <span className="text-sm text-[#4B5550]">{selectName(me, staffT, F.staffRole)}</span>
                            </span>
                        </div>
                    </div>
                </div>
            )}
            <Toast message={toast} />
        </div>
    );
}

initializeBlock({interface: () => <CrewApp />});
