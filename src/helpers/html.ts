import { unified } from "unified";
import rehypeParse from "rehype-parse";
import { visit } from "unist-util-visit";

const htmlToTextProcessor = unified().use(rehypeParse, { fragment: true });

export function extractTextFromHTML(html: string): string {
  const tree = htmlToTextProcessor.parse(html);
  let text = "";

  visit(tree, "text", (node: any) => {
    text += `${node.value} `;
  });

  return text.trim().replace(/\s+/g, " ");
}


