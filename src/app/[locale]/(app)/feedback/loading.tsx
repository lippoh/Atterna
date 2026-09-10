// src/app/[locale]/(app)/feedback/loading.tsx — Stage B skeleton.
export default function FeedbackLoading() {
  return (
    <main id="main-content" className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6" aria-busy="true" aria-label="Loading feedback">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="skeleton h-9 w-52 rounded-md" />
          <div className="skeleton mt-2 h-4 w-72 rounded" />
        </div>
        <div className="skeleton h-10 w-40 rounded-md" />
      </div>
      <div className="mt-8 grid grid-cols-1 items-start gap-6 lg:grid-cols-[5fr_7fr]">
        <div className="rounded-lg border border-line bg-surface p-5 shadow-xs sm:p-6">
          <div className="skeleton h-5 w-40 rounded" />
          <div className="skeleton mt-3 h-4 w-full rounded" />
          <div className="skeleton mt-2 h-4 w-5/6 rounded" />
          <div className="mt-6 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton h-12 rounded-md" />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-line bg-surface p-4 shadow-xs">
              <div className="skeleton mx-auto size-[140px] rounded-md" />
              <div className="skeleton mx-auto mt-3 h-3 w-32 rounded" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
