export function extractMainTextFromDocument(inputDocument) {
  if (!inputDocument || !inputDocument.body) {
    console.warn("extractMainTextFromDocument: Invalid document passed");
    return "";
  }

  // --- Clone the document deeply to avoid touching the live DOM ---
  const clonedDoc = inputDocument.cloneNode(true);
  //console.log(clonedDoc.body.innerText)

  // --- Helpers ---
  function isBoilerplate(node) {
    return /aside|nav|footer|header|sidebar|ads|advertisement/i.test(node.className || "");
  }

  function scoreNode(node) {
    const textLength = node.textContent.trim().length;
    if (textLength < 50) return 0;

    const paragraphs = Math.max(node.querySelectorAll("p").length, 1);
    const links = node.querySelectorAll("a").length;
    const linkDensity = links / Math.max(textLength, 1);

    let score = textLength * paragraphs * (1 - linkDensity);

    const tag = node.tagName.toLowerCase();
    if (tag === "article") score *= 1.5;
    if (tag === "main") score *= 1.3;
    if (tag === "section") score *= 1.2;

    return score;
  }

  function detectMainContainer(document) {
    const candidates = Array.from(document.querySelectorAll("article, main, section, div"))
      .filter(node => !isBoilerplate(node));

    let bestNode = null;
    let bestScore = 0;

    for (const node of candidates) {
      const score = scoreNode(node);
      if (score > bestScore) {
        bestScore = score;
        bestNode = node;
      }
    }

    return bestNode;
  }

  function extractContentNodes(container) {
    if (!container) return [];
    const children = Array.from(container.children).filter(
      c => !isBoilerplate(c) && c.textContent.trim().length > 30
    );

    if (children.length === 0) return [container];

    const scored = children.map(c => ({ node: c, score: scoreNode(c) }));
    const threshold = Math.max(...scored.map(c => c.score)) * 0.3;

    return scored
      .filter(c => c.score >= threshold)
      .sort((a, b) =>
        a.node.compareDocumentPosition(b.node) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
      )
      .map(c => c.node);
  }

  function nodeToMarkdown(node) {
    const tag = node.tagName?.toLowerCase();
    if (!tag) return node.textContent.trim();

    if (/^h[1-6]$/.test(tag)) return `\n${"#".repeat(tag[1])} ${node.textContent.trim()}\n`;
    if (tag === "p" || tag === "div") return `${node.textContent.trim()}\n`;
    if (tag === "li") return `- ${node.textContent.trim()}\n`;
    if (tag === "pre" || tag === "code")
      return `\n\`\`\`\n${node.textContent.trim()}\n\`\`\`\n`;
    if (tag === "figure") {
      const img = node.querySelector("img");
      const caption =
        node.querySelector("figcaption")?.textContent.trim() || img?.alt || "";
      return caption ? `![${caption}](${img?.src || ""})\n` : "";
    }

    return Array.from(node.childNodes || [])
      .map(child =>
        child.nodeType === 3 ? child.textContent.trim() : nodeToMarkdown(child)
      )
      .join("");
  }

  // --- Main extraction pipeline ---
  try {
    const bodyClone = clonedDoc.body.cloneNode(true);
    ["script", "style", "noscript", "iframe", ".ads", ".advertisement"].forEach(sel => {
      bodyClone.querySelectorAll(sel).forEach(node => node.remove());
    });

    const mainContainer = detectMainContainer(bodyClone);
    if (!mainContainer) return "";

    const nodes = extractContentNodes(mainContainer);
    const result = nodes
      .map(nodeToMarkdown)
      .join("\n\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    return result;
  } catch (err) {
    console.error("extractMainTextFromDocument failed:", err);
    return "";
  }
}
