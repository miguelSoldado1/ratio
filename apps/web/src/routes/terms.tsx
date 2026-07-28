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
      description="The basic rules for using Ratio and sharing work with the community."
      highlights={[
        { label: "Service", value: "Album ratings and reviews" },
        { label: "Your content", value: "It stays yours" },
        { label: "Community", value: "Be respectful" },
      ]}
      title="Terms of Use"
    >
      <LegalSection id="terms-about" title="About these Terms">
        <p>
          Ratio is a community for rating and reviewing albums, operated by Miguel Soldado. These Terms form an
          agreement between you and Miguel Soldado.
        </p>
        <p>
          By creating an account or using account features, you accept these Terms. If you do not accept them, you may
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
          You keep ownership of the reviews, replies, lists, and images you create. You give Ratio a non-exclusive,
          worldwide, royalty-free license to host, store, reproduce, and display that content, only as needed to operate
          Ratio.
        </p>
        <p>
          That license ends when your content is deleted, except for temporary backups or copies Ratio must keep by law.
          You confirm that you have the rights to share whatever you post. Once content is public, other people can copy
          or share it in ways Ratio cannot control.
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
          Ratio is built on services from Spotify, Google, Discord, Cloudflare, and Supabase. Their own terms and
          privacy policies may also apply when you use them. Album artwork, metadata, names, and trademarks belong to
          their respective owners.
        </p>
        <p>
          Features and data that come from these services can change or stop working, and that is outside Ratio&apos;s
          control.
        </p>
      </LegalSection>

      <LegalSection id="terms-availability" title="Availability and account deletion">
        <p>
          Ratio may change, pause, or stop features at any time. Uninterrupted access and permanent storage are not
          guaranteed, so keep your own copy of anything you would hate to lose.
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
          These Terms will change as Ratio grows. The date at the top is updated whenever they do, and significant
          changes will be called out where that is reasonably possible. If you keep using Ratio after a change, you
          accept the updated Terms.
        </p>
        <p>Portuguese law governs these Terms. Any mandatory protections under the law where you live still apply.</p>
        <p>
          Questions are welcome at{" "}
          <a className={legalLinkClassName} href="mailto:ratio.music.dev@gmail.com">
            ratio.music.dev@gmail.com
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
