// src/app/[locale]/page.tsx — the Atterna landing (el/en)
// Composes the marketing sections (§9.1 order): nav → hero → trust →
// problem → how-it-works → features → stats band → testimonials →
// pricing → FAQ → final CTA → footer. Marketing forces the light
// "Porcelain & Ink" palette regardless of system dark mode (§5.2) —
// the .force-light wrapper pins the tokens for this subtree.
import { getTranslations, setRequestLocale } from "next-intl/server";
import { MarketingNav } from "@/components/marketing/nav";
import { Hero } from "@/components/marketing/hero";
import { LiveDemo } from "@/components/marketing/live-demo";
import {
  TrustStrip,
  Problem,
  HowItWorks,
  Features,
  StatsBand,
  Testimonials,
} from "@/components/marketing/sections";
import { Pricing } from "@/components/marketing/pricing";
import { FinalCta, MarketingFooter } from "@/components/marketing/footer";

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  // touch a translation so the route is tied to the messages namespace
  await getTranslations({ namespace: "landing", locale });

  return (
    <div className="force-light bg-background text-foreground">
      <MarketingNav />
      <main id="main-content">
        <Hero />
        <TrustStrip />
        <Problem />
        <LiveDemo />
        <HowItWorks />
        <Features />
        <StatsBand />
        <Testimonials />
        <Pricing />
        <FinalCta />
      </main>
      <MarketingFooter />
    </div>
  );
}
