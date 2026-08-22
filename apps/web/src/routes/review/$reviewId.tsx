import { createFileRoute } from "@tanstack/react-router";
import { NotFoundPage } from "@/components/not-found-page";
import { PageContainer, PageContainerContent } from "@/components/page-container";
import { ReviewConversation } from "@/components/review-conversation/review-conversation";
import { ReviewConversationSkeleton } from "@/components/review-conversation/review-conversation-skeleton";
import { ReviewPageShell } from "@/components/review-conversation/review-page-shell";
import { createDocumentRouteHead, getInitialDocumentMetadata } from "@/lib/document-metadata";
import { createCanonicalLink, createSeoMeta, siteName } from "@/lib/seo";

export const Route = createFileRoute("/review/$reviewId")({
  component: ReviewRoute,
  notFoundComponent: NotFoundPage,
  head: ({ params }) => {
    const initialMetadata = getInitialDocumentMetadata();
    if (initialMetadata) return createDocumentRouteHead(initialMetadata);

    const path = `/review/${params.reviewId}`;

    return {
      links: [createCanonicalLink(path)],
      meta: createSeoMeta({
        description: "Read this album review on Ratio.",
        path,
        title: `Album Review | ${siteName}`,
        type: "article",
      }),
    };
  },
  pendingComponent: ReviewRoutePending,
  pendingMinMs: 0,
  pendingMs: 0,
  ssr: false,
});

function ReviewRoute() {
  const { reviewId } = Route.useParams();

  return (
    <main className="min-h-screen bg-background text-foreground">
      <PageContainer>
        <PageContainerContent className="pt-4 pb-12 lg:pt-7 lg:pb-16">
          <ReviewConversation key={reviewId} reviewId={reviewId} />
        </PageContainerContent>
      </PageContainer>
    </main>
  );
}

function ReviewRoutePending() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <PageContainer>
        <PageContainerContent className="pt-4 pb-12 lg:pt-7 lg:pb-16">
          <ReviewPageShell pending>
            <ReviewConversationSkeleton />
          </ReviewPageShell>
        </PageContainerContent>
      </PageContainer>
    </main>
  );
}
