import type { ReviewData } from "@/components/review-card";

interface AlbumPageAlbum {
  artist: string;
  coverUrl: string;
  id: string;
  release: string;
  runtime: string;
  title: string;
  totalTracks: number;
}

interface AlbumPageRatingSummary {
  average: number;
  total: string;
}

interface AlbumPageRatingDistributionItem {
  count: number;
  rating: string;
}

interface AlbumPageTrack {
  duration: string;
  id: string;
  title: string;
}

export interface AlbumPageData {
  album: AlbumPageAlbum;
  ratingDistribution: AlbumPageRatingDistributionItem[];
  ratingSummary: AlbumPageRatingSummary | null;
  reviews: ReviewData[];
  tracks: AlbumPageTrack[];
}

export const albumPageAlbum = {
  albumType: "Album",
  appleMusicId: "1669095245",
  appleMusicUrl: "https://music.apple.com/us/album/desire-i-want-to-turn-into-you/1669095245",
  artist: "Caroline Polachek",
  artistAppleMusicId: "385592090",
  artistUrl: "https://music.apple.com/us/artist/caroline-polachek/385592090",
  artwork: {
    height: 1200,
    large:
      "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/10/51/f2/1051f2cc-195f-ddb6-2d9e-26c74f0387fd/197187988518.jpg/1200x1200bb.jpg",
    medium:
      "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/10/51/f2/1051f2cc-195f-ddb6-2d9e-26c74f0387fd/197187988518.jpg/600x600bb.jpg",
    small:
      "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/10/51/f2/1051f2cc-195f-ddb6-2d9e-26c74f0387fd/197187988518.jpg/100x100bb.jpg",
    width: 1200,
  },
  barcode: "197187988518",
  coverUrl:
    "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/10/51/f2/1051f2cc-195f-ddb6-2d9e-26c74f0387fd/197187988518.jpg/1200x1200bb.jpg",
  copyright: "(P) 2023 Perpetual Novice",
  country: "USA",
  currency: "USD",
  explicitness: "notExplicit",
  genre: "Indie Pop",
  id: "desire-i-want-to-turn-into-you",
  label: "Perpetual Novice",
  release: "2023",
  releaseDate: "2023-02-14",
  runtime: "45 min 25 sec",
  title: "Desire, I Want to Turn Into You",
  totalTracks: 12,
};

export const albumPageRatingSummary = {
  average: 4.3,
  total: "18.4k ratings",
} as const;

export const albumPageRatingDistribution = [
  { count: 412, rating: "1" },
  { count: 980, rating: "2" },
  { count: 3200, rating: "3" },
  { count: 7600, rating: "4" },
  { count: 6200, rating: "5" },
] as const;

export const albumPageTracks = [
  {
    appleMusicId: "1669095252",
    appleMusicUrl: "https://music.apple.com/us/album/welcome-to-my-island/1669095245?i=1669095252",
    discNumber: 1,
    duration: "3:52",
    durationMs: 232_625,
    id: "welcome-to-my-island",
    isStreamable: true,
    plays: "54M",
    previewUrl:
      "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview126/v4/76/38/8a/76388aec-8f7a-5372-2f15-1e7095d94931/mzaf_6794888258258595864.plus.aac.p.m4a",
    releaseDate: "2022-12-05",
    title: "Welcome to My Island",
    trackNumber: 1,
  },
  {
    appleMusicId: "1669095589",
    appleMusicUrl: "https://music.apple.com/us/album/pretty-in-possible/1669095245?i=1669095589",
    discNumber: 1,
    duration: "3:36",
    durationMs: 216_375,
    id: "pretty-in-possible",
    isStreamable: true,
    plays: "31M",
    previewUrl:
      "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview126/v4/0c/c3/ef/0cc3ef18-af26-376f-20e6-e9910e8b5c6d/mzaf_7999017638410422706.plus.aac.p.m4a",
    releaseDate: "2023-02-14",
    title: "Pretty In Possible",
    trackNumber: 2,
  },
  {
    appleMusicId: "1669095607",
    appleMusicUrl: "https://music.apple.com/us/album/bunny-is-a-rider/1669095245?i=1669095607",
    discNumber: 1,
    duration: "3:13",
    durationMs: 193_957,
    id: "bunny-is-a-rider",
    isStreamable: true,
    plays: "41M",
    previewUrl:
      "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview126/v4/68/35/11/683511ab-3c3a-07ec-6fff-bd328862a92c/mzaf_10894214432596268135.plus.aac.p.m4a",
    releaseDate: "2021-07-14",
    title: "Bunny Is a Rider",
    trackNumber: 3,
  },
  {
    appleMusicId: "1669095781",
    appleMusicUrl: "https://music.apple.com/us/album/sunset/1669095245?i=1669095781",
    discNumber: 1,
    duration: "2:42",
    durationMs: 162_909,
    id: "sunset",
    isStreamable: true,
    plays: "67M",
    previewUrl:
      "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview116/v4/5a/4e/77/5a4e77d1-b3d4-6cde-b24b-1e9a319a7d26/mzaf_2067929147490525201.plus.aac.p.m4a",
    releaseDate: "2022-10-17",
    title: "Sunset",
    trackNumber: 4,
  },
  {
    appleMusicId: "1669095787",
    appleMusicUrl: "https://music.apple.com/us/album/crude-drawing-of-an-angel/1669095245?i=1669095787",
    discNumber: 1,
    duration: "3:29",
    durationMs: 209_068,
    id: "crude-drawing-of-an-angel",
    isStreamable: true,
    plays: "--",
    previewUrl:
      "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview126/v4/ba/e4/54/bae4540f-8e8b-3544-9053-6b9b828bcb7a/mzaf_3613691586692728051.plus.aac.p.m4a",
    releaseDate: "2023-02-14",
    title: "Crude Drawing of An Angel",
    trackNumber: 5,
  },
  {
    appleMusicId: "1669095789",
    appleMusicUrl: "https://music.apple.com/us/album/i-believe/1669095245?i=1669095789",
    discNumber: 1,
    duration: "4:07",
    durationMs: 247_375,
    id: "i-believe",
    isStreamable: true,
    plays: "--",
    previewUrl:
      "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview126/v4/9b/03/e9/9b03e976-300b-b27a-2659-dab883175ba5/mzaf_15284764696778923868.plus.aac.p.m4a",
    releaseDate: "2023-02-14",
    title: "I Believe",
    trackNumber: 6,
  },
  {
    appleMusicId: "1669095986",
    appleMusicUrl: "https://music.apple.com/us/album/fly-to-you-feat-grimes-dido/1669095245?i=1669095986",
    discNumber: 1,
    duration: "4:05",
    durationMs: 245_125,
    id: "fly-to-you",
    isStreamable: true,
    plays: "--",
    previewUrl:
      "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview126/v4/e1/26/a6/e126a63a-4372-cc5f-2dd7-bfc979666e11/mzaf_6930808200073712809.plus.aac.p.m4a",
    releaseDate: "2023-02-14",
    title: "Fly to You (feat. Grimes & Dido)",
    trackNumber: 7,
  },
  {
    appleMusicId: "1669096004",
    appleMusicUrl: "https://music.apple.com/us/album/blood-and-butter/1669095245?i=1669096004",
    discNumber: 1,
    duration: "4:27",
    durationMs: 267_500,
    id: "blood-and-butter",
    isStreamable: true,
    plays: "28M",
    previewUrl:
      "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview116/v4/33/e6/ce/33e6ce61-22a8-3d5b-fe50-409ddf1c7032/mzaf_13903565310141085697.plus.aac.p.m4a",
    releaseDate: "2023-01-31",
    title: "Blood and Butter",
    trackNumber: 8,
  },
  {
    appleMusicId: "1669096171",
    appleMusicUrl: "https://music.apple.com/us/album/hopedrunk-everasking/1669095245?i=1669096171",
    discNumber: 1,
    duration: "3:19",
    durationMs: 199_000,
    id: "hopedrunk-everasking",
    isStreamable: true,
    plays: "--",
    previewUrl:
      "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview116/v4/84/d2/e0/84d2e024-1574-d9bf-5385-36ecdafdf6e2/mzaf_17755801276282400085.plus.aac.p.m4a",
    releaseDate: "2023-02-14",
    title: "Hopedrunk Everasking",
    trackNumber: 9,
  },
  {
    appleMusicId: "1669096178",
    appleMusicUrl: "https://music.apple.com/us/album/butterfly-net/1669095245?i=1669096178",
    discNumber: 1,
    duration: "4:36",
    durationMs: 276_000,
    id: "butterfly-net",
    isStreamable: true,
    plays: "22M",
    previewUrl:
      "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview126/v4/cf/7d/a0/cf7da093-a51f-1473-31dd-8e03559d2d0c/mzaf_649986471454189391.plus.aac.p.m4a",
    releaseDate: "2023-02-14",
    title: "Butterfly Net",
    trackNumber: 10,
  },
  {
    appleMusicId: "1669096183",
    appleMusicUrl: "https://music.apple.com/us/album/smoke/1669095245?i=1669096183",
    discNumber: 1,
    duration: "2:57",
    durationMs: 177_500,
    id: "smoke",
    isStreamable: true,
    plays: "--",
    previewUrl:
      "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview116/v4/51/90/e8/5190e8e8-fe94-7671-28fc-8c7f31936476/mzaf_4181124934957542158.plus.aac.p.m4a",
    releaseDate: "2023-02-14",
    title: "Smoke",
    trackNumber: 11,
  },
  {
    appleMusicId: "1669096369",
    appleMusicUrl: "https://music.apple.com/us/album/billions/1669095245?i=1669096369",
    discNumber: 1,
    duration: "4:57",
    durationMs: 297_515,
    id: "billions",
    isStreamable: true,
    plays: "--",
    previewUrl:
      "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview116/v4/09/aa/4a/09aa4a8b-41f2-baa8-c4c5-003782b3228b/mzaf_12864148059273958722.plus.aac.p.m4a",
    releaseDate: "2022-02-09",
    title: "Billions",
    trackNumber: 12,
  },
] as const;

export const albumPageReviews: ReviewData[] = [
  {
    album: {
      artist: albumPageAlbum.artist,
      coverUrl: albumPageAlbum.coverUrl,
      id: albumPageAlbum.id,
      title: albumPageAlbum.title,
      year: albumPageAlbum.release,
    },
    createdAt: new Date(Date.now() - 38 * 60 * 60 * 1000),
    id: "ap-1",
    liked: true,
    likes: 18_200,
    rating: 4.5,
    review:
      "It has the ridiculous confidence of a pop record that knows exactly how strange it is. The vocal runs feel athletic, the production keeps opening trapdoors, and somehow the whole thing still moves like a summer album.",
    user: { displayUsername: "Noah Bell" },
    userHref: "/user/noahbell",
  },
  {
    album: {
      artist: albumPageAlbum.artist,
      coverUrl: albumPageAlbum.coverUrl,
      id: albumPageAlbum.id,
      title: albumPageAlbum.title,
      year: albumPageAlbum.release,
    },
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    id: "ap-2",
    likes: 742,
    rating: 4,
    review:
      "The album is best when it sounds sunlit and slightly impossible. Sunset and Blood and Butter make the fantasy feel lived in, not staged. A few transitions are thinner than I want, but the peaks are enormous.",
    user: { displayUsername: "Iris Vega" },
    userHref: "/user/irisvega",
  },
  {
    album: {
      artist: albumPageAlbum.artist,
      coverUrl: albumPageAlbum.coverUrl,
      id: albumPageAlbum.id,
      title: albumPageAlbum.title,
      year: albumPageAlbum.release,
    },
    createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
    id: "ap-3",
    likes: 95,
    rating: 3.5,
    review:
      "I admire the craft more than I return to it. The melodies are pristine, but the album sometimes feels like it is sprinting past the emotional center. Butterfly Net is the exception and the reason I keep coming back.",
    user: { displayUsername: "Marta Sol" },
    userHref: "/user/martasol",
  },
];

export const albumPageData: AlbumPageData = {
  album: albumPageAlbum,
  ratingDistribution: [...albumPageRatingDistribution],
  ratingSummary: albumPageRatingSummary,
  reviews: albumPageReviews,
  tracks: [...albumPageTracks],
};

export const albumPageNoRatingsData: AlbumPageData = {
  album: {
    ...albumPageAlbum,
    id: "no-ratings",
  },
  ratingDistribution: [
    { count: 0, rating: "1" },
    { count: 0, rating: "2" },
    { count: 0, rating: "3" },
    { count: 0, rating: "4" },
    { count: 0, rating: "5" },
  ],
  ratingSummary: null,
  reviews: [],
  tracks: [...albumPageTracks],
};
