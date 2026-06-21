import { Link, useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useState } from "react";
import { AlbumSearchInput, AlbumSearchOverlay } from "@/components/album-search";

function LogoHomeLink() {
  return (
    <Link
      aria-label="Go to home"
      className="inline-flex size-8 items-center justify-center rounded-sm transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      to="/"
    >
      <img alt="" className="size-8 shrink-0" height={32} src="/favicon-dark.ico" width={32} />
    </Link>
  );
}

export function TopBar() {
  const navigate = useNavigate();
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const handleAlbumSelect = (album: { id: string }) => {
    navigate({ to: "/album/$albumId", params: { albumId: album.id } });
  };

  return (
    <>
      <AlbumSearchOverlay
        isOpen={mobileSearchOpen}
        onClose={() => setMobileSearchOpen(false)}
        onSelect={handleAlbumSelect}
      />
      <div className="border-border border-b px-6 py-4 xl:px-16 2xl:px-24">
        {/* Mobile: logo left, actions right */}
        <div className="flex items-center justify-between lg:hidden">
          <LogoHomeLink />
          <div className="flex items-center gap-3">
            <button
              aria-label="Search"
              className="text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setMobileSearchOpen(true)}
              type="button"
            >
              <Search className="size-5" />
            </button>
            <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary font-medium text-primary-foreground text-xs uppercase">
              M
            </div>
          </div>
        </div>
        {/* Desktop: three-column */}
        <div className="hidden grid-cols-3 items-center gap-4 lg:grid">
          <LogoHomeLink />
          <AlbumSearchInput onSelect={handleAlbumSelect} />
          <div className="flex items-center justify-end gap-2.5">
            <span className="text-muted-foreground text-sm">Miguel</span>
            <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary font-medium text-primary-foreground text-xs uppercase">
              M
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
