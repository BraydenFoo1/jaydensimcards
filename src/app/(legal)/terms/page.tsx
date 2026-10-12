import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL_VERSIONS } from "@/lib/legal";
import { LegalDocument, Review, type LegalSection } from "../LegalDocument";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms for using the Jayden SIM Cards parody website and member portal.",
};

const sections: LegalSection[] = [
  {
    id: "about",
    title: "About these terms",
    body: (
      <>
        <p>
          These terms apply to the Jayden SIM Cards website and its member portal (together, the &ldquo;Service&rdquo;),
          operated by <Review>operator name or legal entity</Review> (&ldquo;we&rdquo;, &ldquo;us&rdquo;). By creating an
          account or using the Service you agree to them. If you do not agree, please do not use the Service.
        </p>
        <p>
          How we handle personal information is explained in the <Link href="/privacy">Privacy Policy</Link>, which forms
          part of these terms.
        </p>
      </>
    ),
  },
  {
    id: "parody",
    title: "A fictional parody service",
    body: (
      <>
        <p>
          Jayden SIM Cards is a fictional parody created for entertainment. It is <strong>not</strong> a licensed
          telecommunications provider. No real SIM card, phone number, mobile network, data allowance or other
          telecommunications service is offered or provided.
        </p>
        <p>
          Plans, prices, SIM numbers, usage figures, network status and every other &ldquo;telecom&rdquo; detail shown on
          the Service are made up. Nothing is sold and nothing is ever billed. Any resemblance to real products, services or
          companies is coincidental.
        </p>
      </>
    ),
  },
  {
    id: "accounts",
    title: "Your account",
    body: (
      <ul>
        <li>Give accurate registration details and keep your email address up to date so you can receive account emails.</li>
        <li>Keep your password confidential and do not share your account. You are responsible for activity on your account.</li>
        <li>Tell us promptly if you think someone else has accessed your account. You can sign out other devices yourself from the account page.</li>
        <li>
          You must meet the minimum age to use the Service: <Review>minimum age and any parental-consent requirement</Review>.
        </li>
      </ul>
    ),
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    body: (
      <>
        <p>Use the Service lawfully and in the spirit it is intended: a joke website with a pretend customer portal. You must not:</p>
        <ul>
          <li>try to access another person&rsquo;s account, information, sessions or SIM line, or pretend to be someone else;</li>
          <li>try to get around authentication, authorization, rate limits or other security controls, or use the Service in a way that tests or probes them without written permission;</li>
          <li>interfere with or disrupt the Service, its servers or networks, including through denial-of-service attacks or by overloading it;</li>
          <li>upload or send malicious code, or attempt to inject scripts, database queries or other code;</li>
          <li>scrape, crawl or harvest the Service or its data by automated means, or use bots, scripts or automation to create accounts or perform actions, except standard search-engine indexing of public pages;</li>
          <li>reverse engineer, decompile or attempt to extract the source code or underlying systems of the Service, except where the law expressly allows it;</li>
          <li>abuse, harass or threaten others, or use the Service to send spam;</li>
          <li>use the Service for any illegal, fraudulent or harmful purpose, or present it as a real telecommunications service.</li>
        </ul>
        <p>
          If you discover a security vulnerability, please report it to <Review>security contact email address</Review>{" "}
          rather than exploiting it.
        </p>
      </>
    ),
  },
  {
    id: "ip",
    title: "Content and intellectual property",
    body: (
      <p>
        The Service&rsquo;s text, design, logos, jokes and software are owned by or licensed to us{" "}
        <Review>confirm ownership and any third-party licences</Review>. You may view and share them for personal,
        non-commercial purposes, but you may not copy, modify or reuse them commercially without our permission. The
        information you give us, such as your name, remains yours; you allow us to use it only to run the Service as
        described in the Privacy Policy.
      </p>
    ),
  },
  {
    id: "suspension",
    title: "Suspension and termination",
    body: (
      <>
        <p>
          We may suspend or close an account if we reasonably believe it breaches these terms, puts other users or the
          Service at risk, or if we are required to by law. Where it is safe and lawful to do so, we will tell you why.
          Suspension signs the account out on every device.
        </p>
        <p>
          You can stop using the Service at any time and ask us to delete your account, as described in the{" "}
          <Link href="/privacy#requests">Privacy Policy</Link>.
        </p>
      </>
    ),
  },
  {
    id: "availability",
    title: "Availability and changes",
    body: (
      <p>
        The Service is provided for entertainment and may be unavailable, interrupted, slow or changed at any time,
        including for maintenance. We may add, change or remove features, or stop offering the Service altogether. Where a
        change materially affects your account, we will try to give reasonable notice. These terms may also change; we will
        update the version shown at the top of this page, and new accounts must agree to the current version.{" "}
        <Review>how existing account holders will be told about changes to these terms</Review>
      </p>
    ),
  },
  {
    id: "disclaimers",
    title: "Disclaimers",
    body: (
      <p>
        To the extent permitted by law, the Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;, without
        warranties of any kind, whether express or implied, including warranties of fitness for a particular purpose,
        accuracy or uninterrupted availability. Because the Service is a parody, nothing on it is advice or a statement
        about any real product or network. Nothing in these terms excludes warranties or guarantees that cannot be excluded
        under the law that applies to you.
      </p>
    ),
  },
  {
    id: "liability",
    title: "Limitation of liability",
    body: (
      <>
        <p>To the extent permitted by law:</p>
        <ul>
          <li>
            we are not liable for losses caused by the Service being unavailable or interrupted, by downtime or slow
            performance, or by the loss or corruption of information you store in the Service (we do not offer a backup
            service for your account data);
          </li>
          <li>we are not liable for indirect, incidental, special or consequential losses, or for loss of profits, revenue, data or goodwill;</li>
          <li>our total liability for all claims relating to the Service is limited to <Review>liability cap</Review>.</li>
        </ul>
        <p>
          These limits do not apply to liability that cannot be limited or excluded by law, such as liability for death or
          personal injury caused by negligence, for fraud, or under mandatory consumer-protection or data-protection laws.
          Nothing in these terms affects your statutory rights.
        </p>
      </>
    ),
  },
  {
    id: "law",
    title: "Governing law and disputes",
    body: (
      <>
        <p>
          These terms are governed by the laws of <Review>governing law</Review>, and disputes will be handled by the courts
          of <Review>jurisdiction</Review>, unless the law of the place where you live gives you the right to bring
          proceedings there.
        </p>
        <p>
          Before starting any formal dispute, please contact us so we can try to resolve it informally.{" "}
          <Review>whether any arbitration or other dispute-resolution process applies</Review>
        </p>
      </>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <p>
        Questions about these terms: <Review>contact email address</Review>. Privacy questions and requests: see the{" "}
        <Link href="/privacy">Privacy Policy</Link>.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalDocument
      title="Terms of Service"
      version={LEGAL_VERSIONS.terms}
      intro={
        <>
          <p>Please read these terms before creating an account. They explain what the Service is (a joke), what you may and may not do, and the limits of our responsibility.</p>
          <p className={styles.callout}>
            This is a draft that has not yet been reviewed by a lawyer. Items marked &ldquo;LEGAL REVIEW REQUIRED&rdquo; must
            be completed by the operator before relying on these terms.
          </p>
        </>
      }
      sections={sections}
    />
  );
}
