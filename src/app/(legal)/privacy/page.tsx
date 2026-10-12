import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL_VERSIONS } from "@/lib/legal";
import { LegalDocument, Review, type LegalSection } from "../LegalDocument";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How the Jayden SIM Cards website and member portal collect, use and protect personal data.",
};

const sections: LegalSection[] = [
  {
    id: "who-we-are",
    title: "Who we are",
    body: (
      <>
        <p>
          Jayden SIM Cards is a fictional parody website made for entertainment. It is not a telecommunications provider
          and does not sell SIM cards, mobile plans or any other service. The site has a member portal where you can
          create an account and manage a novelty, made-up &ldquo;SIM line&rdquo;.
        </p>
        <p>
          The website is operated by <Review>operator name or legal entity, and postal address</Review>. For privacy
          questions or requests, contact <Review>privacy contact email address</Review>.
        </p>
      </>
    ),
  },
  {
    id: "summary",
    title: "The short version",
    body: (
      <ul>
        <li>We collect what is needed to run your account and keep it secure, and nothing more.</li>
        <li>We never see or store your password. It is stored only as a one-way hash.</li>
        <li>We use essential cookies only. There are no analytics, advertising or tracking cookies.</li>
        <li>We do not sell or rent personal information, and we do not use it for advertising.</li>
        <li>Nothing is ever billed. We do not collect payment details.</li>
      </ul>
    ),
  },
  {
    id: "information-we-collect",
    title: "Information we collect",
    body: (
      <>
        <h3>When you register</h3>
        <ul>
          <li>Your name and email address.</li>
          <li>
            Your password, which is immediately turned into a salted one-way hash (scrypt). The original password is
            never stored and cannot be recovered by us or by staff.
          </li>
          <li>A record that you agreed to these documents: which document, which version, and when.</li>
        </ul>
        <h3>About your account</h3>
        <ul>
          <li>Whether your email address is confirmed, your account type (customer or staff), and when the account was created and last updated.</li>
          <li>
            Whether the account is active or suspended. If staff suspend an account, they choose a reason from a fixed list
            (such as &ldquo;Security concern&rdquo;); they cannot type free-form notes.
          </li>
          <li>Your fictional SIM line: the made-up plan you picked and made-up usage figures.</li>
        </ul>
        <h3>When you sign in</h3>
        <p>
          We create a session for each device you sign in on. A session stores a random identifier, when it expires, and
          the IP address and browser description (user agent) of the device. We use these so you can see and sign out your
          devices, and to protect accounts from misuse. In the portal you see a shortened version of the IP address.
        </p>
        <h3>Security and activity records</h3>
        <p>
          We keep a log of security-relevant events: account creation, sign-ins, failed sign-ins to existing accounts,
          sign-outs, password changes and resets, email confirmation, plan changes, device sign-outs, refused actions, and
          actions taken by staff. Each entry stores the account identifier involved, the type of event, the time, and a short
          system-generated detail (such as a plan name or a reason code). It never stores passwords, session tokens or IP
          addresses, and it does not store the email address someone typed when a sign-in fails for an address that has no account.
        </p>
        <h3>Abuse prevention</h3>
        <ul>
          <li>Rate-limiting counters, keyed by IP address and the page requested, slow down password guessing.</li>
          <li>A record of the emails we send, keyed by a one-way hash of the address rather than the address itself, stops anyone flooding an inbox.</li>
        </ul>
        <h3>What we do not collect</h3>
        <p>
          Payment details, precise location, contacts, phone numbers, advertising identifiers, or analytics about how you
          browse the site.
        </p>
      </>
    ),
  },
  {
    id: "cookies",
    title: "Cookies",
    body: (
      <>
        <p>We use only cookies that the site needs to work. They are not used for analytics, advertising or tracking.</p>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption className="sr-only">Cookies used by this site</caption>
            <thead>
              <tr>
                <th scope="col">Cookie</th>
                <th scope="col">Purpose</th>
                <th scope="col">Lasts</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <code>jsc.session_token</code> (<code>__Secure-jsc.session_token</code> on secure connections)
                </td>
                <td>Keeps you signed in. Not readable by page scripts (HttpOnly), and never sent to other sites.</td>
                <td>Up to 7 days, extended while you use the site. Deleted when you sign out.</td>
              </tr>
              <tr>
                <td>
                  <code>jsc_cookie_choice</code>
                </td>
                <td>Remembers your answer to the cookie notice so it is not shown on every page.</td>
                <td>180 days</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          The cookie notice offers &ldquo;Accept all&rdquo; and &ldquo;Essential only&rdquo;. Because the site currently has
          no optional cookies, both choices behave the same today. If we ever add optional cookies, they will stay off unless
          you choose &ldquo;Accept all&rdquo;, and we will update this policy first.
        </p>
      </>
    ),
  },
  {
    id: "how-we-use",
    title: "How we use information",
    body: (
      <>
        <ul>
          <li>To create and run your account and the portal (including your fictional plan).</li>
          <li>To send emails you need: confirming your address, resetting your password, and warning you if someone tries to register with your address.</li>
          <li>To keep accounts and the site secure: preventing password guessing and abuse, and investigating misuse.</li>
          <li>To keep a record of your agreement to these documents.</li>
        </ul>
        <p>
          Where the EU or UK GDPR applies, we expect to rely on performance of a contract (running your account),
          legitimate interests (security and abuse prevention), and compliance with legal obligations (keeping records of
          consent). <Review>confirm the legal bases for each purpose</Review>
        </p>
      </>
    ),
  },
  {
    id: "sharing",
    title: "Who we share information with",
    body: (
      <>
        <p>We do not sell or rent personal information and we do not share it for advertising. We use service providers only where the site needs them:</p>
        <ul>
          <li>
            <strong>Hosting and database.</strong> The site is intended to run on a cloud hosting platform with a managed
            database. <Review>name the production hosting and database providers, and confirm their data-processing terms, before launch</Review>
          </li>
          <li>
            <strong>Email delivery.</strong> Account emails are sent through an email provider.{" "}
            <Review>name the email provider used in production</Review>
          </li>
          <li>
            <strong>Breached-password check.</strong> When you choose a password, we send the first five characters of a
            SHA-1 hash of it (never the password itself) to the Have I Been Pwned &ldquo;Pwned Passwords&rdquo; service, to check
            whether it has appeared in a known data breach.
          </li>
          <li>
            <strong>Authentication monitoring (only if enabled).</strong> The site&rsquo;s authentication software can
            optionally send sign-in and account events, including IP address and approximate location, to Better Auth
            Infrastructure for security monitoring. <Review>state whether this is enabled in production</Review>
          </li>
        </ul>
        <p>We may also disclose information where the law requires it. <Review>confirm any additional disclosure obligations</Review></p>
      </>
    ),
  },
  {
    id: "international",
    title: "International transfers",
    body: (
      <p>
        Service providers may store or process information in other countries. <Review>identify where data is stored and processed, and the safeguards used for international transfers</Review>
      </p>
    ),
  },
  {
    id: "retention",
    title: "How long we keep information",
    body: (
      <ul>
        <li>Account information and your fictional SIM line: until your account is deleted.</li>
        <li>Sessions: they expire 7 days after they were last extended (they are extended at most once a day while you use the site), and are deleted when you sign out.</li>
        <li>Email confirmation links expire after 1 hour, and password reset links after 30 minutes. Expired links are removed automatically.</li>
        <li>Email-flood records (hashed addresses): deleted after 1 day.</li>
        <li>Rate-limiting counters: removed automatically once they are no longer needed.</li>
        <li>Consent records: deleted together with the account.</li>
        <li>
          Security and activity log: <Review>retention period</Review>. When an account is deleted, its log entries keep
          only an anonymous identifier, so they no longer show who the account belonged to.
        </li>
        <li>Backups kept by the database provider: <Review>backup retention period</Review>.</li>
      </ul>
    ),
  },
  {
    id: "security",
    title: "How we protect information",
    body: (
      <>
        <ul>
          <li>Passwords are stored only as salted scrypt hashes and are checked against known data breaches when set.</li>
          <li>Sign-in cookies cannot be read by page scripts. Requests from other websites that try to make changes on your behalf are rejected.</li>
          <li>Sign-in attempts, password resets and confirmation emails are rate limited.</li>
          <li>
            Every account action is checked on the server against your role. Staff can see only what their role needs:
            they cannot see passwords, session tokens or devices, and they cannot sign in as you.
          </li>
          <li>Database credentials and other secrets are kept on the server and never sent to browsers.</li>
          <li>The production site is intended to be served only over encrypted HTTPS connections.</li>
        </ul>
        <p>No system can be made perfectly secure, so we cannot promise that information will never be accessed without permission. If a breach affects you, we will tell you where the law requires it.</p>
      </>
    ),
  },
  {
    id: "your-rights",
    title: "Your rights",
    body: (
      <>
        <p>
          Which rights apply depends on where you live and on the operator&rsquo;s circumstances. We describe the main
          frameworks below; we do not claim that any of them applies in full. <Review>confirm which privacy laws apply</Review>
        </p>
        <h3>Everyone</h3>
        <p>You can ask us for a copy of your information, ask us to correct it, ask us to delete your account, and withdraw your agreement to these documents by asking us to delete your account.</p>
        <h3>EU / UK GDPR</h3>
        <p>
          If the GDPR applies, you may have the right to access, correct (rectify) and erase your data, to restrict or
          object to certain processing, to receive your data in a portable format, to withdraw consent at any time, and to
          complain to your data protection supervisory authority.
        </p>
        <h3>California (CCPA / CPRA)</h3>
        <p>
          If the CCPA applies, you may have the right to know what personal information we collect and how it is used, to
          delete and correct it, and to opt out of its sale or sharing. We do not sell or share personal information as
          those terms are defined. We will not treat you differently for using these rights.
        </p>
        <h3>Singapore (PDPA)</h3>
        <p>
          If the PDPA applies, you may ask to access and correct your personal data and may withdraw consent for its
          collection, use or disclosure. You can also contact the Personal Data Protection Commission.
        </p>
      </>
    ),
  },
  {
    id: "requests",
    title: "Making a privacy request",
    body: (
      <>
        <p>
          <strong>Things you can do yourself</strong>, in the{" "}
          <Link href="/portal/account">account page</Link>: see your account details, change your password, and see and sign
          out the devices you are signed in on.
        </p>
        <p>
          <strong>Everything else</strong> (a copy of your data, corrections, deleting your account, or any other request):
          email <Review>privacy contact email address</Review> from the email address on your account, saying what you would
          like. If you write from another address, we will confirm the request through your account email before acting on it.
        </p>
        <p className={styles.callout}>
          There is no self-service &ldquo;delete my account&rdquo; button yet. Account deletion is carried out by an
          administrator after your request is verified. Deleting an account removes your profile, sign-in details, sessions,
          SIM line and consent records; activity-log entries remain only with an anonymous identifier.
        </p>
        <p>We will respond within <Review>response timeframe</Review>.</p>
      </>
    ),
  },
  {
    id: "children",
    title: "Children",
    body: (
      <p>
        <Review>minimum age for creating an account, and any parental-consent requirements</Review>
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: (
      <p>
        If we change this policy, we will update the version at the top of this page. New accounts must agree to the current
        version. <Review>how existing account holders will be told about material changes</Review>
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalDocument
      title="Privacy Policy"
      version={LEGAL_VERSIONS.privacy}
      intro={
        <>
          <p>This policy explains what personal information the Jayden SIM Cards website and member portal collect, why, and what you can do about it.</p>
          <p className={styles.callout}>
            This is a draft that has not yet been reviewed by a lawyer. Items marked &ldquo;LEGAL REVIEW REQUIRED&rdquo; are
            details only the operator can provide and must be completed before relying on this policy.
          </p>
        </>
      }
      sections={sections}
    />
  );
}
