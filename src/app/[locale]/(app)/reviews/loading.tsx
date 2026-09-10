// src/app/[locale]/(app)/reviews/loading.tsx — Stage B skeleton.
export default function ReviewsLoading() {
  return (
    <main id="main-content" className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6" aria-busy="true" aria-label="Loading reviews">
      <div className="skeleton h-9 w-44 rounded-md" />
      <div className="mt-6 flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-9 w-28 rounded-full" />
        ))}
      </div>
      <div className="mt-6 divide-y divide-line rounded-lg border border-line bg-surface shadow-xs">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="skeleton h-3.5 w-24 rounded" />
              <div className="skeleton h-5 w-20 rounded-full" />
              <div className="skeleton ml-auto h-3 w-12 rounded" />
            </div>
            <div className="skeleton mt-2.5 h-4 w-full rounded" />
            <div className="skeleton mt-1.5 h-4 w-2/3 rounded" />
          </div>
        ))}
      </div>
    </main>
  );
}
