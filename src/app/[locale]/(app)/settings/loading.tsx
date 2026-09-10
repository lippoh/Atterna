// src/app/[locale]/(app)/settings/loading.tsx — Stage B skeleton.
export default function SettingsLoading() {
  return (
    <main id="main-content" className="mx-auto max-w-[840px] px-4 py-8 sm:px-6" aria-busy="true" aria-label="Loading settings">
      <div className="skeleton h-9 w-40 rounded-md" />
      <div className="mt-8 space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <section key={i} className="rounded-lg border border-line bg-surface p-5 shadow-xs sm:p-6">
            <div className="skeleton h-5 w-36 rounded" />
            <div className="mt-5 space-y-4">
              <div className="skeleton h-10 w-full rounded-md" />
              <div className="skeleton h-10 w-2/3 rounded-md" />
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
