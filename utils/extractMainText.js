(function() {
  let extractionDone = false;
  let debounceTimer = null;
  const MAX_WAIT = 5000;

  /**
   * --- Begin Readability 2.0 code ---
   * Browser-native main content extraction
   */

  function linkDensity(node) {
    const links = node.querySelectorAll("a");
    const textLength = node.textContent.trim().length || 1;
    let linkLength = 0;
    links.forEach(a => linkLength += a.textContent.trim().length);
    return linkLength / textLength;
  }

  function detectMainContent(document) {
    const containers = Array.from(document.querySelectorAll("article, main, section, div"));
    let bestScore = 0;
    let mainContainer = null;

    containers.forEach(node => {
      if (/aside|nav|footer|header|sidebar|ads|advertisement/i.test(node.className)) return;
      const text = node.textContent.trim();
      if (text.length < 50) return;

      const links = node.querySelectorAll("a").length;
      const paragraphs = node.querySelectorAll("p").length;
      const ld = links / Math.max(text.length, 1);
      let score = text.length * paragraphs * (1 - ld);

      if (node.tagName.toLowerCase() === "article") score *= 1.5;
      if (node.tagName.toLowerCase() === "main") score *= 1.3;

      if (score > bestScore) {
        bestScore = score;
        mainContainer = node;
      }
    });

    return mainContainer;
  }

  function detectAndMergeColumns(mainContainer) {
    if (!mainContainer) return [];

    const children = Array.from(mainContainer.children).filter(node => {
      return !/aside|nav|footer|header|sidebar|ads|advertisement/i.test(node.className || "") &&
             node.textContent.trim().length > 30;
    });

    const scoredChildren = children.map(node => {
      const paragraphs = node.querySelectorAll("p").length;
      const links = node.querySelectorAll("a").length;
      const textLength = node.textContent.trim().length;
      const ld = links / Math.max(textLength, 1);
      let score = textLength * paragraphs * (1 - ld);

      if (node.tagName.toLowerCase() === "article") score *= 1.5;
      if (node.tagName.toLowerCase() === "section") score *= 1.2;

      return { node, score };
    });

    const threshold = Math.max(...scoredChildren.map(c => c.score)) * 0.3;
    return scoredChildren
      .filter(c => c.score >= threshold)
      .sort((a, b) => (a.node.compareDocumentPosition(b.node) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
      .map(c => c.node);
  }

  function nodeToMarkdown(node) {
    const tag = node.tagName?.toLowerCase();
    if (/^h[1-6]$/.test(tag)) return `\n${"#".repeat(tag[1])} ${node.textContent.trim()}\n`;
    if (tag === "p") return `${node.textContent.trim()}\n`;
    if (tag === "li") return `- ${node.textContent.trim()}\n`;
    if (tag === "pre" || tag === "code") return `\n\`\`\`\n${node.textContent.trim()}\n\`\`\`\n`;
    if (tag === "figure") {
      const img = node.querySelector("img");
      const caption = node.querySelector("figcaption")?.textContent.trim() || img?.alt || "";
      return caption ? `![${caption}](${img?.src || ""})\n` : "";
    }

    return Array.from(node.childNodes || [])
      .map(child => child.nodeType === 3 ? child.textContent.trim() : nodeToMarkdown(child))
      .join("");
  }

  function extractMainTextContent() {
    const bodyClone = document.body.cloneNode(true);

    ["script", "style", "noscript", "iframe", ".ads", ".advertisement"].forEach(sel => {
      bodyClone.querySelectorAll(sel).forEach(node => node.remove());
    });

    const mainContainer = detectMainContent(bodyClone);
    if (!mainContainer) return "";

    const columns = detectAndMergeColumns(mainContainer);
    const markdown = columns.map(node => nodeToMarkdown(node)).join("\n\n").replace(/\n{3,}/g, "\n\n").trim();

    return markdown;
  }

  /**
   * --- End Readability 2.0 code ---
   */

  function extractMainText() {
    try {
      if (extractionDone) return;

      const text = extractMainTextContent();

      window.postMessage({
        type: 'TONESHIFT_MAIN_TEXT',
        text: text || null
      }, '*');

      extractionDone = true;
      if (observer) observer.disconnect();
      clearTimeout(timeoutTimer);

    } catch (e) {
      console.warn('Error extracting main text:', e);
    }
  }

  const observer = new MutationObserver(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(extractMainText, 300);
  });

  observer.observe(document.body, { childList: true, subtree: true });

  const timeoutTimer = setTimeout(() => {
    if (!extractionDone) {
      console.warn("Main text extraction timed out.");
      observer.disconnect();
    }
  }, MAX_WAIT);

  // Initial extraction attempt
  extractMainText();
})();
