// src/emails/weekly.tsx — the weekly report email (retention surface)
import { Html, Head, Body, Container, Section, Heading, Text, Hr, Link, Preview, render } from "@react-email/components";
import type { DashboardMetrics, Insight } from "@/lib/metrics";

export interface WeeklyEmailProps {
  locale: string;
  businessName: string;
  metrics: DashboardMetrics;
  insights: Insight[];
  appUrl?: string;
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

export function WeeklyEmail(props: WeeklyEmailProps) {
  const el = props.locale !== "en";
  const appUrl = props.appUrl ?? process.env.APP_URL ?? "https://app.example.gr";
  const m = props.metrics;

  return (
    <Html lang={el ? "el" : "en"}>
      <Head />
      <Preview>
        {el ? `${props.businessName}: βαθμολογία ${m.rating.toFixed(1)} · ${m.reviewCount} κριτικές` : `${props.businessName}: rating ${m.rating.toFixed(1)} · ${m.reviewCount} reviews`}
      </Preview>
      <Body style={{ backgroundColor: "#f5f8fc", fontFamily: "Helvetica, Arial, sans-serif", margin: 0 }}>
        <Container style={{ maxWidth: "560px", margin: "0 auto", padding: "24px 16px" }}>
          <Section style={{ backgroundColor: "#ffffff", borderRadius: 10, padding: "24px", border: "1px solid #c0d0e2" }}>
            <Heading as="h1" style={{ fontSize: 20, color: "#142840", margin: "0 0 4px" }}>
              {el ? "Εβδομαδιαία αναφορά φήμης" : "Weekly reputation report"}
            </Heading>
            <Text style={{ color: "#5a7a96", fontSize: 13, margin: "0 0 16px" }}>{props.businessName}</Text>
            <Text style={{ fontSize: 26, fontWeight: 700, color: "#1a4a7a", margin: "0 0 2px" }}>{m.rating.toFixed(1)} / 5</Text>
            <Text style={{ color: "#5a7a96", fontSize: 13, margin: "0 0 16px" }}>
              {el ? `${m.reviewCount} κριτικές συνολικά · ${m.velocity} νέες αυτό το 30ήμερο` : `${m.reviewCount} reviews total · ${m.velocity} new in the last 30 days`}
            </Text>

            <Hr style={{ borderColor: "#c0d0e2", margin: "16px 0" }} />

            {[
              { label: el ? "Νέες κριτικές (30 ημέρες)" : "New reviews (30 days)", value: String(m.velocity) },
              { label: el ? "Απαντήθηκαν (90 ημέρες)" : "Answered (90 days)", value: pct(m.responseRate) },
              { label: el ? "Αρνητικό σεντίμεντ" : "Negative sentiment", value: pct(m.sentimentShare.negative) },
              { label: el ? "Κριτικές χωρίς απάντηση" : "Reviews awaiting a reply", value: String(m.unanswered) },
              { label: el ? "Κύριο παράπονο" : "Top complaint", value: `${m.topComplaintLabel}${m.complaintTrend > 0 ? " ↗" : ""}` },
              { label: el ? "Κύριο θετικό σχόλιο" : "Top compliment", value: m.topComplimentLabel },
            ].map((row) => (
              <Section key={row.label} style={{ display: "block", padding: "6px 0" }}>
                <Text style={{ fontSize: 13, color: "#5a7a96", margin: 0 }}>{row.label}</Text>
                <Text style={{ fontSize: 15, color: "#142840", fontWeight: 600, margin: 0 }}>{row.value}</Text>
              </Section>
            ))}

            {props.insights.length > 0 && (
              <>
                <Hr style={{ borderColor: "#c0d0e2", margin: "16px 0" }} />
                <Heading as="h2" style={{ fontSize: 15, color: "#1a4a7a", margin: "0 0 8px" }}>
                  {el ? "Τι να κάνετε αυτή την εβδομάδα" : "What to do this week"}
                </Heading>
                {props.insights.slice(0, 3).map((insight) => (
                  <Section key={insight.key} style={{ padding: "8px 12px", backgroundColor: "#edf2f9", borderRadius: 8, marginBottom: 8 }}>
                    <Text style={{ fontSize: 14, fontWeight: 600, color: "#142840", margin: "0 0 2px" }}>{insight.title}</Text>
                    <Text style={{ fontSize: 12.5, color: "#5a7a96", margin: "0 0 4px" }}>{insight.evidence}</Text>
                    <Text style={{ fontSize: 13, color: "#1a4a7a", margin: 0 }}>→ {insight.suggestedAction}</Text>
                  </Section>
                ))}
              </>
            )}

            <Hr style={{ borderColor: "#c0d0e2", margin: "16px 0" }} />
            <Link href={`${appUrl}/${props.locale}/dashboard`} style={{ color: "#2d7ab3", fontSize: 14 }}>
              {el ? "Άνοιγμα πίνακα ελέγχου" : "Open the dashboard"}
            </Link>
          </Section>

          <Text style={{ fontSize: 11, color: "#5a7a96", margin: "12px 4px" }}>
            {el ? "Λάβατε αυτό το email επειδή είστε πελάτης. Αλλαγή προτιμήσεων:" : "You receive this email as a customer. Manage preferences:"}{" "}
            <Link href={`${appUrl}/${props.locale}/settings`} style={{ color: "#2d7ab3" }}>
              {el ? "ρυθμίσεις" : "settings"}
            </Link>
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