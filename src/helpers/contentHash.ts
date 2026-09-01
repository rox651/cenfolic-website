import { createHash } from "node:crypto";

export function calculatePostContentHash(
  titleHtml: string,
  contentHtml: string,
): string {
  return createHash("sha256")
    .update(titleHtml, "utf8")
    .update("\0")
    .update(contentHtml, "utf8")
    .digest("hex");
}
