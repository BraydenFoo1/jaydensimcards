/**
 * The original homepage's wording (index.php and script.js), in one place.
 * Text is verbatim unless marked "Changed:", which always gives the reason.
 * Every claim here is a joke about a fictional network.
 */

export const TICKER = [
  { label: "NETWORK STATUS", value: "DEGRADED (JAYDEN IS IN CLASS)", warn: true },
  { label: "UPTIME", value: "41.8% MONTH-TO-DATE" },
  { label: "TOWERS ONLINE", value: "1 OF 1" },
  { label: "PEAK LATENCY", value: "4,200ms" },
  { label: "OUTAGE", value: "BLK 402 LIFT LOBBY — ENGINEER SENT, ENGINEER LOST" },
  { label: "NOTICE", value: "5G ENABLED WHEREVER JAYDEN IS PHYSICALLY STANDING" },
] as const;

export const HERO = {
  // Changed: the original began "Powered by ABE ONG JUN WEI Technologies. In Partnership
  // with Braden WiFi Routers." Phase 2 decision: keep those names out of the main branding
  // until permission to use them is confirmed.
  eyebrow: "Trusted by 92653 people.",
  // Changed: the original read "Singapore's most confident mobile network. Real SIM cards,
  // real prices, and coverage that…". Phase 2 decision: remove "Real SIM cards, real prices".
  sub: "Singapore's most confident mobile network, with coverage that reaches almost the entire second floor of the block.",
  // The original showed 92643 here and 92653 in the line above; both kept as they were.
  stats: [
    { label: "Network", value: "5G*" },
    { label: "Customers", value: "92643" },
    { label: "Complaints", value: "0" },
    { label: "Resolved", value: "0" },
  ],
  footnote: "*The 5 refers to the number of bars we hope for.",
  simIccid: "ICCID 8965 0000 0000 0042 069",
  simHolder: "HOLDER · JAYDEN (PROBABLY)",
  chips: ["Signal acquired", "Signal lost", "Signal acquired again"],
} as const;

export const CONSOLE_COPY = {
  eyebrow: "Build your own",
  title: "Signal Calibration Console",
  lede: "Drag the slider to request more network. The network will respond with a price. Both numbers are non-negotiable.",
  // Changed: the original read "Braden x ABE ONG JUN WEI Technologies Flagship Cell Towers
  // usable". Phase 2 decision as above: those names are left out.
  label: "Flagship Cell Towers usable",
  scale: ["Off", "Usable", "Greedy", "Illegal"],
} as const;

/** A paragraph of plain text with optional links. */
export type RichText = (string | { href: string; text: string })[];

export const FAQ_COPY = {
  eyebrow: "Support",
  title: "Frequently ignored questions",
  lede: "Our support team is one person and he is not answering.",
  stuck: "Still stuck? Email us and we will read it eventually —",
  email: "Jaydensimcards@gmail.com",
} as const;

export const FAQ: { q: string; a: RichText }[] = [
  {
    q: "How do I see my plan and my remaining data?",
    a: [
      "Create an account in the ",
      { href: "/portal", text: "account portal" },
      ". You will see your plan, your allowance, how much you have used, and how much of it we have taken back. The last number is not shown separately, for morale reasons.",
    ],
  },
  {
    q: "I forgot my password.",
    // Changed: the original promised an emailed code lasting 20 minutes. The rebuilt site
    // emails a reset link that lasts 30 minutes, so the answer now says so.
    a: [
      "Use ",
      { href: "/forgot-password", text: '"Forgot password"' },
      " in the portal. We will send the link to your email. The link lasts 30 minutes, which is shorter than most of our outages.",
    ],
  },
  {
    q: "Why is my data not working?",
    a: [
      "Because Jayden is currently in class. The entire network is one phone in his pocket set to silent, and it has already been confiscated once this week. Full service resumes at 3:30 pm, or earlier if there is a fire drill.",
    ],
  },
  {
    q: "How do I check my remaining data?",
    a: [
      "Hold your phone above your head and walk slowly in a circle. Wherever it works, that is your remaining data. Wherever it does not, that is also your remaining data, spiritually.",
    ],
  },
  {
    q: "Is there a 24-hour hotline?",
    a: [
      "Yes. It rings for 24 hours. On the second day it begins ringing you back, which we have classified as a premium feature and billed accordingly.",
    ],
  },
  {
    q: "Do you support eSIM?",
    a: [
      "We support eSIM emotionally. What arrives in your letterbox is a physical SIM hand-cut from a larger SIM using craft scissors. If it does not fit, cut more. If you cut too much, congratulations, you have manufactured a nano SIM and we will invoice you for the upgrade.",
    ],
  },
  {
    q: "My bill says infinity dollars.",
    a: [
      "That is not a question. Infinity is payable in twelve equal monthly installments of infinity. We also accept payment in kopi, unused Ez-link value, or your seat on the last bus home.",
    ],
  },
  {
    q: "Can I port my number over?",
    a: [
      "Porting in takes four minutes. Porting out takes one appeal, two witnesses, and a handwritten letter to Jayden explaining exactly what he did wrong. Letters are reviewed annually.",
    ],
  },
  {
    q: "Do you have a physical shop?",
    a: [
      "Yes. It is Jayden's bag. Opening hours are whenever the bag is open. The bag does not accept returns, and there is a half-eaten curry puff in the retail section.",
    ],
  },
  {
    q: "What happens during a network outage?",
    a: [
      "Nothing happens. That is the outage. During an outage we recommend speaking to the people physically around you — an older protocol, slower, but surprisingly reliable and included free on every plan.",
    ],
  },
];

export const CTA_COPY = {
  title: "Where there is a sim, there is a card.",
  sub: "Delivery in 3–5 working days, by hand, by Jayden, if he is free.",
  button: "Get a SIM card",
  planId: "ultra",
} as const;

/** Shown when a "Get a SIM" button is pressed, after the plan's name. */
export const BUY_LINES = [
  "Opening the account portal. Your SIM is being cut out of a bigger SIM.",
  "Opening the account portal. Jayden will find you.",
  "Opening the account portal. Activation in 3 to 5 working days, depending on homework.",
  "Opening the account portal. You are about to become customer number 5.",
] as const;

export const COVERAGE = {
  eyebrow: "Live network scan",
  title: "Coverage map",
  scanning: "Scanning…",
  legend: { good: "Excellent", ok: "Patchy", bad: "Prayer required" },
  verdicts: [
    "Strong coverage confirmed at Blk 402, second-floor corridor, beside the recycling bin. Everywhere else, results may vary.",
    "Excellent signal detected inside one lift. We are not able to say which lift.",
    "Coverage is currently following Jayden. Jayden is currently on a bus.",
    "Full bars available in the kitchen, if you stand on the chair and do not move or breathe.",
    "Signal is strongest between 3:31 pm and 3:34 pm. Please plan your calls accordingly.",
    "Your area is fully covered. By another network. We can see it from here.",
  ],
  cells: 112,
} as const;

export const JAYDEN_MODE = {
  word: "jayden",
  colour: "#FFB43D",
  toast: "Jayden mode enabled. Network speed unchanged.",
} as const;
