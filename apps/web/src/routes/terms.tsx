import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, LegalSection, legalLinkClassName, legalListClassName } from "@/components/legal/legal-page";
import { createCanonicalLink, createSeoMeta } from "@/lib/seo";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
  head: () => ({
    links: [createCanonicalLink("/terms")],
    meta: createSeoMeta({
      description: "Read the terms that apply when using Ratio.",
      path: "/terms",
      title: "Terms of Use | Ratio",
    }),
  }),
});

function TermsPage() {
  return (
    <LegalPage
      description="The rules for using Ratio and sharing work with its community."
      highlights={[
        { label: "Service", value: "Album ratings and reviews" },
        { label: "Your content", value: "It stays yours" },
        { label: "Community", value: "Be respectful" },
      ]}
      lastUpdated="23 August 2026"
      title="Terms of use"
    >
      <LegalSection id="terms-about" title="About these terms">
        <p>
          Ratio is an independently operated community for rating and reviewing albums. These terms govern your use of
          the service.
        </p>
        <p>
          By creating an account or using account features, you accept these terms. If you do not accept them, you may
          still browse public pages but must not create an account or submit content.
        </p>
      </LegalSection>

      <LegalSection id="terms-account" title="Your account">
        <ul className={legalListClassName}>
          <li>You may use Ratio only if you can legally agree to these Terms.</li>
          <li>If local law requires permission from a parent or guardian, obtain it before using Ratio.</li>
          <li>Sign in with an account that belongs to you, and keep access to it secure.</li>
          <li>You are responsible for anything done through your account.</li>
        </ul>
      </LegalSection>

      <LegalSection id="terms-content" title="Content you share">
        <p>
          You own the reviews, replies, lists, and images you create. You give Ratio a non-exclusive, worldwide,
          royalty-free license to host, store, reproduce, and display that content only as needed to run the service.
        </p>
        <p>
          That license ends when your content is deleted, except for temporary backups or copies Ratio must keep by law.
          You confirm that you have the right to share what you post. Once content is public, other people can copy or
          share it in ways Ratio cannot control.
        </p>
      </LegalSection>

      <LegalSection id="terms-copyright" title="Copyright complaints">
        <p>
          Ratio respects copyright and may remove content that infringes someone else&apos;s rights. To report content,
          email{" "}
          <a className={legalLinkClassName} href="mailto:ratio.music.dev@gmail.com">
            ratio.music.dev@gmail.com
          </a>{" "}
          with your contact details, the work you believe is being infringed, the location of the reported content on
          Ratio, and enough information to understand why you believe its use is not authorized.
        </p>
        <p>
          Reports must be made in good faith and confirm that the information supplied is accurate and that you are the
          rights holder or authorized to act for them. Ratio may ask for more information, remove or disable access to
          reported content, and suspend or terminate accounts that repeatedly infringe other people&apos;s rights. If
          your content was removed by mistake, contact the same address and explain why.
        </p>
      </LegalSection>

      <LegalSection id="terms-conduct" title="Community rules">
        <p>Do not use Ratio to:</p>
        <ul className={legalListClassName}>
          <li>post illegal, infringing, hateful, harassing, threatening, or deliberately deceptive content</li>
          <li>impersonate another person or expose someone&apos;s private information</li>
          <li>send spam, or manipulate ratings, likes, follows, or other community signals</li>
          <li>interfere with security, access another person&apos;s account, or overload the service</li>
          <li>use automated access in a way that harms Ratio or violates someone else&apos;s rights</li>
        </ul>
      </LegalSection>

      <LegalSection id="terms-moderation" title="Moderation">
        <p>
          Ratio may remove content, limit features, or suspend and ban accounts where that is reasonably necessary to
          enforce these Terms, protect people or the service, or comply with the law. Ratio does not review everything
          that gets posted.
        </p>
      </LegalSection>

      <LegalSection id="terms-third-parties" title="Spotify and other services">
        <p>
          Ratio uses services from Spotify, Google, Discord, Cloudflare, and Supabase. Their terms and privacy policies
          may also apply when you use them. Album artwork, metadata, names, and trademarks belong to their respective
          owners.
        </p>
        <p>
          Features and data that come from these services can change or stop working, and that is outside Ratio&apos;s
          control.
        </p>
      </LegalSection>

      <LegalSection id="terms-spotify" title="Spotify-specific terms">
        <p>
          Ratio, not Spotify, is responsible for Ratio and its operation. Ratio does not make warranties or
          representations on Spotify&apos;s behalf, and Spotify is not responsible or liable for Ratio or for your use
          of Ratio.
        </p>
        <p>
          To the fullest extent permitted by law, all implied warranties relating to the Spotify Platform, Spotify
          Service, and Spotify Content (including merchantability, fitness for a particular purpose, and
          non-infringement) are disclaimed.
        </p>
        <p>
          You must not modify or create derivative works based on the Spotify Platform, Spotify Service, or Spotify
          Content. To the fullest extent permitted by law, you must not decompile, reverse-engineer, disassemble, or
          otherwise reduce any of them to source code or another human-perceivable form.
        </p>
        <p>
          Spotify is a third-party beneficiary of these Terms and Ratio&apos;s Privacy Policy. Spotify is entitled to
          enforce these Terms directly where they relate to Spotify, the Spotify Platform, Spotify Service, or Spotify
          Content.
        </p>
      </LegalSection>

      <LegalSection id="terms-availability" title="Availability and account deletion">
        <p>
          Ratio may change, pause, or stop features at any time. Uninterrupted access and permanent storage are not
          guaranteed, so keep your own copy of content that matters to you.
        </p>
        <p>
          You can delete your account in settings. Your account data and activity are removed from the live service,
          though limited backups may linger for a short while, and shared album information stays in the catalog.
        </p>
      </LegalSection>

      <LegalSection id="terms-liability" title="Disclaimers and liability">
        <p>
          Ratio is provided &quot;as is&quot; and &quot;as available&quot;, without promises that it will always be
          accurate, secure, or uninterrupted. To the fullest extent allowed by law, Ratio is not responsible for
          indirect or unforeseeable losses caused by using, or being unable to use, the service.
        </p>
        <p>
          Nothing in these Terms limits your consumer rights, or any responsibility that cannot legally be limited or
          excluded.
        </p>
      </LegalSection>

      <LegalSection id="terms-changes" title="Changes, law, and contact">
        <p>
          Ratio may update these terms. The date at the top will show the latest revision. If a change materially
          affects your rights, Ratio will provide notice in the service where practicable. If you keep using Ratio after
          a change takes effect, you accept the updated terms.
        </p>
        <p>Portuguese law governs these terms. Any mandatory protections under the law where you live still apply.</p>
        <p>
          For questions, email{" "}
          <a className={legalLinkClassName} href="mailto:ratio.music.dev@gmail.com">
            ratio.music.dev@gmail.com
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
