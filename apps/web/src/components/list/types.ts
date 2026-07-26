export interface ListAlbum {
  artist: string;
  coverUrl?: null | string;
  id: string;
  title: string;
  year: string;
}

export interface ListAuthor {
  avatarUrl?: string;
  displayName: string;
  username: string;
}

export interface ListDetails {
  albums: ListAlbum[];
  author: ListAuthor;
  canEdit: boolean;
  description?: string;
  id: string;
  title: string;
  updatedAt: Date;
}

export interface ListSummary {
  coverAlbums: ListAlbum[];
  description?: string;
  id: string;
  itemCount: number;
  title: string;
  updatedAt: Date;
}
