import { useEffect, useState } from "react";

export function useLocationHash() {
  const [hash, setHash] = useState(window.location.hash.substring(1));

  useEffect(() => {
    const onHashChange = () => {
      setHash(window.location.hash.substring(1));
    }
    window.addEventListener("hashchange", onHashChange);

    return () => {
      window.removeEventListener("hashchange", onHashChange);
    }
  }, [])

  return hash;
}
