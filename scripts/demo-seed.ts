// scripts/demo-seed.ts — realistic demo dataset (spec §11)
//
// Three businesses with 24 months of multi-source reviews:
//   Taverna «Κύμα» (Χανιά)      ~240 reviews — google/tripadvisor/booking/csv
//   Hotel «Αστέρι» (Χαλκιδική)  ~380 reviews — booking/google/tripadvisor/expedia
//   Οδοντιατρείο «Χαμόγελο»     ~140 reviews — google/manual/csv
//
// Realistic by design: seasonal volume (Greek tourism curve), rating
// distributions, recurring praise/complaint themes, an EMERGING issue on
// purpose (booking communication at the taverna), answered/unanswered
// reviews, mixed languages (el/en/de). Every review ships with its
// ReviewAnalysis row (we generated it — the data IS the ground truth), so
// the whole intelligence pipeline (themes, issues, recommendations,
// health score, seasonal YoY) works with ZERO API keys.
//
// Idempotent: upserts keyed by fixed external ids / natural keys — run it
// twice, nothing duplicates. Health-score history is backfilled by
// recomputing the deterministic score as-of each past day (real data,
// honest timeline).
//
// Usage:  DATABASE_URL=postgres://… pnpm tsx scripts/demo-seed.ts
// Login:  demo@atterna.gr / demo-password-123 (override via DEMO_PASSWORD)
import "dotenv/config";
import * as argon2 from "argon2";
import { prisma } from "../src/lib/db";
import { refreshBusinessIntelligence } from "../src/lib/reputation/refresh";
import {
  collectScoreInput,
  computeReputationScore,
} from "../src/lib/reputation/score";
import { CATEGORY_VOCAB } from "../src/ai/schemas";

// ── Deterministic RNG (same dataset on every run) ────────────────────────
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260909);
const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
const chance = (p: number) => rng() < p;

type Lang = "el" | "en" | "de";
type Theme = (typeof CATEGORY_VOCAB)[number];

interface BusinessProfile {
  name: string;
  category: string;
  city: string;
  baseMonthly: number;
  sources: [string, number][]; // [sourceKey, weight]
  langWeights: [Lang, number][];
  ratingWeights: [number, number][]; // [stars, weight]
  praise: Theme[];
  complaints: Theme[];
  // Deliberate emerging issue: complaint injections in the last 6 months
  // (oldest → newest) — spikes at the end.
  emerging?: { category: Theme; recent: [number, number, number, number, number, number] };
  competitors: { name: string; city?: string; rating: number; reviewCount: number }[];
}

const PROFILES: BusinessProfile[] = [
  {
    name: "Ταβέρνα «Κύμα»",
    category: "taverna",
    city: "Χανιά",
    baseMonthly: 10,
    sources: [
      ["google", 62],
      ["tripadvisor", 22],
      ["booking", 8],
      ["csv", 8],
    ],
    langWeights: [
      ["el", 62],
      ["en", 33],
      ["de", 5],
    ],
    ratingWeights: [
      [5, 44],
      [4, 32],
      [3, 12],
      [2, 8],
      [1, 4],
    ],
    praise: ["staff", "food_quality", "location"],
    complaints: ["waiting_time", "service", "prices"],
    emerging: { category: "booking", recent: [0, 1, 0, 1, 2, 7] },
    competitors: [
      { name: "Ταβέρνα «Θάλασσα»", city: "Χανιά", rating: 4.3, reviewCount: 980 },
      { name: "«Λιμάνι» Fish Tavern", city: "Χανιά", rating: 4.1, reviewCount: 610 },
      { name: "Ostria Grill", city: "Χανιά", rating: 4.5, reviewCount: 540 },
    ],
  },
  {
    name: "Hotel «Αστέρι»",
    category: "hotel",
    city: "Χαλκιδική",
    baseMonthly: 16,
    sources: [
      ["booking", 45],
      ["google", 25],
      ["tripadvisor", 20],
      ["expedia", 10],
    ],
    langWeights: [
      ["en", 55],
      ["el", 25],
      ["de", 15],
    ],
    ratingWeights: [
      [5, 52],
      [4, 30],
      [3, 10],
      [2, 5],
      [1, 3],
    ],
    praise: ["location", "rooms", "staff"],
    complaints: ["rooms", "cleanliness", "value"],
    competitors: [
      { name: "Blue Bay Resort", city: "Χαλκιδική", rating: 4.6, reviewCount: 2100 },
      { name: "Villa Elena", city: "Χαλκιδική", rating: 4.4, reviewCount: 760 },
    ],
  },
  {
    name: "Οδοντιατρείο «Χαμόγελο»",
    category: "dental clinic",
    city: "Αθήνα",
    baseMonthly: 6,
    sources: [
      ["google", 75],
      ["manual", 15],
      ["csv", 10],
    ],
    langWeights: [
      ["el", 90],
      ["en", 10],
    ],
    ratingWeights: [
      [5, 68],
      [4, 22],
      [3, 6],
      [2, 3],
      [1, 1],
    ],
    praise: ["staff", "equipment", "value"],
    complaints: ["waiting_time", "prices"],
    competitors: [
      { name: "Dental Care Athens", city: "Αθήνα", rating: 4.7, reviewCount: 410 },
    ],
  },
];

// ── Greek tourism seasonality (volume multiplier per month) ──────────────
const SEASON_MULT: Record<number, number> = {
  1: 0.5, 2: 0.5, 3: 0.8, 4: 1.3, 5: 1.8, 6: 2.4,
  7: 3.0, 8: 2.8, 9: 2.0, 10: 1.2, 11: 0.7, 12: 0.6,
};
const CLINIC_SEASON: Record<number, number> = {
  1: 1.1, 2: 1.0, 3: 1.1, 4: 1.0, 5: 1.0, 6: 0.8,
  7: 0.6, 8: 0.6, 9: 1.0, 10: 1.2, 11: 1.2, 12: 1.0,
};

// ── Text banks (realistic, non-trivial — spec §11) ───────────────────────
const OPENERS: Record<Lang, string[]> = {
  el: [
    "Πηγάμε με την οικογένεια για μεσημεριανό και μείναμε πάνω από δύο ώρες.",
    "Δεύτερη φορά αυτό τον μήνα — και τις δύο φορές ξεχωρίσαμε.",
    "Μας το πρότειναν ντόπιοι και δεν το μετανιώσαμε καθόλου.",
    "Πήραμε τραπέζι τελευταία στιγμή ένα Σάββατο βράδυ.",
    "Επίσκεψη μετά από χρόνια και η διαφορά ήταν εμφανής.",
  ],
  en: [
    "We stopped by on our way through town and ended up staying for hours.",
    "Second visit this month — both times were memorable.",
    "Recommended by locals, and it absolutely lived up to it.",
    "Walked in last-minute on a busy Friday night.",
    "First time back in a couple of years, and the difference shows.",
  ],
  de: [
    "Wir kamen auf der Durchreise vorbei und blieben länger als geplant.",
    "Zum zweiten Mal in diesem Monat — beides ausgesprochen gut.",
  ],
};

const PRAISE_TEXT: Record<Theme, Record<Lang, string>> = {
  staff: {
    el: "Το προσωπικό ήταν εξαιρετικό — ευγενικό, γρήγορο και πρόθυμο να εξηγήσουν τα πιάτα.",
    en: "The staff were outstanding — warm, attentive and genuinely proud of the menu.",
    de: "Das Personal war hervorragend — aufmerksam und sehr freundlich.",
  },
  food_quality: {
    el: "Το φαγητό ξεπέρασε τις προσδοκίες: φρέσκια πρώτη ύλη, σωστό ψήσιμο και μερίδες που σε χορταίνουν.",
    en: "The food exceeded expectations: fresh ingredients, spot-on cooking, generous portions.",
    de: "Das Essen war frisch und ausgezeichnet zubereitet.",
  },
  location: {
    el: "Η τοποθεσία είναι το ατού: βλέμμα στη θάλασσα και το ηλιοβασίλεμα από το τραπέζι σου.",
    en: "The location is the trump card: sea view and the sunset right from your table.",
    de: "Die Lage ist wunderbar — mit Blick auf das Meer.",
  },
  rooms: {
    el: "Τα δωμάτια ήταν άνετα, καθαρά και με σωστή ηχομόνωση — κοιμήθηκε όλη η οικογένεια.",
    en: "The rooms were comfortable, spotless and quiet — the whole family slept through the night.",
    de: "Die Zimmer waren ruhig, sauber und komfortabel.",
  },
  cleanliness: {
    el: "Πεντακάθαρο παντού — ακόμα και οι κοινόχρηστοι χώροι λάμπουν.",
    en: "Spotless everywhere — even the shared spaces were gleaming.",
    de: "Überall sehr sauber.",
  },
  equipment: {
    el: "Σύγχρονος εξοπλισμός και οι εξηγήσεις πριν κάθε βήμα σε ηρεμούν.",
    en: "Modern equipment and they explain every step before it happens.",
    de: "Moderne Ausstattung, alles wurde erklärt.",
  },
  value: {
    el: "Η σχέση ποιότητας-τιμής είναι από τις καλύτερες που έχουμε συναντήσει.",
    en: "Value for money is among the best we've come across.",
    de: "Preis-Leistung stimmt absolut.",
  },
  atmosphere: {
    el: "Η ατμόσφαιρα σε κερδίζει: χαλαρή, ζεστή, χωρίς φασαρία.",
    en: "The atmosphere wins you over: relaxed, warm, no fuss.",
    de: "Die Atmosphäre ist entspannt und einladend.",
  },
  service: {
    el: "Η εξυπηρέτηση ήταν άψογη από το τηλεφώνημα μέχρι τον λογαριασμό.",
    en: "Service was flawless from the phone call to the bill.",
    de: "Der Service war einwandfrei.",
  },
  waiting_time: {
    el: "Μπήκαμε αμέσως χωρίς αναμονή.",
    en: "We were seated immediately, no wait.",
    de: "Wir mussten gar nicht warten.",
  },
  prices: {
    el: "Οι τιμές δίκαιες για αυτό που προσφέρουν.",
    en: "Prices felt fair for what you get.",
    de: "Faire Preise.",
  },
  parking: {
    el: "Βρήκαμε πάρκινγκ εύκολα δίπλα.",
    en: "Found parking easily right nearby.",
    de: "Parken war kein Problem.",
  },
  noise: {
    el: "Ήσυχο ακόμα και τις ώρες αιχμής.",
    en: "Quiet even at peak hours.",
    de: "Ruhig, auch zur Stoßzeit.",
  },
  booking: {
    el: "Η κράτηση έγινε άμεσα και μας επιβεβαίωσαν γρήγορα.",
    en: "Booking was instant and confirmation came quickly.",
    de: "Buchung und Bestätigung gingen schnell.",
  },
  safety: {
    el: "Ένιωσα απόλυτα ασφαλής σε κάθε βήμα.",
    en: "I felt completely safe throughout.",
    de: "Alles fühlte sich sehr sicher an.",
  },
  other: {
    el: "Σε γενικές γραμμές, μια πολύ καλή εμπειρία.",
    en: "All in all, a very good experience.",
    de: "Insgesamt sehr gut.",
  },
};

const COMPLAINT_TEXT: Record<string, Record<Lang, string>> = {
  waiting_time: {
    el: "Περάσαμε 50 λεπτά μέχρι να παραγγείλουμε και άλλα 30 για το κυρίως. Κανείς δεν μας ενημέρωσε για την καθυστέρηση.",
    en: "We waited 50 minutes just to order and another 30 for the main. Nobody acknowledged the delay.",
    de: "Wir haben fast eine Stunde auf die Bestellung gewartet.",
  },
  service: {
    el: "Η εξυπηρέτηση ήταν απόντα: χρειάστηκε να σηκωθούμε δύο φορές για να βρούμε σερβιτόρο.",
    en: "Service was absent — we had to get up twice to find a waiter.",
    de: "Der Service war unaufmerksam.",
  },
  prices: {
    el: "Οι τιμές έχουν ανέβει αισθητά χωρίς αντίστοιχη ποιότητα — το κυρίως για δύο βγήκε ακριβότερο από όσο αξίζει.",
    en: "Prices climbed noticeably without matching quality — dinner for two cost more than it should.",
    de: "Die Preise sind spürbar gestiegen.",
  },
  cleanliness: {
    el: "Το τραπέζι ήταν κολλώδες και το πάτωμα δεν είχε καθαριστεί. Στο δωμάτιο, η σκόνη στο ντους ήταν εμφανής.",
    en: "The table was sticky and the floor hadn't been cleaned. In the room, dust in the shower was visible.",
    de: "Die Sauberkeit lässt stark nach.",
  },
  rooms: {
    el: "Το δωμάτιο στον 3ο όροφο είχε φθορές: σπασμένο ράφι, βρύση που έσταζε και στρώμα που έτριβε σε κάθε κίνηση.",
    en: "Our room on the 3rd floor had wear and tear: a broken shelf, a dripping tap and a creaking mattress.",
    de: "Das Zimmer wies deutliche Abnutzung auf.",
  },
  value: {
    el: "Για όσα πληρώσαμε περιμέναμε περισσότερο — μοιάζει πλέον υπερτιμολογημένο.",
    en: "For what we paid we expected more — it now feels overpriced.",
    de: "Für den Preis zu wenig.",
  },
  booking: {
    el: "Η κράτηση χάθηκε. Μας είπαν «δεν υπάρχει στα συστήματα» ενώ κρατούσαμε το email επιβεβαίωσης. Περάσαμε 40 λεπτά μέχρι να βρεθεί τραπέζι.",
    en: "Our booking was lost. They said 'nothing in the system' while we held the confirmation email. 40 minutes until a table appeared.",
    de: "Unsere Reservierung war verschwunden.",
  },
  equipment: {
    el: "Ο εξοπλισμός φαίνεται παλιός σε κάποια σημεία.",
    en: "Some of the equipment looks dated.",
    de: "Teilweise veraltete Ausstattung.",
  },
  staff: {
    el: "Το προσωπικό ήταν βιαστικό και απόμακρο.",
    en: "Staff felt rushed and distant.",
    de: "Personal wirkte gehetzt.",
  },
  food_quality: {
    el: "Δύο πιάτα ήρθαν χλιαρά και το ψάρι δεν ήταν όσο φρέσκο έπρεπε.",
    en: "Two dishes arrived lukewarm and the fish wasn't as fresh as it should be.",
    de: "Zwei Gerichte kamen lauwarm.",
  },
  location: {
    el: "Η πρόσβαση είναι δύσκολη, ιδίως με αυτοκίνητο.",
    en: "Access is difficult, especially by car.",
    de: "Die Anfahrt ist schwierig.",
  },
  atmosphere: {
    el: "Πολύς θόρυβος από την κουζίνα.",
    en: "Too much noise from the kitchen.",
    de: "Zu laut.",
  },
  parking: {
    el: "Το πάρκινγκ είναι ανύπαρκτο τις ώρες αιχμής.",
    en: "Parking is nonexistent at peak times.",
    de: "Kein Parkplatz.",
  },
  noise: {
    el: "Η μουσική πολύ δυνατή για να μιλήσεις.",
    en: "Music far too loud to talk over.",
    de: "Musik zu laut.",
  },
  safety: {
    el: "Σκαλιά χωρίς φωτισμό — προσέξτε.",
    en: "Unlit steps — be careful.",
    de: "Unbeleuchtete Stufen.",
  },
  other: {
    el: "Είχε μικρά προβληματάκια που μαζί δημιουργούν εντύπωση απροσεξίας.",
    en: "A few small issues that together give a careless impression.",
    de: "Kleinere Mängel.",
  },
};

const NAMES: Record<Lang, string[]> = {
  el: ["Γιώργος", "Μαρία", "Νίκος", "Ελένη", "Δημήτρης", "Κατερίνα", "Στάθης", "Άννα", "Πέτρος", "Σοφία"],
  en: ["James", "Emma", "Michael", "Sarah", "David", "Laura", "Chris", "Anna", "Paul", "Helen"],
  de: ["Stefan", "Monika", "Klaus", "Sabine", "Thomas"],
};
const SURNAMES: Record<Lang, string[]> = {
  el: ["Π.", "Κ.", "Μ.", "Γ.", "Λ.", "Σ."],
  en: ["W.", "K.", "M.", "B.", "S."],
  de: ["M.", "S.", "B.", "K."],
};

function weighted<T>(pairs: [T, number][]): T {
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  let roll = rng() * total;
  for (const [value, weight] of pairs) {
    roll -= weight;
    if (roll <= 0) return value;
  }
  return pairs[pairs.length - 1][0];
}

function textFor(lang: Lang, rating: number, praise: Theme[], complaints: string[]): string {
  const parts: string[] = [pick(OPENERS[lang])];
  if (rating >= 4) {
    for (const theme of praise) parts.push(PRAISE_TEXT[theme][lang]);
  } else if (rating <= 3) {
    parts.push(COMPLAINT_TEXT[complaints[0] ?? "other"][lang]);
    if (complaints[1] && chance(0.4)) parts.push(COMPLAINT_TEXT[complaints[1]][lang]);
  } else {
    parts.push(PRAISE_TEXT[praise[0]][lang]);
    parts.push(COMPLAINT_TEXT[complaints[0] ?? "other"][lang]);
  }
  if (rating >= 4 && chance(0.5)) parts.push(PRAISE_TEXT.other[lang]);
  if (rating === 3) parts.push(PRAISE_TEXT.other[lang]);
  return parts.join(" ");
}

async function main() {
  const password = await argon2.hash(process.env.DEMO_PASSWORD || "demo-password-123");
  const user = await prisma.user.upsert({
    where: { email: "demo@atterna.gr" },
    update: { passwordHash: password, emailVerified: new Date(), locale: "EL" },
    create: {
      email: "demo@atterna.gr",
      passwordHash: password,
      emailVerified: new Date(),
      locale: "EL",
    },
  });
  const org = await prisma.organization.upsert({
    where: { id: "demo-org-atterna" },
    update: {},
    create: { id: "demo-org-atterna", name: "Atterna Demo" },
  });
  await prisma.membership.upsert({
    where: { userId_organizationId: { userId: user.id, organizationId: org.id } },
    update: {},
    create: { userId: user.id, organizationId: org.id, role: "OWNER" },
  });
  await prisma.subscription.upsert({
    where: { organizationId: org.id },
    update: { status: "ACTIVE" },
    create: {
      organizationId: org.id,
      planKey: "GROWTH",
      status: "ACTIVE",
      currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
    },
  });

  const now = new Date();
  const stats = { reviews: 0, analyses: 0, submissions: 0 };

  for (let p = 0; p < PROFILES.length; p++) {
    const profile = PROFILES[p];
    const businessId = `demo-biz-${p + 1}`;
    await prisma.business.upsert({
      where: { id: businessId },
      update: { name: profile.name, category: profile.category, city: profile.city },
      create: {
        id: businessId,
        organizationId: org.id,
        name: profile.name,
        category: profile.category,
        city: profile.city,
        locale: "EL",
      },
    });

    // Competitors (owner-confirmed, real-looking numbers)
    for (const comp of profile.competitors) {
      await prisma.competitor.upsert({
        where: { businessId_name: { businessId, name: comp.name } },
        update: { rating: comp.rating, reviewCount: comp.reviewCount, status: "CONFIRMED" },
        create: {
          organizationId: org.id,
          businessId,
          name: comp.name,
          city: comp.city ?? null,
          rating: comp.rating,
          reviewCount: comp.reviewCount,
          status: "CONFIRMED",
        },
      });
    }

    // ── Reviews across 24 months ────────────────────────────────────
    let counter = 0;
    for (let monthsAgo = 23; monthsAgo >= 0; monthsAgo--) {
      const monthDate = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo, 1)
      );
      const seasonTable = profile.category === "dental clinic" ? CLINIC_SEASON : SEASON_MULT;
      const mult = seasonTable[monthDate.getUTCMonth() + 1] ?? 1;
      const volume = Math.max(
        0,
        Math.round(profile.baseMonthly * mult * (0.8 + rng() * 0.4))
      );
      // Emerging-issue injections (extra booking complaints recently).
      const emergingNow =
        profile.emerging && monthsAgo < 6
          ? profile.emerging.recent[5 - monthsAgo]
          : 0;

      for (let i = 0; i < volume; i++) {
        counter++;
        const isEmerging = emergingNow > 0 && i < emergingNow;
        const day = 1 + Math.floor(rng() * 27);
        const receivedAt = new Date(
          Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth(), day,
            8 + Math.floor(rng() * 12), Math.floor(rng() * 60))
        );
        if (receivedAt > now) continue;
        const lang = weighted(profile.langWeights);
        const rating = weighted(profile.ratingWeights);
        const source = weighted(profile.sources);

        const complaints: string[] = isEmerging
          ? ["booking"]
          : profile.complaints.slice(0, 1 + (chance(0.35) ? 1 : 0));
        const praise: Theme[] = profile.praise.slice(
          0,
          1 + (chance(0.5) ? 1 : 0) + (chance(0.3) ? 1 : 0)
        );
        const text =
          textFor(lang, rating, praise, isEmerging ? ["booking"] : complaints);
        const reviewerName = `${pick(NAMES[lang])} ${pick(SURNAMES[lang])}`;

        const externalId = `demo-${p + 1}-${String(counter).padStart(4, "0")}`;
        // Older reviews are mostly answered; the recent month is mostly open.
        const ageDays = (now.getTime() - receivedAt.getTime()) / 86_400_000;
        const answered = ageDays > 50 ? chance(0.82) : ageDays > 10 ? chance(0.5) : chance(0.2);
        const repliedAt = answered
          ? new Date(receivedAt.getTime() + (4 + rng() * 60) * 3_600_000)
          : null;

        const review = await prisma.review.upsert({
          where: {
            businessId_source_externalId: { businessId, source, externalId },
          },
          update: { rating, text, reviewerName, repliedAt, language: lang },
          create: {
            organizationId: org.id,
            businessId,
            source,
            externalId,
            rating,
            text,
            language: lang,
            reviewerName,
            createdOnPlatform: receivedAt,
            receivedAt,
            repliedAt,
          },
        });
        stats.reviews++;

        // ── Seeded analysis (ground truth known at generation) ───────
        const sentiment =
          rating >= 4 ? "POSITIVE" : rating <= 2 ? "NEGATIVE" : chance(0.5) ? "NEGATIVE" : "NEUTRAL";
        const topics = [
          ...new Set([...praise, ...(rating <= 3 ? (complaints as Theme[]) : [])]),
        ].slice(0, 6);
        const analysisComplaints =
          rating <= 3 || isEmerging
            ? (isEmerging ? ["booking"] : complaints).map((c) => ({
                category: c,
                severity: rating <= 2 ? 5 : 4,
                summary: (COMPLAINT_TEXT[c]?.[lang] ?? COMPLAINT_TEXT.other[lang]).slice(0, 140),
              }))
            : [];
        const analysisCompliments =
          rating >= 4
            ? praise.map((c) => ({
                category: c,
                summary: PRAISE_TEXT[c][lang].slice(0, 140),
              }))
            : [];
        await prisma.reviewAnalysis.upsert({
          where: { reviewId: review.id },
          update: {
            sentiment,
            topics,
            complaints: analysisComplaints,
            compliments: analysisCompliments,
          },
          create: {
            reviewId: review.id,
            sentiment,
            urgency: sentiment === "NEGATIVE" && rating <= 2 ? "HIGH" : "LOW",
            language: lang,
            topics,
            complaints: analysisComplaints,
            compliments: analysisCompliments,
            actionable: sentiment === "NEGATIVE",
            promptVersion: "1",
            model: "seed",
          },
        });
        stats.analyses++;
      }
    }

    // ── QR feedback (first-party channel) ───────────────────────────
    const request = await prisma.feedbackRequest.upsert({
      where: { token: `demo-qr-${p + 1}` },
      update: { active: true },
      create: { businessId, token: `demo-qr-${p + 1}`, label: "Κάρτα τραπεζιού" },
    });
    const submissionCount = p === 0 ? 22 : p === 1 ? 12 : 5;
    await prisma.feedbackSubmission.deleteMany({
      where: { feedbackRequestId: request.id },
    });
    for (let i = 0; i < submissionCount; i++) {
      const daysAgo = Math.floor(rng() * 80);
      const rating = weighted([
        [5, 45],
        [4, 25],
        [3, 15],
        [2, 10],
        [1, 5],
      ]);
      await prisma.feedbackSubmission.create({
        data: {
          businessId,
          organizationId: org.id,
          feedbackRequestId: request.id,
          rating,
          comment:
            rating >= 4
              ? pick([
                  "Όλα τέλεια, ευχαριστούμε!",
                  "Πολύ καλή εμπειρία συνολικά.",
                  "Ευγενικό προσωπικό και γρήγορη εξυπηρέτηση.",
                ])
              : pick([
                  "Περιμέναμε αρκετά χωρίς ενημέρωση.",
                  "Το πρόβλημα δεν λύθηκε όπως περίμενα.",
                  "Δύσκολη επικοινωνία πριν την επίσκεψη.",
                ]),
          createdAt: new Date(Date.now() - daysAgo * 86_400_000),
        },
      });
      stats.submissions++;
    }
  }

  // ── Backfill 60 days of honest score history + refresh intelligence ────
  for (let p = 0; p < PROFILES.length; p++) {
    const businessId = `demo-biz-${p + 1}`;
    for (let daysAgo = 60; daysAgo >= 1; daysAgo--) {
      const asOf = new Date(Date.now() - daysAgo * 86_400_000);
      const input = await collectScoreInput(org.id, businessId, asOf);
      const result = computeReputationScore(input);
      const date = new Date(
        Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate())
      );
      await prisma.reputationSnapshot.upsert({
        where: { businessId_date: { businessId, date } },
        create: {
          businessId,
          date,
          score: result.score,
          breakdown: result as unknown as object,
        },
        update: { score: result.score, breakdown: result as unknown as object },
      });
    }
    const summary = await refreshBusinessIntelligence(businessId);
    console.log(
      `${PROFILES[p].name}: score ${summary.score}, open issues ${summary.issuesOpen}, open recommendations ${summary.recommendationsOpen}`
    );
  }

  console.log(
    `Seed complete: ${stats.reviews} reviews, ${stats.analyses} analyses, ${stats.submissions} QR submissions.`
  );
  console.log("Login: demo@atterna.gr / demo-password-123 (or DEMO_PASSWORD)");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
