// src/emails/alert.tsx — owner alert email (negative review, QR
// complaint, verification link). Renders with escaped values only
// (Section 37 XSS rule: email HTML built from templates — react-email
// escapes text children by design). Shares the weekly header pattern:
// wordmark + 2px terracotta rule, porcelain canvas, white card.
import {
  Html, Head, Body, Container, Section, Heading, Text, Button, Preview,
} from "@react-email/components";
import { render } from "@react-email/components";

export interface AlertEmailProps {
  locale: string;
  kind: "negative-review" | "qr-feedback" | "verify";
  businessName?: string;
  rating?: number;
  comment?: string | null;
  label?: string;
  verifyUrl?: string;
}

const C = {
  canvas: "#faf9f7",
  card: "#ffffff",
  ink: "#12283f",
  body: "#31445a",
  muted: "#66788b",
  line: "#e7e2d8",
  aegean: "#175e9e",
  terracotta: "#c05b33",
  danger: "#c23b2e",
};

export function AlertEmail(props: AlertEmailProps) {
  const el = props.locale !== "en";
  const title =
    props.kind === "negative-review"
      ? el ? "Νέα αρνητική κριτική" : "New negative review"
      : props.kind === "qr-feedback"
        ? el ? "Ιδιωτική ανατροφοδότηση πελάτη" : "Private guest feedback"
        : el ? "Επιβεβαιώστε το email σας" : "Confirm your email";

  return (
    <Html lang={el ? "el" : "en"}>
      <Head />
      <Preview>{title}</Preview>
      <Body style={{ backgroundColor: C.canvas, fontFamily: "Helvetica, Arial, sans-serif", margin: 0 }}>
        <Container style={{ maxWidth: "600px", margin: "0 auto", padding: "24px 16px" }}>
          {/* Wordmark header + 2px terracotta rule */}
          <Section style={{ padding: "0 8px 12px" }}>
            <Text style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 20, fontWeight: 700, color: C.ink, margin: 0 }}>
              Atterna<span style={{ color: C.terracotta }}>.</span>
            </Text>
          </Section>
          <div style={{ height: 2, backgroundColor: C.terracotta, margin: "0 8px 20px" }} />

          <Section bgcolor={C.card} style={{ borderRadius: 12, border: `1px solid ${C.line}`, padding: "28px" }}>
            <Heading as="h1" style={{ fontSize: 18, color: C.ink, margin: "0 0 8px", fontWeight: 700 }}>
              {title}
            </Heading>

            {props.businessName && (
              <Text style={{ color: C.muted, fontSize: 13, margin: "0 0 14px" }}>
                {props.businessName}
                {props.label ? ` · ${props.label}` : ""}
              </Text>
            )}

            {props.rating !== undefined && (
              <Text style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 28, fontWeight: 700, color: props.rating <= 3 ? C.danger : C.aegean, margin: "0 0 10px" }}>
                {props.rating} / 5
              </Text>
            )}

            {props.comment && (
              <Section style={{ backgroundColor: "#f2efe9", borderRadius: 8, padding: "14px", border: `1px solid ${C.line}` }}>
                <Text style={{ fontSize: 13.5, color: C.body, margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                  {props.comment.slice(0, 600)}
                </Text>
              </Section>
            )}

            {props.kind === "qr-feedback" && (
              <Text style={{ fontSize: 13, color: C.muted, margin: "14px 0 0", lineHeight: 1.6 }}>
                {el
                  ? "Ο πελάτης μοιράστηκε αυτό ιδιωτικά — απαντήστε όσο είναι ακόμα εκεί."
                  : "The guest shared this privately — respond while they are still there."}
              </Text>
            )}

            {props.kind === "verify" && props.verifyUrl && (
              <Section style={{ textAlign: "center", marginTop: 20 }}>
                <Button
                  href={props.verifyUrl}
                  style={{ backgroundColor: C.aegean, color: "#ffffff", padding: "13px 24px", borderRadius: 8, fontSize: 15, fontWeight: 600, textDecoration: "none" }}
                >
                  {el ? "Επιβεβαίωση email" : "Confirm email"}
                </Button>
              </Section>
            )}
          </Section>

          <Text style={{ fontSize: 11, color: C.muted, margin: "14px 8px" }}>
            {el ? "Στάλθηκε από το Atterna · Αθήνα" : "Sent by Atterna · Athens"}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export async function renderAlertEmail(props: AlertEmailProps): Promise<string> {
  return render(<AlertEmail {...props} />);
}

/** Step 7: plain-text alternative (spam scoring + accessibility). */
export async function renderAlertEmailText(props: AlertEmailProps): Promise<string> {
  return render(<AlertEmail {...props} />, { plainText: true });
}

export default AlertEmail;
