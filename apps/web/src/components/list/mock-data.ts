// Throwaway fixtures for the /list/:listId design mock. Delete this file when the real
// list service lands and the route switches to useQuery.
import type { ListAlbum, ListDetails, ListSummary } from "./types";

const hour = 60 * 60 * 1000;
const day = 24 * hour;

function cover(index: number) {
  return `/mock-covers/0${index}.svg`;
}

function album(id: string, title: string, artist: string, year: string, coverIndex: number): ListAlbum {
  return { artist, coverUrl: cover(coverIndex), id, title, year };
}

const lifers: ListAlbum[] = [
  album("mock-a1", "Spiderland", "Slint", "1991", 1),
  album("mock-a2", "Loveless", "My Bloody Valentine", "1991", 6),
  album("mock-a3", "In the Aeroplane Over the Sea", "Neutral Milk Hotel", "1998", 4),
  album("mock-a4", "The Glow Pt. 2", "The Microphones", "2001", 8),
  album("mock-a5", "Illinois", "Sufjan Stevens", "2005", 5),
  album("mock-a6", "Kid A", "Radiohead", "2000", 3),
  album("mock-a7", "Since I Left You", "The Avalanches", "2000", 2),
  album("mock-a8", "Fetch the Bolt Cutters", "Fiona Apple", "2020", 7),
  album("mock-a9", "A Love Supreme", "John Coltrane", "1965", 5),
  album("mock-a10", "Blonde", "Frank Ocean", "2016", 6),
  album("mock-a11", "Rumours", "Fleetwood Mac", "1977", 2),
  album("mock-a12", "Voodoo", "D'Angelo", "2000", 8),
];

const bestOfYear: ListAlbum[] = [
  album("mock-b1", "Bright Future", "Adrianne Lenker", "2024", 6),
  album("mock-b2", "Diamond Jubilee", "Cindy Lee", "2024", 3),
  album("mock-b3", "Only God Was Above Us", "Vampire Weekend", "2024", 5),
  album("mock-b4", "Wall of Eyes", "The Smile", "2024", 1),
  album("mock-b5", "Endlessness", "Nala Sinephro", "2024", 7),
];

export const mockListSummaries: ListSummary[] = [
  {
    coverAlbums: lifers,
    description:
      "Not the best albums ever made — the ones that rearranged something. Mostly guitars, mostly people who sound like they recorded in a room.",
    id: "lifers",
    itemCount: lifers.length,
    title: "The 20 albums that made me",
    updatedAt: new Date(Date.now() - 3 * day),
  },
  {
    coverAlbums: bestOfYear,
    description: "Provisional, obviously. Ask me again in December.",
    id: "best-of-2025",
    itemCount: bestOfYear.length,
    title: "Best of the year so far",
    updatedAt: new Date(Date.now() - 9 * hour),
  },
  {
    coverAlbums: [],
    id: "sunday-morning",
    itemCount: 0,
    title: "Sunday morning, nothing to do",
    updatedAt: new Date(Date.now() - 4 * hour),
  },
];

const mockAuthor = {
  displayName: "Miguel",
  username: "miguel",
};

const mockListsById: Record<string, ListDetails> = {
  "best-of-2025": {
    albums: bestOfYear,
    author: mockAuthor,
    canEdit: true,
    description: "Provisional, obviously. Ask me again in December.",
    id: "best-of-2025",
    title: "Best of the year so far",
    updatedAt: new Date(Date.now() - 9 * hour),
  },
  lifers: {
    albums: lifers,
    author: mockAuthor,
    canEdit: true,
    description:
      "Not the best albums ever made — the ones that rearranged something. Mostly guitars, mostly people who sound like they recorded in a room.",
    id: "lifers",
    title: "The 20 albums that made me",
    updatedAt: new Date(Date.now() - 3 * day),
  },
  "sunday-morning": {
    albums: [],
    author: mockAuthor,
    canEdit: true,
    id: "sunday-morning",
    title: "Sunday morning, nothing to do",
    updatedAt: new Date(Date.now() - 4 * hour),
  },
};

export function getMockList(listId: string): ListDetails | undefined {
  return mockListsById[listId];
}
