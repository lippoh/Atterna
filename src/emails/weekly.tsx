// src/emails/weekly.tsx — the weekly report email (retention surface)
// (§9.8): porcelain background, white card with explicit bgcolor on
// tables (dark-mode-safe), Arial/Helvetica only, big Georgia metric,
// compact metric rows, insights, padded CTA button in #175E9E. No
// images, ever. renderWeeklyEmail() is the exact function the
// weekly-report job imports.
import {
  Html, Head, Body, Container, Section, Heading, Text, Hr, Link, Preview,
} from "@react-email/components";
import { render } from "@react-email/components";
import type { DashboardMetrics, Insight } from "@/lib/metrics";

/** Reputation Intelligence section (spec §26) — optional; when present the
 * email leads with health + what-changed + position + recommendations. */
export interface IntelSection {
  healthScore: number;
  healthDelta: number | null;
  ratingDelta: number | null; // 90d vs prior 90d
  responseRate: number | null; // 0..1
  negativeShare: number | null; // 0..1 among analyzed
  position: string | null; // e.g. "#2/7"
  topStrength: string | null;
  recommendations: { title: string }[];
  narrative: string | null;
}

export interface WeeklyEmailProps {
  locale: string;
  businessName: string;
  metrics: DashboardMetrics;
  insights: Insight[];
  intel?: IntelSection;
  appUrl?: string;
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

// Aegean Premium email palette (§9.8) — flat hex, bulletproof.
const C = {
  canvas: "#faf9f7",
  card: "#ffffff",
  ink: "#12283f",
  body: "#31445a",
  muted: "#66788b",
  line: "#e7e2d8",
  aegean: "#175e9e",
  terracotta: "#c05b33",
};

export function WeeklyEmail(props: WeeklyEmailProps) {
  const el = props.locale !== "en";
  const appUrl = props.appUrl ?? process.env.APP_URL ?? "https://app.example.gr";
  const m = props.metrics;
  return (
    <Html lang={el ? "el" : "en"}>
      <Head />
      <Preview>
        {el
          ? `${props.businessName}: βαθμολογία ${m.rating.toFixed(1)} · ${m.reviewCount} κριτικές`
          : `${props.businessName}: rating ${m.rating.toFixed(1)} · ${m.reviewCount} reviews`}
      </Preview>
      <Body style={{ backgroundColor: C.canvas, fontFamily: "Helvetica, Arial, sans-serif", margin: 0 }}>
        <Container style={{ maxWidth: "600px", margin: "0 auto", padding: "24px 16px" }}>
          {/* Wordmark header + 2px terracotta rule (shared across all emails) */}
          <Section style={{ padding: "0 8px 12px" }}>
            <Text style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 20, fontWeight: 700, color: C.ink, margin: 0 }}>
              Atterna<span style={{ color: C.terracotta }}>.</span>
            </Text>
          </Section>
          <div style={{ height: 2, backgroundColor: C.terracotta, margin: "0 8px 20px" }} />

          <Section bgcolor={C.card} style={{ borderRadius: 12, border: `1px solid ${C.line}`, padding: "28px" }}>
            <Heading as="h1" style={{ fontSize: 20, color: C.ink, margin: "0 0 4px", fontWeight: 700 }}>
              {el ? "Εβδομαδιαία αναφορά φήμης" : "Weekly reputation report"}
            </Heading>
            <Text style={{ color: C.muted, fontSize: 13, margin: "0 0 20px" }}>
              {props.businessName}
            </Text>

            {props.intel && (
              <>
                {/* Reputation Health (deterministic score) */}
                <Text style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 32, fontWeight: 700, color: C.aegean, margin: "0 0 2px" }}>
                  {props.intel.healthScore}
                  <span style={{ fontSize: 15, color: C.muted, fontWeight: 400 }}> / 100</span>
                  {props.intel.healthDelta !== null && props.intel.healthDelta !== 0 && (
                    <span style={{ fontSize: 15, color: props.intel.healthDelta > 0 ? "#1c7c4a" : "#b3392b", fontWeight: 700 }}>
                      {" "}{props.intel.healthDelta > 0 ? "↑" : "↓"}{Math.abs(props.intel.healthDelta)}
                    </span>
                  )}
                </Text>
                <Text style={{ color: C.muted, fontSize: 13, margin: "0 0 8px" }}>
                  {el ? "Reputation Health" : "Reputation Health"}
                </Text>
                {props.intel.narrative && (
                  <Text style={{ fontSize: 13.5, color: C.body, margin: "0 0 16px", lineHeight: 1.5 }}>
                    {props.intel.narrative}
                  </Text>
                )}

                {/* What changed */}
                <Heading as="h2" style={{ fontSize: 15, color: C.aegean, margin: "0 0 6px", fontWeight: 700 }}>
                  {el ? "Τι άλλαξε" : "What changed"}
                </Heading>
                {[
                  {
                    label: el ? "Βαθμολογία (90 ημέρες)" : "Rating (90 days)",
                    value:
                      props.intel.ratingDelta === null
                        ? "—"
                        : `${props.intel.ratingDelta >= 0 ? "+" : ""}${props.intel.ratingDelta}`,
                  },
                  {
                    label: el ? "Απαντήσεις (90 ημέρες)" : "Response rate (90 days)",
                    value: props.intel.responseRate === null ? "—" : pct(props.intel.responseRate),
                  },
                  {
                    label: el ? "Αρνητικό σεντίμεντ (90 ημέρες)" : "Negative sentiment (90 days)",
                    value:
                      props.intel.negativeShare === null ? "—" : pct(props.intel.negativeShare),
                  },
                  props.intel.position
                    ? {
                        label: el ? "Θέση απέναντι σε ανταγωνιστές" : "Competitor position",
                        value: props.intel.position,
                      }
                    : null,
                  props.intel.topStrength
                    ? {
                        label: el ? "Κορυφαίο πλεονέκτημα" : "Top strength",
                        value: props.intel.topStrength,
                      }
                    : null,
                ]
                  .filter((r): r is { label: string; value: string } => r !== null)
                  .map((row) => (
                    <Section key={row.label} style={{ display: "block", padding: "5px 0" }}>
                      <Text style={{ fontSize: 13, color: C.muted, margin: 0 }}>{row.label}</Text>
                      <Text style={{ fontSize: 15, color: C.ink, fontWeight: 600, margin: 0 }}>
                        {row.value}
                      </Text>
                    </Section>
                  ))}

                {props.intel.recommendations.length > 0 && (
                  <>
                    <div style={{ height: 1, backgroundColor: C.line, margin: "14px 0" }} />
                    <Heading as="h2" style={{ fontSize: 15, color: C.aegean, margin: "0 0 8px", fontWeight: 700 }}>
                      {el ? "Προτεινόμενες ενέργειες" : "Recommended actions"}
                    </Heading>
                    {props.intel.recommendations.slice(0, 3).map((rec) => (
                      <Text key={rec.title} style={{ fontSize: 13.5, color: C.body, margin: "0 0 6px" }}>
                        → {rec.title}
                      </Text>
                    ))}
                  </>
                )}

                <div style={{ height: 1, backgroundColor: C.line, margin: "16px 0" }} />
              </>
            )}

            {/* Big metric — Georgia for numerals (§9.8) */}
            <Text style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 32, fontWeight: 700, color: C.aegean, margin: "0 0 2px" }}>
              {m.rating.toFixed(1)} / 5
            </Text>
            <Text style={{ color: C.muted, fontSize: 13, margin: "0 0 20px" }}>
              {el
                ? `${m.reviewCount} κριτικές συνολικά · ${m.velocity} νέες αυτό το 30ήμερο`
                : `${m.reviewCount} reviews total · ${m.velocity} new in the last 30 days`}
            </Text>

            <div style={{ height: 1, backgroundColor: C.line, margin: "16px 0" }} />

            {[
              {
                label: el ? "Νέες κριτικές (30 ημέρες)" : "New reviews (30 days)",
                value: String(m.velocity),
              },
              {
                label: el ? "Απαντήθηκαν (90 ημέρες)" : "Answered (90 days)",
                value: pct(m.responseRate),
              },
              {
                label: el ? "Αρνητικό σεντίμεντ" : "Negative sentiment",
                value: pct(m.sentimentShare.negative),
              },
              {
                label: el ? "Κριτικές χωρίς απάντηση" : "Reviews awaiting a reply",
                value: String(m.unanswered),
              },
              {
                label: el ? "Κύριο παράπονο" : "Top complaint",
                value: `${m.topComplaintLabel}${m.complaintTrend > 0 ? " ↗" : ""}`,
              },
              {
                label: el ? "Κύριο θετικό σχόλιο" : "Top compliment",
                value: m.topComplimentLabel,
              },
            ].map((row) => (
              <Section key={row.label} style={{ display: "block", padding: "7px 0" }}>
                <Text style={{ fontSize: 13, color: C.muted, margin: 0 }}>{row.label}</Text>
                <Text style={{ fontSize: 15, color: C.ink, fontWeight: 600, margin: 0 }}>
                  {row.value}
                </Text>
              </Section>
            ))}

            {props.insights.length > 0 && (
              <>
                <div style={{ height: 1, backgroundColor: C.line, margin: "16px 0" }} />
                <Heading as="h2" style={{ fontSize: 15, color: C.aegean, margin: "0 0 10px", fontWeight: 700 }}>
                  {el ? "Τι να κάνετε αυτή την εβδομάδα" : "What to do this week"}
                </Heading>
                {props.insights.slice(0, 3).map((insight) => (
                  <Section key={insight.key} style={{ padding: "10px 14px", backgroundColor: "#f2efe9", borderRadius: 8, marginBottom: 8 }}>
                    <Text style={{ fontSize: 14, fontWeight: 600, color: C.ink, margin: "0 0 3px" }}>
                      {insight.title}
                    </Text>
                    <Text style={{ fontSize: 12.5, color: C.muted, margin: "0 0 5px" }}>
                      {insight.evidence}
                    </Text>
                    <Text style={{ fontSize: 13, color: C.aegean, margin: 0 }}>
                      → {insight.suggestedAction}
                    </Text>
                  </Section>
                ))}
              </>
            )}

            {/* Padded-table CTA button (bulletproof) */}
            <Section style={{ textAlign: "center", marginTop: 24 }}>
              <a
                href={`${appUrl}/${props.locale}/dashboard`}
                style={{ display: "inline-block", backgroundColor: C.aegean, color: "#ffffff", fontSize: 15, fontWeight: 600, textDecoration: "none", padding: "13px 28px", borderRadius: 8 }}
              >
                {el ? "Άνοιγμα πίνακα ελέγχου" : "Open the dashboard"}
              </a>
            </Section>
          </Section>

          <Text style={{ fontSize: 11, color: C.muted, margin: "14px 8px" }}>
            {el
              ? "Λάβατε αυτό το email επειδή είστε πελάτης. Αλλαγή προτιμήσεων:"
              : "You receive this email as a customer. Manage preferences:"}{" "}
            <Link href={`${appUrl}/${props.locale}/settings`} style={{ color: C.aegean }}>
              {el ? "ρυθμίσεις" : "settings"}
            </Link>
            {" · "}
            {el ? "Στάλθηκε από το Atterna · Αθήνα" : "Sent by Atterna · Athens"}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export async function renderWeeklyEmail(props: WeeklyEmailProps): Promise<string> {
  return render(<WeeklyEmail {...props} />);
}

export default WeeklyEmail;
