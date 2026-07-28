import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, LegalSection, legalLinkClassName, legalListClassName } from "@/components/legal/legal-page";
import { createCanonicalLink, createSeoMeta } from "@/lib/seo";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
  head: () => ({
    links: [createCanonicalLink("/privacy")],
    meta: createSeoMeta({
      description: "Learn how Ratio collects, uses, stores, and protects personal data.",
      path: "/privacy",
      title: "Privacy Policy | Ratio",
    }),
  }),
});

function PrivacyPage() {
  return (
    <LegalPage
      description="What Ratio collects, why it needs it, and the choices you have."
      highlights={[
        { label: "Tracking", value: "No ads or analytics" },
        { label: "Listening history", value: "Cached, never stored" },
        { label: "Control", value: "Delete your account anytime" },
      ]}
      title="Privacy Policy"
    >
      <LegalSection id="privacy-who" title="Who is responsible">
        <p>
          Ratio is a community for rating and reviewing albums, operated by Miguel Soldado, who is responsible for the
          personal data described here. For any privacy question or request, email{" "}
          <a className={legalLinkClassName} href="mailto:ratio.music.dev@gmail.com">
            ratio.music.dev@gmail.com
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection id="privacy-data" title="What Ratio collects">
        <ul className={legalListClassName}>
          <li>
            <strong className="font-medium text-foreground">Account details:</strong> your provider identifier, name,
            email address, profile image, username, linked sign-in methods, and the permissions those providers grant.
          </li>
          <li>
            <strong className="font-medium text-foreground">Technical details:</strong> session identifiers, expiry
            times, IP address, browser or device information, and records needed for security and rate limiting.
          </li>
          <li>
            <strong className="font-medium text-foreground">Content and activity:</strong> the ratings, reviews,
            replies, lists, likes, follows, and notifications tied to your account, plus any profile image you upload.
          </li>
          <li>
            <strong className="font-medium text-foreground">Spotify listening, only if you allow it:</strong> your
            recently played albums are fetched from Spotify to fill your private listening shelf. The result is cached
            for up to 30 minutes and your listening history is never saved to Ratio&apos;s database.
          </li>
          <li>
            <strong className="font-medium text-foreground">Recent searches:</strong> your last ten searches stay in
            your browser. They are never synced to your Ratio account.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="privacy-use" title="Why Ratio uses this information">
        <p>
          Ratio uses your data to run your account, power the features you use, show your contributions to other people,
          and help you when you get in touch.
        </p>
        <p>
          A smaller amount of data keeps the service secure: preventing abuse, moderating the community, and meeting
          legal obligations. The legal bases for all of this are providing the service you asked for, Ratio&apos;s
          legitimate interest in running it safely, your consent where it is requested, and the law where it applies.
        </p>
        <p>
          You can withdraw consent at any time. Doing so does not undo processing that already happened before you
          withdrew it.
        </p>
      </LegalSection>

      <LegalSection id="privacy-public" title="What is public">
        <p>
          Your username, display name, profile image, ratings, reviews, replies, public lists, likes, and follows can be
          seen by anyone. Treat them as public, and do not post anything you want kept private.
        </p>
        <p>
          Your email address, sign-in tokens, sessions, and listening shelf are never public. Administrators can reach
          limited information when it is needed for support, security, or moderation.
        </p>
      </LegalSection>

      <LegalSection id="privacy-sharing" title="Who else sees your data">
        <p>
          Ratio does not sell your personal data, and there are no advertising or analytics services in the picture. A
          handful of providers do see some of it:
        </p>
        <ul className={legalListClassName}>
          <li>Cloudflare handles hosting, security, file storage, and short-lived caching.</li>
          <li>Supabase hosts the database.</li>
          <li>Google, Discord, and Spotify handle sign-in, for whichever one you choose.</li>
          <li>Spotify receives your album searches, and returns catalog data and optional listening data.</li>
          <li>Authorities, but only where disclosure is legally required.</li>
        </ul>
        <p>
          Some of these providers process data outside the European Economic Area, under the safeguards that applicable
          data-protection law provides for.
        </p>
      </LegalSection>

      <LegalSection id="privacy-storage" title="Cookies, local storage, and retention">
        <p>
          Ratio sets essential cookies for sign-in, sessions, and security. There are no advertising or analytics
          cookies. Recent searches live in your browser&apos;s local storage until you clear them from the search bar,
          newer searches replace them, or you wipe the site data in your browser.
        </p>
        <p>
          Your account information and contributions are kept for as long as your account exists. A session expires
          after about 30 days without use, and that window resets each time you come back. Linked-provider details are
          kept until you unlink the provider, delete your account, or they expire on their own. Limited logs and backups
          stick around a little longer for security, reliability, or legal reasons.
        </p>
      </LegalSection>

      <LegalSection id="privacy-rights" title="Your choices and rights">
        <p>
          You can edit your profile, clear your recent searches, unlink a sign-in provider, or delete your account at
          any time from settings. Depending on the law where you live, you can also ask to access, correct, delete, or
          transfer your data, ask Ratio to restrict how it is used, or object to it being used at all.
        </p>
        <p>
          Email{" "}
          <a className={legalLinkClassName} href="mailto:ratio.music.dev@gmail.com">
            ratio.music.dev@gmail.com
          </a>{" "}
          to exercise any of these rights. You can also complain to Portugal&apos;s{" "}
          <a
            className={legalLinkClassName}
            href="https://www.cnpd.pt/cidadaos/direitos/"
            rel="noreferrer"
            target="_blank"
          >
            National Data Protection Commission (CNPD)
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection id="privacy-security" title="Security and changes">
        <p>
          Ratio relies on access controls, encrypted provider tokens, and other reasonable safeguards. That said, no
          online service can promise absolute security.
        </p>
        <p>
          This policy will change as Ratio grows. The date at the top is updated whenever it does, and significant
          changes will be called out where that is reasonably possible.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
