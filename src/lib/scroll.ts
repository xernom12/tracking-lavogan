export const scrollWindowToTop = () => {
  if (typeof window === "undefined") return;

  const isJsDom = typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent);
  if (isJsDom) return;

  try {
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch {
    try {
      window.scrollTo(0, 0);
    } catch {
      // no-op
    }
  }
};
