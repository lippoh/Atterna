// src/app/[locale]/(app)/admin/page.tsx — the cockpit (§9.9)
// Swiss restraint, zero decoration: dense 40px rows at 13px, status
// chips, jobs table with truncated lastError, and the impersonation
// form in a danger-tinted panel (the one irreversible-feeling action).
// All actions + DB checks preserved verbatim.
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { impersonateForSupport } from "@/lib/impersonate";
import { enqueue } from "@/jobs/runner";
import { Button } from "@/components/ui/button";
import { IconAlertTriangle, IconArrowRight, IconRefresh } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

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
      include: { gbpConnection: { select: { status: true, lastSyncAt: true } }, organization: { include: { subscription: { select: { status: true, planKey: true } } } } },
    }),
    prisma.job.findMany({ where: { state: "DEAD" }, orderBy: { runAt: "desc" }, take: 10 }),
    prisma.subscription.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const dtFmt = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "el-GR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <main id="main-content" className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl font-semibold text-ink-900">{t("title")}</h1>

      <div className="mt-8 grid grid-cols-1 items-start gap-6 lg:grid-cols-[7fr_5fr]">
        <div className="space-y-6">
          {/* Subscriptions summary */}
          <section className="rounded-lg border border-line bg-surface shadow-xs">
            <h2 className="border-b border-line px-5 py-3.5 text-[15px] font-semibold text-ink-900">
              {t("subscriptions")}
            </h2>
            <div className="divide-y divide-line">
              {subs.map((s) => (
                <div key={s.status} className="flex items-center justify-between px-5 py-3 text-sm">
                  <span className="font-mono text-[13px] text-ink-700">{s.status}</span>
                  <span className="font-mono text-[13px] font-semibold tabular-nums text-ink-900">
                    {s._count._all}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Businesses */}
          <section className="rounded-lg border border-line bg-surface shadow-xs">
            <h2 className="border-b border-line px-5 py-3.5 text-[15px] font-semibold text-ink-900">
              {t("businesses")}
            </h2>
            <ul className="divide-y divide-line">
              {businesses.map((b) => (
                <li key={b.id} className="px-5 py-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <p className="text-sm font-semibold text-ink-900">{b.name}</p>
                    <span className="text-[13px] text-ink-500">{b.city}</span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        b.gbpConnection
                          ? "bg-success-100 text-success-600"
                          : "bg-sunken text-ink-500"
                      )}
                    >
                      {b.gbpConnection?.status ?? "—"}
                    </span>
                    <span className="ml-auto font-mono text-[11px] tabular-nums text-ink-300">
                      {b.gbpConnection?.lastSyncAt
                        ? dtFmt.format(b.gbpConnection.lastSyncAt)
                        : "—"}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-3">
                    <span className="rounded-full bg-sunken px-2 py-0.5 font-mono text-[11px] text-ink-500">
                      {b.organization.subscription?.planKey ?? "no-sub"}
                    </span>
                    {b.gbpConnection && (
                      <form action={retrySync}>
                        <input type="hidden" name="businessId" value={b.id} />
                        <Button type="submit" variant="ghost" size="sm">
                          <IconRefresh className="size-3.5" />
                          retry sync
                        </Button>
                      </form>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* Dead jobs */}
          <section className="rounded-lg border border-line bg-surface shadow-xs">
            <h2 className="border-b border-line px-5 py-3.5 text-[15px] font-semibold text-ink-900">
              {t("jobs")}
            </h2>
            {deadJobs.length === 0 ? (
              <p className="px-5 py-4 font-mono text-[13px] text-ink-300">DEAD: 0</p>
            ) : (
              <ul className="divide-y divide-line">
                {deadJobs.map((job) => (
                  <li key={job.id} className="bg-danger-100/30 px-5 py-3">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="inline-flex items-center gap-1.5 font-mono text-[13px] font-semibold text-danger-600">
                        <IconAlertTriangle className="size-3.5" />
                        {job.type}
                      </span>
                      <span className="font-mono text-[11px] tabular-nums text-ink-300">
                        {dtFmt.format(job.runAt)} · {job.attempts}
                      </span>
                      <form action={requeueJob} className="ml-auto">
                        <input type="hidden" name="jobId" value={job.id} />
                        <Button type="submit" variant="ghost" size="sm">
                          <IconRefresh className="size-3.5" />
                          {t("requeue")}
                        </Button>
                      </form>
                    </div>
                    {job.lastError && (
                      <p className="mt-1 truncate font-mono text-[11px] text-ink-500" title={job.lastError}>
                        {job.lastError}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Impersonation — danger-tinted panel */}
        <section className="rounded-lg border border-danger-600/40 bg-surface shadow-xs">
          <h2 className="flex items-center gap-2 border-b border-danger-600/20 bg-danger-100/50 px-5 py-3.5 text-[15px] font-semibold text-danger-600">
            <IconAlertTriangle className="size-4" />
            {t("impersonate")}
          </h2>
          <form action={impersonate} className="flex flex-col gap-3 p-5">
            <input
              name="email"
              type="email"
              required
              placeholder={t("impersonateEmail")}
              autoComplete="off"
              aria-label={t("impersonateEmail")}
              className="flex h-10 w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm text-ink-900 transition-[border-color,box-shadow] duration-150 placeholder:text-ink-300 focus-visible:border-aegean-600 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-aegean-100"
            />
            <p className="text-[13px] leading-relaxed text-ink-500">{t("impersonateNote")}</p>
            <Button type="submit" size="sm" className="self-start">
              <IconArrowRight className="size-4" />
              {t("impersonate")}
            </Button>
          </form>
        </section>
      </div>
    </main>
  );
}
