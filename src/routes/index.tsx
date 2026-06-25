import { createFileRoute } from "@tanstack/react-router";
import { Home, Radio, Search, Settings, User } from "lucide-react";
import { ReviewCard } from "@/components/review-card";
import { cn } from "@/lib/utils";
import type { ReviewData } from "@/components/review-card";

export const Route = createFileRoute("/")({ component: FeedPage });

// --- Mock data ---

const MOCK_REVIEWS: ReviewData[] = [
  {
    id: "1",
    user: { displayUsername: "Alex Rivera" },
    userHref: "/user/alexrivera",
    album: {
      id: "ok-computer",
      title: "OK Computer",
      artist: "Radiohead",
      year: "1997",
      coverUrl: "https://picsum.photos/seed/ok-computer/200/200",
    },
    rating: 2.5,
    likes: 2400,
    review:
      "A landmark record that predicted the anxieties of the digital age with uncanny precision. Thom Yorke's paranoid murmurs have never felt more prescient, and Jonny Greenwood's arrangements feel genuinely dangerous — guitars that dissolve into static, rhythms that lurch and stall like a commute that will never end. Listening in 2024 is almost uncomfortable in how accurate it all turned out to be.",
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
  {
    id: "2",
    user: { displayUsername: "Sam Chen" },
    userHref: "/user/samchen",
    album: {
      id: "tpab",
      title: "To Pimp a Butterfly",
      artist: "Kendrick Lamar",
      year: "2015",
      coverUrl: "https://picsum.photos/seed/tpab/200/200",
    },
    rating: 5,
    likes: 1_200_000,
    review:
      "The most ambitious rap album of the decade. Every listen reveals another layer you hadn't noticed before. The jazz instrumentation shouldn't work this well over hip-hop production, but it does — effortlessly, almost tauntingly. Kendrick isn't rapping at you, he's building a world and daring you to find your place in it. The butterfly metaphor pays off better than any concept album has a right to.",
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
  },
  {
    id: "3",
    user: { displayUsername: "Maya Torres" },
    userHref: "/user/mayatorres",
    album: {
      id: "melodrama",
      title: "Melodrama",
      artist: "Lorde",
      year: "2017",
      coverUrl: "https://picsum.photos/seed/melodrama/200/200",
    },
    rating: 3,
    likes: 7,
    review:
      "There's a version of this album that I think is a perfect breakup record and another version I find exhausting. Lorde's melodrama is earned — she was nineteen and she knew it — but the production occasionally tips from euphoric into overwrought. Green Light is still one of the best pop moments of the 2010s. The closer, Perfect Places, destroys me every time without fail.",
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
  },
  {
    id: "4",
    user: { displayUsername: "Jordan Kim" },
    userHref: "/user/jordankim",
    album: {
      id: "in-rainbows",
      title: "In Rainbows",
      artist: "Radiohead",
      year: "2007",
      coverUrl: "https://picsum.photos/seed/in-rainbows/200/200",
    },
    rating: 1.5,
    likes: 13_500,
    review:
      "Warm and intimate in a way Radiohead had never quite managed before. The vinyl presentation is perfect, but even on streaming it sounds like the band finally exhaled. Every track feels like a conversation rather than a transmission. Reckoner alone justifies the whole thing — that chorus is one of the most purely beautiful things they've ever recorded, and it lands without a single loud moment.",
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  },
  {
    id: "5",
    user: { displayUsername: "Pat Morgan" },
    userHref: "/user/patmorgan",
    album: {
      id: "blonde",
      title: "Blonde",
      artist: "Frank Ocean",
      year: "2016",
      coverUrl: "https://picsum.photos/seed/blonde/200/200",
    },
    rating: 4.5,
    likes: 3_000_000,
    review:
      "Frank Ocean made the album that every other R&B artist was too afraid to make. It barely has a structure — more like a long afternoon of half-finished thoughts and voice memos than a proper record. And yet it coheres completely. Nights is the centrepiece: the beat switch in the middle is one of the cleanest production moves of the decade. I've started it at the beginning and just let it run more times than I can count.",
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
  },
  {
    id: "6",
    user: { displayUsername: "Jamie Lee" },
    userHref: "/user/jamielee",
    album: {
      id: "gkmc",
      title: "good kid, m.A.A.d city",
      artist: "Kendrick Lamar",
      year: "2012",
      coverUrl: "https://picsum.photos/seed/gkmc/200/200",
    },
    rating: 4,
    likes: 980,
    review:
      "The most vivid autobiographical storytelling in rap. Compton has never felt this cinematic — you can feel the heat off the asphalt. The skit interludes that annoyed people in 2012 are now the whole point; they're the connective tissue that turns a great rap album into an actual narrative. Backseat Freestyle and m.A.A.d city still hit as hard as anything released since.",
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
  },
];

const POPULAR_THIS_WEEK = [
  {
    id: "p1",
    title: "GUTS",
    artist: "Olivia Rodrigo",
    year: "2023",
    score: 4.0,
    coverUrl: "https://picsum.photos/seed/guts/200/200",
  },
  {
    id: "p2",
    title: "The Record",
    artist: "boygenius",
    year: "2023",
    score: 4.3,
    coverUrl: "https://picsum.photos/seed/the-record/200/200",
  },
  {
    id: "p3",
    title: "Javelin",
    artist: "Sufjan Stevens",
    year: "2023",
    score: 4.5,
    coverUrl: "https://picsum.photos/seed/javelin/200/200",
  },
  {
    id: "p4",
    title: "Desire, I Want to Turn Into You",
    artist: "Caroline Polachek",
    year: "2023",
    score: 4.3,
    coverUrl: "https://picsum.photos/seed/desire/200/200",
  },
];

const NAV_LINKS = [
  { icon: Home, label: "Home", href: "/" },
  { icon: Search, label: "Search", href: "/search" },
  { icon: Radio, label: "Feed", href: "/feed" },
  { icon: User, label: "Profile", href: "/user/me" },
  { icon: Settings, label: "Settings", href: "/settings" },
] as const;

// --- Page ---

function FeedPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Main grid */}
      <div className="mx-auto w-full flex-1 px-6 pb-8 lg:grid lg:grid-cols-[180px_1px_1fr_1px_220px] lg:gap-x-10 xl:px-16 2xl:px-24">
        <aside className="sticky top-8 mb-8 hidden self-start pt-8 lg:block">
          <nav className="flex flex-col">
            {NAV_LINKS.map(({ icon: Icon, label, href }) => (
              <a
                className={cn(
                  "flex items-center gap-3 py-2 pl-2 text-sm transition-colors hover:text-foreground",
                  href === "/" ? "font-medium text-foreground" : "text-muted-foreground"
                )}
                href={href}
                key={href}
              >
                <Icon className="size-4 shrink-0" />
                {label}
              </a>
            ))}
          </nav>
        </aside>
        <div className="hidden bg-border lg:block" />
        {/* Main feed */}
        <main className="min-w-0 pt-8">
          <h1 className="mb-4 font-medium text-[10px] text-muted-foreground uppercase tracking-widest">
            Recent Reviews
          </h1>
          <div>
            {MOCK_REVIEWS.map((review) => (
              <ReviewCard key={review.id} {...review} />
            ))}
          </div>
        </main>
        <div className="hidden bg-border lg:block" />
        {/* Right sidebar */}
        <aside className="sticky top-8 hidden self-start pt-8 lg:block">
          <h2 className="mb-1 font-medium text-[10px] text-muted-foreground uppercase tracking-widest">
            Popular this week
          </h2>
          <div className="flex flex-col">
            {POPULAR_THIS_WEEK.map((album, i) => (
              <div className="flex items-center gap-3 border-border border-b py-3.5 last:border-0" key={album.id}>
                <span className="w-3.5 shrink-0 text-[11px] text-muted-foreground tabular-nums">{i + 1}</span>
                <div className="size-9 shrink-0 overflow-hidden bg-muted">
                  {album.coverUrl ? (
                    <img
                      alt={album.title}
                      className="size-full object-cover"
                      height={36}
                      referrerPolicy="no-referrer"
                      src={album.coverUrl}
                      width={36}
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground text-xs">{album.title}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{album.artist}</p>
                </div>
                <span className="shrink-0 font-bold text-primary text-xs tabular-nums">{album.score.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
