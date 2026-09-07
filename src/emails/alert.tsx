// src/emails/alert.tsx — owner alert email (negative review, QR complaint,
// verification link). Renders with escaped values only (Section 37 XSS
// rule: email HTML built from templates, never raw interpolation of
// user content — react-email escapes text children by design).
import {
Html, Head, Body, Container, Section, Heading, Text, Link, Button, Preview,
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
<Body style={{ backgroundColor: "#f5f8fc", fontFamily: "Helvetica, Arial, sans-serif",
margin: 0 }}>
<Container style={{ maxWidth: "560px", margin: "0 auto", padding: "24px 16px" }}>
<Section style={{ backgroundColor: "#ffffff", borderRadius: 10, padding: "24px",
border: "1px solid #c0d0e2" }}>
<Heading as="h1" style={{ fontSize: 18, color: "#142840", margin: "0 0 8px" }}>
{title}
</Heading>
{props.businessName && (
<Text style={{ color: "#5a7a96", fontSize: 13, margin: "0 0 12px" }}>
{props.businessName}
{props.label ? ` · ${props.label}` : ""}
</Text>
)}
{props.rating !== undefined && (
<Text style={{ fontSize: 22, fontWeight: 700, color: props.rating <= 3 ? "#a03434"
: "#1a4a7a", margin: "0 0 8px" }}>
{props.rating} / 5
</Text>
)}
{props.comment && (
<Section style={{ backgroundColor: "#edf2f9", borderRadius: 8, padding: "12px" }}>
<Text style={{ fontSize: 13.5, color: "#142840", margin: 0, whiteSpace:
"pre-wrap" }}>
{props.comment.slice(0, 600)}
</Text>
</Section>
)}
{props.kind === "qr-feedback" && (
<Text style={{ fontSize: 13, color: "#5a7a96", margin: "12px 0 0" }}>
{el
? "Ο πελάτης μοιράστηκε αυτό ιδιωτικά — απαντήστε όσο είναι ακόμα εκεί."
: "The guest shared this privately — respond while they are still there."}
</Text>
)}
{props.kind === "verify" && props.verifyUrl && (
<Button href={props.verifyUrl} style={{ backgroundColor: "#2d7ab3", color:
"#ffffff", padding: "12px 20px", borderRadius: 8, fontSize: 15, textDecoration: "none" }}>
{el ? "Επιβεβαίωση email" : "Confirm email"}
</Button>
)}
</Section>
</Container>
</Body>
</Html>
);
}
export async function renderAlertEmail(props: AlertEmailProps): Promise<string> {
return render(<AlertEmail {...props} />);
}
export default AlertEmail;