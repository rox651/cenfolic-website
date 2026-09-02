import { createHash } from "node:crypto";

export function calculatePostContentHash(
  titleHtml: string,
  contentHtml: string,
): string {
  // WordPress assigns this class a request-order suffix. Adding a post can
  // renumber every older post even though their actual content did not change.
  const stableContentHtml = contentHtml.replace(
    /\bis-style-text-subtitle--\d+\b/g,
    "is-style-text-subtitle",
  );

  return createHash("sha256")
    .update(titleHtml, "utf8")
    .update("\0")
    .update(stableContentHtml, "utf8")
    .digest("hex");
}
