// src/emails/reset.tsx — password reset email (single-use link, 1h)
import { Html, Head, Body, Container, Section, Heading, Text, Button, Preview, render } from "@react-email/components";

export interface ResetEmailProps {
  locale: string;
  resetUrl: string;
  minutesValid?: number;
}

export function ResetEmail(props: ResetEmailProps) {
  const el = props.locale !== "en";
  const minutes = props.minutesValid ?? 60;

  return (
    <Html lang={el ? "el" : "en"}>
      <Head />
      <Preview>{el ? "Επαναφορά κωδικού πρόσβασης" : "Password reset"}</Preview>
      <Body style={{ backgroundColor: "#f5f8fc", fontFamily: "Helvetica, Arial, sans-serif", margin: 0 }}>
        <Container style={{ maxWidth: "560px", margin: "0 auto", padding: "24px 16px" }}>
          <Section style={{ backgroundColor: "#ffffff", borderRadius: 10, padding: "24px", border: "1px solid #c0d0e2" }}>
            <Heading as="h1" style={{ fontSize: 18, color: "#142840", margin: "0 0 8px" }}>
              {el ? "Επαναφορά κωδικού πρόσβασης" : "Password reset"}
            </Heading>
            <Text style={{ fontSize: 14, color: "#142840", margin: "0 0 8px" }}>
              {el
                ? "Ζητήθηκε επαναφορά του κωδικού σας. Ο σύνδεσμος ισχύει για"
                : "A password reset was requested for your account. The link is valid for"}{" "}
              {minutes} {el ? "λεπτά και μπορεί να χρησιμοποιηθεί μία φορά." : "minutes and can be used once."}
            </Text>
            <Text style={{ fontSize: 13, color: "#5a7a96", margin: "0 0 16px" }}>
              {el
                ? "Αν δεν το ζητήσατε εσείς, αγνοήστε αυτό το email — ο κωδικός σας δεν αλλάζει."
                : "If you did not request this, ignore the email — your password stays unchanged."}
            </Text>
            <Button href={props.resetUrl} style={{ backgroundColor: "#2d7ab3", color: "#ffffff", padding: "12px 20px", borderRadius: 8, fontSize: 15, textDecoration: "none" }}>
              {el ? "Ορισμός νέου κωδικού" : "Set a new password"}
            </Button>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export async function renderResetEmail(props: ResetEmailProps): Promise<string> {
  return render(<ResetEmail {...props} />);
}

export default ResetEmail;