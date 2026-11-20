import { useEffect, useState } from "react";

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
