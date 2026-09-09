// src/lib/reputation/refresh.ts — the intelligence refresh orchestrator.
// One entry point, idempotent, safe to run after every import/sync or on
// the daily cron: themes → issue detection → recommendation sync →
// deterministic score snapshot. AI summaries are NOT generated here — they
// are lazily fetched with a data fingerprint (see ai/insights.ts, §16).
import { prisma } from "@/lib/db";
import { getThemeStats, detectIssueCandidates, type IssueCandidate } from "./themes";
import { snapshotReputation } from "./score";

// ── Recommendation playbook: one deterministic action pack per theme ─────
// (spec §20 — evidence + steps + impact; the AI may later add nuance but
// the baseline action is always rule-based and explainable).
const REC_PLAYBOOK: Record<
  string,
  { title: { el: string; en: string }; steps: { el: string[]; en: string[] } }
> = {
  waiting_time: {
    title: { el: "Βελτιώστε την επικοινωνία για τον χρόνο αναμονής", en: "Improve waiting-time communication" },
    steps: {
      el: [
        "Εμφανίστε εκτιμώμενο χρόνο αναμονής στην είσοδο και στο Google profile.",
        "Ελέγξτε το πρόγραμμα προσωπικού για τις 2 πιο δυνατές ώρες.",
        "Εκπαιδεύστε το προσωπικό υποδοχής να ενημερώνει κάθε 10 λεπτά.",
      ],
      en: [
        "Display the expected wait time at the entrance and on the Google profile.",
        "Review staffing for the two busiest hours.",
        "Train front-desk staff to update waiting guests every 10 minutes.",
      ],
    },
  },
  service: {
    title: { el: "Ενισχύστε τη συνέπεια εξυπηρέτησης", en: "Strengthen service consistency" },
    steps: {
      el: [
        "Σύντομη καθημερινή συζήτηση 5' με το προσωπικό για τα σημερινά θέματα.",
        "Καταγράψτε τα 3 συχνότερα συμβάντα της εβδομάδας.",
        "Ορίστε ένα μέτρο επιτυχίας για την επόμενη εβδομάδα.",
      ],
      en: [
        "Hold a 5-minute daily staff huddle on today's issues.",
        "Log the week's three most frequent incidents.",
        "Set one success measure for next week.",
      ],
    },
  },
  food_quality: {
    title: { el: "Ελέγξτε την ποιότητα πιάτων που προκαλούν παράπονα", en: "Audit the dishes that draw complaints" },
    steps: {
      el: [
        "Επαληθεύστε την πρώτη ύλη των πιάτων που αναφέρονται.",
        "Δοκιμάστε τα πιάτα σε ώρα αιχμής, όχι μόνο το πρωί.",
        "Συμφωνήστε ένα standard για κάθε πιάτο-κλειδί.",
      ],
      en: [
        "Verify the ingredients of the dishes being named.",
        "Taste the dishes at peak time, not only in the morning.",
        "Agree on a standard for each key dish.",
      ],
    },
  },
  prices: {
    title: { el: "Επαληθεύστε την ανταγωνιστικότητα των τιμών", en: "Verify price competitiveness" },
    steps: {
      el: [
        "Συγκρίντε τιμοκατάλογο και μερίδες με 3 κοντινούς ανταγωνιστές.",
        "Ελέγξτε αν τα παράπονα αφορούν αξία ή ποσότητα.",
        "Προσαρμόστε ή εξηγήστε — μην αλλάζετε τυφλά.",
      ],
      en: [
        "Compare menu prices and portions with 3 nearby competitors.",
        "Check whether complaints are about value or quantity.",
        "Adjust or explain — never change blindly.",
      ],
    },
  },
  cleanliness: {
    title: { el: "Θωρήστε τη σε βάθος καθαριότητα", en: "Deep-check cleanliness" },
    steps: {
      el: [
        "Λίστα ελέγχου καθαριότητας με υπογραφή στο κλείσιμο κάθε βάρδιας.",
        "Βίντεο-έλεγχος των σημείων που αναφέρουν οι πελάτες.",
        "Μία διόρθωση αυτή την εβδομάδα, ορατή στον πελάτη.",
      ],
      en: [
        "Cleaning checklist with a sign-off at each shift close.",
        "Inspect the exact spots customers mention.",
        "One visible-to-guests fix this week.",
      ],
    },
  },
  booking: {
    title: { el: "Διορθώστε την επικοινωνία κρατήσεων", en: "Fix booking communication" },
    steps: {
      el: [
        "Αυτόματο SMS/email επιβεβαίωσης σε κάθε κράτηση.",
        "Ενημέρωση όταν αλλάζει ώρα/τραπέζι — όχι μόνο στο τέλος.",
        "Ημερήσιος έλεγχος για κρατήσεις χωρίς απάντηση.",
      ],
      en: [
        "Automatic SMS/email confirmation for every booking.",
        "Notify guests when time/table changes — not only at the end.",
        "Daily check for bookings left unanswered.",
      ],
    },
  },
  rooms: {
    title: { el: "Βελτιώστε τα δωμάτια που έρχονται υπό πίεση", en: "Improve the rooms under pressure" },
    steps: {
      el: [
        "Χαρτογραφήστε σε ποια δωμάτια εστιάζονται τα παράπονα.",
        "Προσωρινό κλείσιμο για ανακαίνιση των 2 πρώτων.",
        "Φωτογραφίστε ξανά μετά τη βελτίωση.",
      ],
      en: [
        "Map which rooms the complaints cluster on.",
        "Temporarily close the top two for refresh.",
        "Re-photograph after the improvement.",
      ],
    },
  },
  staff: {
    title: { el: "Ενισχύστε το προσωπικό που ξεχωρίζει", en: "Reinforce standout staff" },
    steps: {
      el: [
        "Επιλέξτε «πρεσβευτή πελάτη» της εβδομάδας με μικρή ανταμοιβή.",
        "Καταγράψτε τι κάνει διαφορετικά και κάντε το standard.",
        "Μοιραστείτε την επιτυχία με την ομάδα.",
      ],
      en: [
        "Nominate a weekly 'guest champion' with a small reward.",
        "Document what they do differently and standardize it.",
        "Share the win with the team.",
      ],
    },
  },
  atmosphere: {
    title: { el: "Μετρήστε και βελτιώστε την ατμόσφαιρα", en: "Measure and improve the atmosphere" },
    steps: {
      el: [
        "Ζητήστε από κάποιον εκτός επιχείρησης να καθίσει ως πελάτης.",
        "Μουσική, φωτισμός, θόρυβος σε ώρες αιχμής — μετρήστε τα.",
        "Μία αλλαγή τη φορά, με μέτρηση πριν/μετά.",
      ],
      en: [
        "Ask someone outside the business to sit as a guest.",
        "Music, lighting, noise at peak hours — measure them.",
        "One change at a time, with before/after measurement.",
      ],
    },
  },
  parking: {
    title: { el: "Λύστε το θέμα πάρκινγκ με πληροφόρηση", en: "Solve parking with information" },
    steps: {
      el: [
        "Χαρτογραφήστε τις 3 κοντινότερες εναλλακτικές λύσεις.",
        "Προσθέστε οδηγίες στο Google profile και στη σελίδα σας.",
        "Ενημερώστε τηλεφωνικά την κράτηση.",
      ],
      en: [
        "Map the three closest alternatives.",
        "Add directions to the Google profile and your page.",
        "Tell booked guests by phone.",
      ],
    },
  },
  noise: {
    title: { el: "Περιορίστε τον θόρυβο στις ώρες αιχμής", en: "Contain peak-hour noise" },
    steps: {
      el: [
        "Μετρήστε τον θόρυβο σε δύο βάρδιες.",
        "Προσαρμόστε τη διάταξη στα τραπέζια-δίσκους.",
        "Εξετάστε ηχομόνωση στα σημεία-κλειδιά.",
      ],
      en: [
        "Measure noise across two shifts.",
        "Adjust the layout around the loud spots.",
        "Consider acoustic treatment at key points.",
      ],
    },
  },
  location: {
    title: { el: "Μετατρέψτε την τοποθεσία σε πλεονέκτημα", en: "Turn the location into an advantage" },
    steps: {
      el: [
        "Οδηγίες πρόσβασης βήμα-βήμα στο profile.",
        "Σηματοδοτήστε τα στενά σημεία με φωτογραφίες.",
        "Συνεργασία με τοπικό parking/transfer.",
      ],
      en: [
        "Step-by-step directions on the profile.",
        "Signpost the tricky spots with photos.",
        "Partner with local parking/transfer.",
      ],
    },
  },
  equipment: {
    title: { el: "Αντικαταστήστε τον εξοπλισμό που αποτυγχάνει", en: "Replace failing equipment" },
    steps: {
      el: [
        "Λίστα βλαβών ανά μήνα από τα παράπονα.",
        "Προϋπολογισμός για τα 2 πιο συχνά.",
        "Πρόγραμμα συντήρησης, όχι μόνο επισκευές.",
      ],
      en: [
        "List failures per month from the complaints.",
        "Budget for the two most frequent.",
        "A maintenance schedule, not just repairs.",
      ],
    },
  },
  safety: {
    title: { el: "Άμεσος έλεγχος ζητημάτων ασφάλειας", en: "Immediate safety-issue review" },
    steps: {
      el: [
        "Επιθεώρηση TODAY στα σημεία που αναφέρθηκαν.",
        "Καταγραφή διορθώσεων με ημερομηνία.",
        "Επικοινωνία διόρθωσης στην απάντηση της κριτικής.",
      ],
      en: [
        "Inspect the reported spots TODAY.",
        "Log the fixes with dates.",
        "Communicate the fix in the review reply.",
      ],
    },
  },
  value: {
    title: { el: "Διευκρινίστε την αξία προς τους πελάτες", en: "Clarify value for customers" },
    steps: {
      el: [
        "Συγκρίντε τιμή/ποιότητα με τον τοπικό μέσο όρο.",
        "Προσθέστε «γιατί» στην τιμή (πρώτη ύλη, χρόνος).",
        "Δοκιμάστε ένα μικρό δώρο με το βασικό.",
      ],
      en: [
        "Compare price/quality with the local average.",
        "Add the 'why' behind the price (ingredients, time).",
        "Try a small add-on with the core item.",
      ],
    },
  },
  other: {
    title: { el: "Αντιμετωπίστε το επαναλαμβανόμενο θέμα", en: "Address the recurring topic" },
    steps: {
      el: [
        "Διαβάστε 3-4 πρόσφατες κριτικές της κατηγορίας.",
        "Αποφασίστε ΜΙΑ αλλαγή αυτή την εβδομάδα.",
        "Μετρήστε ξανά σε 30 ημέρες.",
      ],
      en: [
        "Read 3-4 recent reviews in this category.",
        "Decide ONE change this week.",
        "Re-measure in 30 days.",
      ],
    },
  },
};

function playbookFor(category: string) {
  return REC_PLAYBOOK[category] ?? REC_PLAYBOOK.other;
}

export interface RefreshSummary {
  score: number;
  issuesOpen: number;
  issuesResolved: number;
  recommendationsOpen: number;
}

/**
 * Sync detected issue candidates into Issue rows.
 * - candidates are upserted on (businessId, category, kind): metrics and
 *   lastSeen refresh, the owner's status is PRESERVED;
 * - OPEN issues that no longer qualify auto-resolve (the loop closes
 *   itself when a problem stops recurring);
 * - DISMISSED issues stay dismissed regardless of detection.
 */
export async function syncIssues(
  businessId: string,
  candidates: IssueCandidate[],
  orgId?: string
): Promise<{ created: number; resolved: number }> {
  const organizationId = orgId ?? (await businessOrg(businessId));
  const existing = await prisma.issue.findMany({ where: { businessId } });
  const candidateKeys = new Set(candidates.map((c) => `${c.category}|${c.kind}`));

  let created = 0;
  let resolved = 0;
  for (const candidate of candidates) {
    const match = existing.find(
      (i) => i.category === candidate.category && i.kind === candidate.kind
    );
    if (!match) {
      await prisma.issue.create({
        data: {
          organizationId,
          businessId,
          category: candidate.category,
          kind: candidate.kind,
          severity: candidate.severity,
          mentionsCurrent: candidate.mentionsCurrent,
          mentionsPrevious: candidate.mentionsPrevious,
          trend: candidate.trend,
          status: "OPEN",
          sources: candidate.sources,
          firstDetectedAt: candidate.firstSeen,
          lastSeenAt: candidate.lastSeen,
        },
      });
      created++;
    } else {
      await prisma.issue.update({
        where: { id: match.id },
        data: {
          severity: candidate.severity,
          mentionsCurrent: candidate.mentionsCurrent,
          mentionsPrevious: candidate.mentionsPrevious,
          trend: candidate.trend,
          sources: candidate.sources,
          lastSeenAt: candidate.lastSeen,
        },
      });
    }
  }

  for (const issue of existing) {
    if (issue.status !== "OPEN") continue;
    if (candidateKeys.has(`${issue.category}|${issue.kind}`)) continue;
    // Stopped qualifying → auto-resolve the feedback loop.
    await prisma.issue.update({
      where: { id: issue.id },
      data: { status: "RESOLVED", updatedAt: new Date() },
    });
    await prisma.recommendation.updateMany({
      where: { issueId: issue.id, source: "RULES", status: { in: ["OPEN", "IN_PROGRESS"] } },
      data: { status: "RESOLVED", resolvedAt: new Date(), updatedAt: new Date() },
    });
    resolved++;
  }
  return { created, resolved };
}

async function businessOrg(businessId: string): Promise<string> {
  const business = await prisma.business.findUniqueOrThrow({
    where: { id: businessId },
    select: { organizationId: true },
  });
  return business.organizationId;
}

/**
 * Ensure every OPEN/IN_PROGRESS issue with severity ≥ MEDIUM carries one
 * open RULES recommendation (deduped per issue). When the issue resolves,
 * syncIssues closes its recommendations. Titles/steps are stored in the
 * business's own locale (Business.locale).
 */
export async function syncRecommendations(businessId: string): Promise<number> {
  const business = await prisma.business.findUniqueOrThrow({
    where: { id: businessId },
    select: { organizationId: true, locale: true },
  });
  const orgId = business.organizationId;
  const locale = business.locale === "EN" ? "en" : "el";
  const issues = await prisma.issue.findMany({
    where: { businessId, status: { in: ["OPEN", "IN_PROGRESS"] } },
  });
  let open = 0;
  for (const issue of issues) {
    if (issue.severity === "LOW") continue;
    const playbook = playbookFor(issue.category);
    const title = locale === "en" ? playbook.title.en : playbook.title.el;
    const steps = locale === "en" ? playbook.steps.en : playbook.steps.el;
    const existing = await prisma.recommendation.findFirst({
      where: { issueId: issue.id, source: "RULES", status: { in: ["OPEN", "IN_PROGRESS"] } },
    });
    if (existing) {
      await prisma.recommendation.update({
        where: { id: existing.id },
        data: {
          impact: issue.severity,
          evidence: {
            mentions: issue.mentionsCurrent,
            window: issue.kind === "EMERGING" ? "30d" : "90d",
            trend: issue.trend,
            sources: issue.sources,
          } as object,
          updatedAt: new Date(),
        },
      });
      open++;
      continue;
    }
    await prisma.recommendation.create({
      data: {
        organizationId: orgId,
        businessId,
        issueId: issue.id,
        title,
        impact: issue.severity,
        steps,
        status: "OPEN",
        source: "RULES",
        evidence: {
          mentions: issue.mentionsCurrent,
          window: issue.kind === "EMERGING" ? "30d" : "90d",
          trend: issue.trend,
          sources: issue.sources,
        } as object,
      },
    });
    open++;
  }
  return open;
}

/**
 * Full deterministic refresh for one business. Idempotent; call after
 * imports/syncs and from the daily intel cron.
 */
export async function refreshBusinessIntelligence(
  businessId: string
): Promise<RefreshSummary> {
  const orgId = await businessOrg(businessId);
  const stats = await getThemeStats(orgId, businessId);
  const candidates = detectIssueCandidates(stats);
  await syncIssues(businessId, candidates, orgId);
  const recommendationsOpen = await syncRecommendations(businessId);
  const score = await snapshotReputation(orgId, businessId);
  const [issuesOpen, issuesResolvedCount] = await Promise.all([
    prisma.issue.count({ where: { businessId, status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    prisma.issue.count({ where: { businessId, status: "RESOLVED" } }),
  ]);
  return {
    score: score.score,
    issuesOpen,
    issuesResolved: issuesResolvedCount,
    recommendationsOpen,
  };
}
