import { Link } from "@tanstack/react-router";
import { PageContainer, PageContainerContent } from "@/components/page-container";
import type { ReactNode } from "react";

interface LegalHighlight {
  label: string;
  value: string;
}

interface LegalPageProps {
  children: ReactNode;
  description: string;
  highlights: LegalHighlight[];
  lastUpdated: string;
  title: string;
}

interface LegalSectionProps {
  children: ReactNode;
  id: string;
  title: string;
}

export function LegalPage({ children, description, highlights, lastUpdated, title }: LegalPageProps) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <PageContainer>
        <PageContainerContent className="py-12 sm:py-16 lg:py-20">
          <article className="mx-auto max-w-3xl">
            <header className="flex flex-col gap-5 border-border border-b pb-9">
              <p className="font-medium text-muted-foreground text-xs uppercase tracking-[0.18em]">Legal</p>
              <div className="flex flex-col gap-3">
                <h1 className="font-semibold text-4xl tracking-tight sm:text-5xl">{title}</h1>
                <p className="max-w-2xl text-base text-muted-foreground leading-7 sm:text-lg">{description}</p>
              </div>
              <p className="text-muted-foreground text-sm">Last updated {lastUpdated}</p>

              <dl className="grid divide-y divide-border border-border border-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                {highlights.map((highlight) => (
                  <div className="flex flex-col gap-1 py-4 sm:px-5 sm:last:pr-0 sm:first:pl-0" key={highlight.label}>
                    <dt className="text-muted-foreground text-xs uppercase tracking-wide">{highlight.label}</dt>
                    <dd className="font-medium text-sm">{highlight.value}</dd>
                  </div>
                ))}
              </dl>
            </header>

            <div className="flex flex-col gap-10 pt-10 sm:gap-12">{children}</div>

            <footer className="mt-12 flex flex-col gap-5 border-border border-t pt-8 text-sm sm:flex-row sm:items-center sm:justify-between">
              <nav aria-label="Legal pages" className="flex items-center gap-5">
                <Link className="text-muted-foreground transition-colors hover:text-foreground" to="/privacy">
                  Privacy
                </Link>
                <Link className="text-muted-foreground transition-colors hover:text-foreground" to="/terms">
                  Terms
                </Link>
              </nav>
              <a
                className="text-muted-foreground transition-colors hover:text-foreground"
                href="mailto:ratio.music.dev@gmail.com"
              >
                Contact
              </a>
            </footer>
          </article>
        </PageContainerContent>
      </PageContainer>
    </main>
  );
}

export function LegalSection({ children, id, title }: LegalSectionProps) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <h2 className="font-semibold text-xl tracking-tight" id={id}>
        {title}
      </h2>
      <div className="flex flex-col gap-4 text-[0.9375rem] text-muted-foreground leading-7 sm:text-base">
        {children}
      </div>
    </section>
  );
}

export const legalListClassName = "flex list-disc flex-col gap-2 pl-5 marker:text-muted-foreground/50";
export const legalLinkClassName =
  "text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground";
