// src/components/sources/competitor-form.tsx — owner-confirmed competitor
// curation (Stage E, spec §21). Client island over addCompetitorAction:
// pending label, duplicate guard, honest empty-rating framing. Nothing
// is scraped or fabricated — the owner types what they know.
"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addCompetitorAction, type CompetitorState } from "@/app/[locale]/(app)/settings/sources/actions";

const INITIAL: CompetitorState = {};

export function CompetitorForm() {
  const t = useTranslations("sources.competitors");
  const [state, action, pending] = useActionState(addCompetitorAction, INITIAL);

  return (
    <form action={action} className="mt-4 space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="comp-name">{t("name")}</Label>
          <Input id="comp-name" name="name" required minLength={2} maxLength={120} autoComplete="off" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="comp-city">{t("city")}</Label>
          <Input id="comp-city" name="city" maxLength={60} autoComplete="off" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="comp-rating">{t("rating")}</Label>
          <Input
            id="comp-rating"
            name="rating"
            inputMode="decimal"
            placeholder="4.5"
            autoComplete="off"
          />
          <p className="text-[13px] text-ink-500">{t("ratingHint")}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="comp-count">{t("countLabel")}</Label>
          <Input id="comp-count" name="reviewCount" inputMode="numeric" autoComplete="off" />
        </div>
      </div>
      {state.error && (
        <p role="alert" className="text-[13px] font-medium text-danger-600">
          {t(`error.${state.error}`)}
        </p>
      )}
      {state.ok && (
        <p role="status" className="text-[13px] font-medium text-success-600">
          {t("added")}
        </p>
      )}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? t("adding") : t("add")}
      </Button>
    </form>
  );
}
