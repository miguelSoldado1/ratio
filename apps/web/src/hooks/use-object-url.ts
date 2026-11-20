import { useEffect, useState } from "react";

// A blob: URL for previewing a picked file, released when the file changes or the component unmounts.
export function useObjectUrl(file: File | undefined) {
  const [objectUrl, setObjectUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!file) return setObjectUrl(undefined);

    const nextObjectUrl = URL.createObjectURL(file);
    setObjectUrl(nextObjectUrl);

    return () => URL.revokeObjectURL(nextObjectUrl);
  }, [file]);

  return objectUrl;
}
