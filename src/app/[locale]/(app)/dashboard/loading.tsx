// src/app/[locale]/(app)/dashboard/loading.tsx — Stage B skeleton.
// Streams instantly while the intelligence pipeline resolves: the shell
// (header + health block + metric row) renders before any DB data.
export default function DashboardLoading() {
  return (
    <main id="main-content" className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6" aria-busy="true" aria-label="Loading dashboard">
      <div className="skeleton h-9 w-56 rounded-md" />
      <div className="skeleton mt-2 h-4 w-40 rounded" />
      <section className="mt-8 rounded-lg border border-line bg-surface p-5 shadow-xs sm:p-6">
        <div className="flex flex-wrap items-end gap-6">
          <div className="skeleton h-[64px] w-44 rounded-md" />
          <div className="min-w-[260px] flex-1 space-y-1.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton h-2.5 rounded-full" />
            ))}
          </div>
        </div>
      </section>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-line bg-surface p-4 shadow-xs sm:p-5">
            <div className="skeleton h-3 w-24 rounded" />
            <div className="skeleton mt-3 h-8 w-20 rounded" />
            <div className="skeleton mt-2 h-3 w-16 rounded" />
          </div>
        ))}
      </div>
    </main>
  );
}
