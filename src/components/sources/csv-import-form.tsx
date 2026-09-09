// src/components/sources/csv-import-form.tsx — the CSV upload island
// (client): useActionState over importCsvAction, shows the import summary
// (imported / updated / invalid + per-row reasons). Progressive
// enhancement: it is a plain <form> underneath.
"use client";
import { useActionState } from "react";
import { importCsvAction, type ImportState } from "@/app/[locale]/(app)/settings/sources/actions";
import { useTranslations } from "next-intl";

const initial: ImportState = {};

export function CsvImportForm() {
  const t = useTranslations("sources.import");
  const [state, action, pending] = useActionState(importCsvAction, initial);

  return (
    <div>
      <form action={action} className="flex flex-wrap items-end gap-3">
        <div className="min-w-[240px] flex-1">
          <label
            htmlFor="csv-file"
            className="flex h-10 w-full cursor-pointer items-center gap-2 rounded-md border border-dashed border-line-strong bg-sunken px-3 text-sm text-ink-500 transition-colors hover:border-aegean-600"
          >
            <span className="truncate">{t("chooseFile")}</span>
          </label>
          <input id="csv-file" name="file" type="file" accept=".csv,text/csv" required className="sr-only" />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center gap-2 rounded-md bg-aegean-600 px-4 text-sm font-semibold text-white shadow-xs transition-[background-color,transform,box-shadow] duration-150 hover:-translate-y-px hover:bg-aegean-700 hover:shadow-sm disabled:translate-y-0 disabled:opacity-60"
        >
          {pending ? t("importing") : t("submit")}
        </button>
      </form>

      <p className="mt-2 text-[12px] leading-snug text-ink-300">{t("hint")}</p>

      {state.error && !state.ok && (
        <p className="mt-3 rounded-md border border-danger-600/30 bg-danger-100/50 px-3 py-2 text-[13px] font-medium text-danger-600">
          {t(`error.${state.error}`)}
        </p>
      )}

      {state.ok && (
        <div className="mt-3 rounded-md border border-success-600/30 bg-success-100/50 px-4 py-3">
          <p className="text-[13px] font-semibold text-ink-900">
            {t("summary", {
              total: state.total ?? 0,
              imported: state.imported ?? 0,
              updated: state.updated ?? 0,
              invalid: state.invalid ?? 0,
            })}
          </p>
          {state.rowErrors && state.rowErrors.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-[12px] font-medium text-ink-500">
                {t("rowErrors", { count: state.rowErrors.length })}
              </summary>
              <ul className="mt-2 max-h-40 space-y-1 overflow-auto">
                {state.rowErrors.map((e) => (
                  <li key={e.line} className="font-mono text-[11px] text-ink-500">
                    {t(`reason.${e.reason}`, { line: e.line })}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
