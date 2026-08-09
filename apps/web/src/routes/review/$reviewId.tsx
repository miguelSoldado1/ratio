import { createFileRoute } from "@tanstack/react-router";
import { NotFoundPage } from "@/components/not-found-page";
import { PageContainer, PageContainerContent } from "@/components/page-container";
import { ReviewConversation } from "@/components/review-conversation/review-conversation";
import { createCanonicalLink, createSeoMeta, siteName } from "@/lib/seo";
import { getReviewHeadMetadata } from "@/server/functions/review-functions";
import { tryCatch } from "@/try-catch";

export const Route = createFileRoute("/review/$reviewId")({
  component: ReviewRoute,
  loader: async ({ params }) => {
    const result = await tryCatch(getReviewHeadMetadata({ data: { reviewId: params.reviewId } }));
    return result.data;
  },
  notFoundComponent: NotFoundPage,
  preload: false,
  ssr: "data-only",
  head: ({ loaderData, params }) => {
    const path = `/review/${params.reviewId}`;

    if (!loaderData) {
      return {
        links: [createCanonicalLink(path)],
        meta: createSeoMeta({
          description: "Read this album review on Ratio.",
          path,
          // A failed lookup is indistinguishable from a deleted review, so never emit noindex.
          robots: null,
          title: `Album Review | ${siteName}`,
          type: "article",
        }),
      };
    }

    const artistNames = loaderData.artistNames.length > 0 ? loaderData.artistNames : ["Unknown Artist"];
    const title = `${loaderData.title} review by ${loaderData.authorDisplayName} | ${siteName}`;
    const description = `${loaderData.authorDisplayName} rated ${loaderData.title} by ${artistNames.join(", ")} ${loaderData.rating}/5 on ${siteName}.`;

    return {
      links: [createCanonicalLink(path)],
      meta: createSeoMeta({
        description,
        image: loaderData.coverUrl,
        imageAlt: loaderData.coverUrl ? `${loaderData.title} album cover` : `${siteName} album review`,
        path,
        title,
        twitterCard: "summary",
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
