import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Boxes, CheckCircle2, FileBarChart, HeartPulse, Map, ShieldCheck, Stethoscope, Users } from 'lucide-react';
import { useStore } from '../store/store';
import { groomTasks, inventory, operationalAlerts, reportMetrics, reportTrend, workflowSteps } from '../data/raceos';
import { T } from '../i18n/T';
import { useI18n } from '../i18n/I18nContext';

const Card = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`rounded-2xl border border-gray-100 bg-white p-6 shadow-[0_2px_8px_rgba(5,96,69,0.05)] ${className}`}>{children}</div>
);

const PageHeader = ({ title, copy }: { title: string; copy: string }) => <div><h2 className="text-2xl font-bold tracking-tight text-gray-900"><T>{title}</T></h2><p className="mt-1 font-light text-gray-500"><T>{copy}</T></p></div>;

export function GroomTasks() {
  const [done, setDone] = useState<number[]>([0]);
  return <div className="space-y-8"><PageHeader title="Daily tasks" copy={`${done.length} of ${groomTasks.length} completed today.`} /><Card><div className="mb-4 h-2 overflow-hidden rounded-full bg-gray-100"><div className="h-full bg-emerald-600 transition-all" style={{ width: `${done.length / groomTasks.length * 100}%` }} /></div><div className="space-y-2">{groomTasks.map((task, index) => <button key={task.horse} onClick={() => setDone(current => current.includes(index) ? current : [...current, index])} className={`flex w-full items-center gap-4 rounded-xl p-4 text-left transition ${done.includes(index) ? 'bg-emerald-50 opacity-60' : 'hover:bg-gray-50'}`}><span className="w-12 font-mono text-xs text-gray-400">{task.time}</span><div className="flex-1"><p className="text-sm font-semibold text-gray-800">{task.horse}</p><p className="text-xs text-gray-400"><T>{task.detail}</T></p></div><CheckCircle2 size={20} className={done.includes(index) ? 'text-emerald-600' : 'text-gray-200'} /></button>)}</div></Card></div>;
}

export function StableMap() {
  const horses = useStore(state => state.horses);
  return <div className="space-y-8"><PageHeader title="Stable map" copy="Live stall status and care assignments." /><div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{horses.slice(0, 8).map((horse, index) => <Card key={horse.id} className={horse.healthStatus === 'INJURED' ? 'border-red-100 bg-red-50/40' : ''}><div className="mb-5 flex items-center justify-between"><Map size={18} className="text-emerald-600" /><span className="font-mono text-xs text-gray-400">{String.fromCharCode(65 + Math.floor(index / 4))}{String(index % 4 + 1).padStart(2, '0')}</span></div><p className="font-semibold text-gray-900">{horse.name}</p><p className="mt-1 text-xs text-gray-400"><T>{horse.currentPhase}</T></p></Card>)}</div></div>;
}

export function IncidentReport() {
  const { t } = useI18n();
  const horses = useStore(state => state.horses);
  const [submitted, setSubmitted] = useState(false);
  return <div className="mx-auto max-w-2xl space-y-8"><PageHeader title="Report an incident" copy="Record an observation and notify the responsible team." />{submitted ? <Card className="border-emerald-100 bg-emerald-50"><CheckCircle2 className="mb-3 text-emerald-600" /><p className="font-semibold text-gray-900"><T>Incident submitted</T></p><p className="text-sm text-gray-500"><T>The horse timeline and alerts have been updated.</T></p></Card> : <Card><div className="space-y-5"><label className="block text-sm text-gray-500"><T>Horse</T><select className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-gray-800">{horses.map(horse => <option key={horse.id}>{horse.name}</option>)}</select></label><label className="block text-sm text-gray-500"><T>Incident type</T><select className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-gray-800"><option><T>Injury</T></option><option><T>Behavior</T></option><option><T>Equipment</T></option><option><T>Feed</T></option></select></label><label className="block text-sm text-gray-500"><T>Notes</T><textarea className="mt-2 min-h-32 w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-gray-800" placeholder={t('What happened?')} /></label><button onClick={() => setSubmitted(true)} className="w-full rounded-xl bg-emerald-600 py-3 font-semibold text-white"><T>Submit incident</T></button></div></Card>}</div>;
}

export function Medical() {
  const horses = useStore(state => state.horses);
  const cases = horses.filter(horse => horse.healthStatus !== 'ELIGIBLE');
  return <div className="space-y-8"><PageHeader title="Medical workspace" copy="Examinations, treatment plans, vaccinations, and training restrictions." /><div className="grid gap-5 md:grid-cols-5"><Card className="md:col-span-3"><h3 className="mb-5 flex items-center gap-2 text-sm font-semibold text-gray-500"><Stethoscope size={17} className="text-emerald-600" /> <T>Active cases</T></h3><div className="space-y-3">{cases.map(horse => <div key={horse.id} className="rounded-xl bg-gray-50 p-4"><div className="flex items-center justify-between"><div><p className="font-semibold text-gray-800">{horse.name}</p><p className="text-xs text-gray-400"><T>{horse.currentPhase}</T></p></div><span className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700"><T>{horse.healthStatus.replace('_', ' ')}</T></span></div><div className="mt-4 flex flex-wrap gap-2"><Link to={`/medical/exam/${horse.id}`} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"><T>Examination</T></Link><Link to={`/medical/injury/${horse.id}`} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600"><T>Injury map</T></Link><Link to={`/medical/lock/${horse.id}`} className="rounded-lg border border-red-100 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600"><T>Lock training</T></Link></div></div>)}</div></Card><Card className="md:col-span-2"><HeartPulse className="mb-4 text-red-500" /><p className="text-3xl font-bold text-gray-900">{cases.length}</p><p className="text-sm text-gray-400"><T>Cases requiring review</T></p>{cases[0] && <Link to={`/medical/exam/${cases[0].id}`} className="mt-6 block w-full rounded-xl bg-emerald-600 py-2.5 text-center text-sm font-semibold text-white"><T>Record examination</T></Link>}</Card></div></div>;
}

export function Alerts() {
  return <div className="space-y-8"><PageHeader title="Alerts" copy="Prioritized clinical and operational notifications." /><div className="space-y-3">{operationalAlerts.map(({ severity, horse, detail }) => <Card key={`${severity}-${horse}`} className={severity === 'Critical' ? 'border-red-100 bg-red-50/50' : severity === 'Warning' ? 'border-amber-100 bg-amber-50/50' : ''}><div className="flex gap-4"><AlertTriangle className={severity === 'Critical' ? 'text-red-500' : severity === 'Warning' ? 'text-amber-500' : 'text-sky-500'} /><div><p className="text-xs font-semibold text-gray-400"><T>{severity}</T></p><p className="font-semibold text-gray-900">{horse}</p><p className="mt-1 text-sm text-gray-500"><T>{detail}</T></p></div></div></Card>)}</div></div>;
}

export function Operations() {
  return <div className="space-y-8"><PageHeader title="Club operations" copy="Inventory, staffing, permissions, and audit activity." /><div className="grid gap-5 md:grid-cols-5"><Card className="md:col-span-3"><h3 className="mb-5 flex items-center gap-2 text-sm font-semibold text-gray-500"><Boxes size={17} className="text-emerald-600" /> <T>Inventory</T></h3>{inventory.map(({ name, stock, low }) => <div key={name} className="flex justify-between border-b border-gray-50 py-3 last:border-0"><span className="text-sm text-gray-700"><T>{name}</T></span><span className={`text-sm font-semibold ${low ? 'text-amber-600' : 'text-emerald-600'}`}>{stock}</span></div>)}</Card><Card className="md:col-span-2"><Users className="mb-4 text-emerald-600" /><p className="text-3xl font-bold text-gray-900">12</p><p className="text-sm text-gray-400"><T>Staff on duty</T></p><div className="mt-5 border-t border-gray-100 pt-5"><ShieldCheck className="mb-2 text-sky-500" size={18} /><p className="text-sm font-medium text-gray-700"><T>RBAC and audit enabled</T></p></div></Card></div></div>;
}

export function Reports() {
  return <div className="space-y-8"><PageHeader title="Reports" copy="Shared financial, training, health, and racing indicators." /><div className="grid grid-cols-2 gap-5 lg:grid-cols-4">{reportMetrics.map(({ label, value }) => <Card key={label}><FileBarChart className="mb-4 text-emerald-600" size={19} /><p className="text-2xl font-bold text-gray-900">{value}</p><p className="mt-1 text-xs text-gray-400"><T>{label}</T></p></Card>)}</div><Card><h3 className="mb-5 text-sm font-semibold text-gray-500"><T>Six-month trend</T></h3><div className="flex h-44 items-end gap-4">{reportTrend.map((value, index) => <div key={index} className="flex-1 rounded-t-xl bg-emerald-500" style={{ height: `${value}%`, opacity: .55 + index * .07 }} />)}</div></Card></div>;
}

export function Profile() {
  const user = useStore(state => state.currentUser);
  return <div className="mx-auto max-w-2xl space-y-8"><PageHeader title="Profile & access" copy="Account, workspace, permissions, and audit status." /><Card><div className="flex items-center gap-4"><img src={user?.avatar} className="h-16 w-16 rounded-2xl object-cover ring-4 ring-emerald-50" /><div><p className="text-xl font-bold text-gray-900">{user?.name}</p><p className="text-sm text-gray-400"><T>{user?.role.replace('_', ' ')}</T></p></div></div><div className="mt-6 grid grid-cols-2 gap-4 border-t border-gray-100 pt-6"><div><p className="text-xs text-gray-400"><T>Workspace</T></p><p className="text-sm font-medium text-gray-800"><T>Meadowline Racing Club</T></p></div><div><p className="text-xs text-gray-400"><T>Audit</T></p><p className="text-sm font-medium text-emerald-600"><T>Enabled</T></p></div></div></Card></div>;
}

export function Workflow() {
  return <div className="space-y-8"><PageHeader title="End-to-end workflow" copy="One connected chain of decisions around each horse." /><Card>{workflowSteps.map(({ role, action }, index) => <div key={`${role}-${action}`} className="flex gap-4"><div className="flex flex-col items-center"><div className="h-3 w-3 rounded-full bg-emerald-600" />{index < workflowSteps.length - 1 && <div className="min-h-14 w-px flex-1 bg-emerald-100" />}</div><div className="pb-7"><p className="text-xs font-semibold text-emerald-600"><T>{role}</T></p><p className="font-medium text-gray-800"><T>{action}</T></p></div></div>)}</Card></div>;
}
