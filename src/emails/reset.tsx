// src/emails/reset.tsx — password reset email (single-use link, 1h)
// Minimal per §9.8: instruction line, CTA button, 60-minute expiry note,
// wordmark header + terracotta rule. No images.
import {
  Html, Head, Body, Container, Section, Heading, Text, Button, Preview,
} from "@react-email/components";
import { render } from "@react-email/components";

export interface ResetEmailProps {
  locale: string;
  resetUrl: string;
  minutesValid?: number;
}

const C = {
  canvas: "#faf9f7",
  card: "#ffffff",
  ink: "#12283f",
  muted: "#66788b",
  line: "#e7e2d8",
  aegean: "#175e9e",
  terracotta: "#c05b33",
};

export function ResetEmail(props: ResetEmailProps) {
  const el = props.locale !== "en";
  const minutes = props.minutesValid ?? 60;
  return (
    <Html lang={el ? "el" : "en"}>
      <Head />
      <Preview>
        {el ? "Επαναφορά κωδικού πρόσβασης" : "Password reset"}
      </Preview>
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
            <Heading as="h1" style={{ fontSize: 18, color: C.ink, margin: "0 0 10px", fontWeight: 700 }}>
              {el ? "Επαναφορά κωδικού πρόσβασης" : "Password reset"}
            </Heading>
            <Text style={{ fontSize: 14, color: C.ink, margin: "0 0 8px", lineHeight: 1.6 }}>
              {el
                ? "Ζητήθηκε επαναφορά του κωδικού σας. Ο σύνδεσμος ισχύει για"
                : "A password reset was requested for your account. The link is valid for"}{" "}
              <strong>{minutes} {el ? "λεπτά" : "minutes"}</strong>{" "}
              {el ? "και μπορεί να χρησιμοποιηθεί μία φορά." : "and can be used once."}
            </Text>
            <Text style={{ fontSize: 13, color: C.muted, margin: "0 0 20px", lineHeight: 1.6 }}>
              {el
                ? "Αν δεν το ζητήσατε εσείς, αγνοήστε αυτό το email — ο κωδικός σας δεν αλλάζει."
                : "If you did not request this, ignore the email — your password stays unchanged."}
            </Text>
            <Section style={{ textAlign: "center" }}>
              <Button
                href={props.resetUrl}
                style={{ backgroundColor: C.aegean, color: "#ffffff", padding: "13px 24px", borderRadius: 8, fontSize: 15, fontWeight: 600, textDecoration: "none" }}
              >
                {el ? "Ορισμός νέου κωδικού" : "Set a new password"}
              </Button>
            </Section>
          </Section>

          <Text style={{ fontSize: 11, color: C.muted, margin: "14px 8px" }}>
            {el ? "Στάλθηκε από το Atterna · Αθήνα" : "Sent by Atterna · Athens"}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export async function renderResetEmail(props: ResetEmailProps): Promise<string> {
  return render(<ResetEmail {...props} />);
}

export default ResetEmail;
