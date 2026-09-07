// src/app/[locale]/(app)/admin/page.tsx — compact role-gated admin board
// Businesses (connection status + retry sync), jobs board (DEAD requeue),
// subscriptions summary, and the audited impersonation entry point.
// Role is checked server-side against the DB (User.isAdmin) — middleware
// alone is never the gate (Section 35).
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { impersonateForSupport } from "@/lib/impersonate";
import { enqueue } from "@/jobs/runner";
import { Button } from "@/components/ui/button";
export default async function AdminPage() {
const user = await requireUser();
const locale = await getLocale();
const t = await getTranslations({ namespace: "admin", locale });
const fullUser = await prisma.user.findUnique({ where: { id: user.id } });
if (!fullUser?.isAdmin) redirect(`/${locale}/dashboard`);
async function requeueJob(formData: FormData) {
"use server";
const admin = await requireUser();
const row = await prisma.user.findUnique({ where: { id: admin.id } });
if (!row?.isAdmin) return;
const jobId = String(formData.get("jobId") ?? "");
if (!jobId) return;
await prisma.job.update({
where: { id: jobId },
data: { state: "QUEUED", attempts: 0, runAt: new Date() },
});
}
async function retrySync(formData: FormData) {
"use server";
const admin = await requireUser();
const row = await prisma.user.findUnique({ where: { id: admin.id } });
if (!row?.isAdmin) return;
const businessId = String(formData.get("businessId") ?? "");
if (!businessId) return;
await enqueue("sync-reviews", { businessId }, { dedupeKey: `sync:${businessId}` });
}
async function impersonate(formData: FormData) {
"use server";
const admin = await requireUser();
const row = await prisma.user.findUnique({ where: { id: admin.id } });
if (!row?.isAdmin) return;
const email = String(formData.get("email") ?? "").toLowerCase();
const target = await prisma.user.findUnique({ where: { email } });
if (!target) return;
await impersonateForSupport(admin.id, target.id, 20);
redirect(`/${locale}/dashboard`);
}
const [businesses, deadJobs, subs] = await Promise.all([
prisma.business.findMany({
where: { deletedAt: null },
take: 25,
orderBy: { createdAt: "desc" },
include: { gbpConnection: { select: { status: true, lastSyncAt: true } }, organization: {
include: { subscription: { select: { status: true, planKey: true } } } } },
}),
prisma.job.findMany({ where: { state: "DEAD" }, orderBy: { runAt: "desc" }, take: 10 }),
prisma.subscription.groupBy({ by: ["status"], _count: { _all: true } }),
]);
return (
<main className="mx-auto max-w-2xl space-y-6 p-4">
<h1 className="text-xl font-semibold">{t("title")}</h1>
<section className="rounded-xl border border-slate-200 bg-white p-4">
<h2 className="text-sm font-bold text-slate-900">{t("subscriptions")}</h2>
<ul className="mt-2 space-y-1 text-sm text-slate-700">
{subs.map((s) => (
<li key={s.status}>
{s.status}: <strong>{s._count._all}</strong>
</li>
))}
</ul>
</section>
<section className="rounded-xl border border-slate-200 bg-white p-4">
<h2 className="text-sm font-bold text-slate-900">{t("businesses")}</h2>
<ul className="mt-2 space-y-2">
{businesses.map((b) => (
<li key={b.id} className="rounded-lg border border-slate-100 p-2 text-xs
text-slate-600">
<p className="font-semibold text-slate-800">
{b.name} · {b.city}
</p>
<p>
GBP: {b.gbpConnection?.status ?? "—"} · sync:{" "}
{b.gbpConnection?.lastSyncAt?.toLocaleString(locale === "en" ? "en-GB" :
"el-GR") ?? "—"} ·{" "}
{b.organization.subscription?.planKey ?? "no-sub"}
</p>
{b.gbpConnection && (
<form action={retrySync} className="mt-1">
<input type="hidden" name="businessId" value={b.id} />
<Button type="submit" variant="ghost" size="sm">
retry sync
</Button>
</form>
)}
</li>
))}
</ul>
</section>
<section className="rounded-xl border border-slate-200 bg-white p-4">
<h2 className="text-sm font-bold text-slate-900">{t("jobs")}</h2>
{deadJobs.length === 0 ? (
<p className="mt-2 text-xs text-slate-400">DEAD: 0</p>
) : (
<ul className="mt-2 space-y-2">
{deadJobs.map((job) => (
<li key={job.id} className="rounded-lg bg-rose-50 p-2 text-xs text-rose-900">
<p className="font-semibold">{job.type}</p>
<p className="truncate">{job.lastError ?? ""}</p>
<form action={requeueJob} className="mt-1">
<input type="hidden" name="jobId" value={job.id} />
<Button type="submit" variant="ghost" size="sm">
{t("requeue")}
</Button>
</form>
</li>
))}
</ul>
)}
</section>
<section className="rounded-xl border border-slate-200 bg-white p-4">
<h2 className="text-sm font-bold text-slate-900">{t("impersonate")}</h2>
<form action={impersonate} className="mt-2 flex gap-2">
<input
name="email"
type="email"
required
placeholder={t("impersonateEmail")}
className="h-9 flex-1 rounded-md border border-slate-300 px-3 text-sm"
/>
<Button type="submit" size="sm">→</Button>
</form>
</section>
</main>
);
}