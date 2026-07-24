import { createFileRoute } from "@tanstack/react-router";
import { NotFoundPage } from "@/components/not-found-page";
import { PageContainer, PageContainerContent } from "@/components/page-container";
import { ReviewConversation } from "@/components/review-conversation/review-conversation";
import { createCanonicalLink, createSeoMeta, siteName } from "@/lib/seo";

export const Route = createFileRoute("/review/$reviewId")({
  component: ReviewRoute,
  notFoundComponent: NotFoundPage,
  head: ({ params }) => {
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
});

function ReviewRoute() {
  const { reviewId } = Route.useParams();

  return (
    <main className="min-h-screen bg-background text-foreground">
      <PageContainer>
        <PageContainerContent className="pt-4 pb-12 lg:pt-7 lg:pb-16">
          <div>
            <ReviewConversation key={reviewId} reviewId={reviewId} />
          </div>
        </PageContainerContent>
      </PageContainer>
    </main>
  );
}
