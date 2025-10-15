// Helper module to compute context for AI rewriting
// Injected into page via content.js

// ---------- CONFIG ----------
const MAX_TOKENS = 1024          // safe token limit for gemini-2.5-flash
const SELECTION_THRESHOLD = 500;  // large selection threshold
const PARAGRAPH_COUNT = 2;        // paragraphs before/after selection
const INPUT_TOKEN_LIMIT = 500
const OUTPUT_TOKEN_LIMIT = 500
const CHAR_PER_TOKEN = 4 // number of character for 1 token

// ---------- SUMMARY CACHE ----------
const summaryCache = new Map(); // cache summaries per page

// ---------- HELPER FUNCTIONS ----------

// Rough token estimate (1 token ≈ 4 characters)
export function estimateTokens(textLength) {
  return Math.ceil(textLength / CHAR_PER_TOKEN);
}

function calculateTextLength(tokenCount){
  return tokenCount * CHAR_PER_TOKEN
}

// Extract paragraphs around selection
export function getSurroundingParagraphs(fullText, selectionText, paragraphCount = PARAGRAPH_COUNT) {
  const paragraphs = fullText.split(/\n+/).filter(p => p.trim() !== '');
  const selectionIndex = paragraphs.findIndex(p => p.includes(selectionText.trim()));

  if (selectionIndex === -1) {
    // fallback: first few paragraphs
    return paragraphs.slice(0, paragraphCount * 2 + 1).join('\n\n');
  }

  const start = Math.max(selectionIndex - paragraphCount, 0);
  const end = Math.min(selectionIndex + paragraphCount + 1, paragraphs.length);
  return paragraphs.slice(start, end).join('\n\n');
}


// Summarize page text using AI (replace stub with your summarizer)
export async function getPageSummary(pageId, pageText) {
  if (summaryCache.has(pageId)) return summaryCache.get(pageId);

  console.log("successfully called > getPageSummary")

  const summary = await greet(pageText)
  summaryCache.set(pageId, summary)
  return summary;
}

// ---------- MAIN ENTRY POINT ----------
/**
 * Computes page context for rewriting a user-selected section.
 *
 * @param {string} pageId - Unique page identifier (URL or hash)
 * @param {string} fullPageText - Extracted plain text of the page (from Readability)
 * @param {string} fullPageHTML - Extracted HTML of the page (from Readability)
 * @param {string} selectedText - Text selected by the user
 * @returns {Promise<string>} - Context string ready to pass to prompt builder
 */
export async function getRewriteContext(pageId, fullPageText, selectedText) {
  if (!fullPageText || !selectedText) return '';
  console.log("called to get rewrite context")
  //console.log("PAGE ID: ", pageId, "\nFULLPAGETEXT-LENGTH", fullPageText.length, "\nSELECTED TEXT:", selectedText)
  //return

  // Note: Use surrounding paragraphs as context due to summarizer token limit
  const context = getContextText(fullPageText, selectedText)
  //console.log("context: ", context)
  return context

  if (fullPageText.length < MAX_TOKENS) {
    // Small page → full text as context
    return fullPageText;
  } else if (selectedText.length > SELECTION_THRESHOLD) {
    // Large selection → surrounding paragraphs
    return getSurroundingParagraphs(fullPageText, selectedText);
  } else {
    // Hybrid: summary + surrounding paragraphs
    const summary = await getPageSummary(pageId, fullPageText.replace(selectedText, ''));
    const surrounding = getSurroundingParagraphs(fullPageText, selectedText);
    return `Page Summary:\n${summary}\n\nSurrounding Paragraphs:\n${surrounding}`;
  }
}

// messageManager.js
const pendingRequests = new Map(); // id -> {resolve, reject}

window.addEventListener("message", (event) => {
  if (event.source !== window) return; // only accept messages from the page itself
  const data = event.data;

  if (data?.type === "TS-SUMMARIZE-TEXT-RESPONSE" && data?.id) {
    const handlers = pendingRequests.get(data.id);
    if (handlers) {
      handlers.resolve(data.response);
      pendingRequests.delete(data.id); // clean up
    }
  }
});

export function greet(pageText) {
  return new Promise((resolve, reject) => {
    const id = Date.now() + Math.random(); // unique ID for this request

    pendingRequests.set(id, { resolve, reject });

    window.postMessage(
      { type: "TS-SUMMARIZE-TEXT", text: pageText, id },
      "*" // "*" is fine for content script <-> page
    );

    // Optional timeout
    setTimeout(() => {
      if (pendingRequests.has(id)) {
        reject(new Error("No response received in time"));
        pendingRequests.delete(id);
      }
    }, 50000); // 5 sec timeout
  });
}

/**
 * Extracts a contextual snippet around a selected portion of text,
 * ensuring the result does not exceed the specified maximum length.
 *
 * Behavior:
 *  - Splits fullText into sentences (keeps trailing punctuation).
 *  - Locates selectedText inside fullText (by char index), maps to sentence indices.
 *  - Uses the selected sentence block as the initial context.
 *  - Expands outward (before/after) while the total length <= maxLength.
 *  - Edge cases:
 *      - If selection not found -> return ""
 *      - If selection covers entire text -> return ""
 *      - If selected block length > maxLength -> return ""
 *
 * @param {string} fullText
 * @param {string} selectedText
 * @param {number} maxLength (defaults to your existing calculateTextLength(INPUT_TOKEN_LIMIT))
 * @returns {string} contextual snippet (or "" per edge-case rules)
 */
export function getContextText(fullText, selectedText, maxLength=calculateTextLength(INPUT_TOKEN_LIMIT)) {
  //console.log("getContextText called")
  if (!fullText || !selectedText) {console.log("no full or selected text"); return ""};
  //console.log("full text length: ", fullText.length)
  //console.log("select text: ", selectedText)

  // Simple sentence splitter that keeps trailing punctuation (., ?, !).  It's not perfect,
  // but it's safer than splitting only on ".".
  const sentenceRegex = /[^.?!]+[.?!]*/g;
  let sentencesWithPos = [];
  let match;
  while ((match = sentenceRegex.exec(fullText)) !== null) {
    const txt = match[0].trim();
    if (txt.length > 0) {
      sentencesWithPos.push({
        text: txt,
        start: match.index,
        end: match.index + match[0].length - 1
      });
    }
  }

  if (sentencesWithPos.length === 0){console.log("empty sentence pos"); return ""};

  const sentences = sentencesWithPos.map(s => s.text);

  // Find selection position in the original fullText
  const sel = selectedText.trim();
  const selStart = fullText.indexOf(sel);
  if (selStart === -1){console.log("no selStart found"); return ""};

  const selEnd = selStart + sel.length - 1;

  // Map selection char indices to sentence indices
  let startIndex = -1;
  let endIndex = -1;
  for (let i = 0; i < sentencesWithPos.length; i++) {
    const s = sentencesWithPos[i];
    if (s.start <= selStart && selStart <= s.end) startIndex = i;
    if (s.start <= selEnd && selEnd <= s.end) endIndex = i;
    if (startIndex !== -1 && endIndex !== -1) break;
  }

  if (startIndex === -1 || endIndex === -1){console.log("no start or end index");return ""};

  // If selection covers entire text, nothing to expand — return empty string
  if (startIndex === 0 && endIndex === sentences.length - 1){console.log("selection covers entire block"); return ""};

  // Build initial context
  let context = sentences.slice(startIndex, endIndex + 1).join(" ");
  if (context.length > maxLength) {
    console.log('Selected block already too long — per your rule, return empty string')
    return "";
  }

  // Expand outward while keeping under maxLength
  while (true) {
    let added = false;

    // Expand before (if available)
    if (startIndex > 0) {
      const candidate = sentences[startIndex - 1] + " " + context;
      if (candidate.length <= maxLength) {
        context = candidate;
        startIndex -= 1;
        added = true;
      }
    }

    // Expand after (if available)
    if (endIndex < sentences.length - 1) {
      const candidate = context + " " + sentences[endIndex + 1];
      if (candidate.length <= maxLength) {
        context = candidate;
        endIndex += 1;
        added = true;
      }
    }

    if (!added) break;
  }

  console.log("there is context with length: ",context.length)
  return context.trim();
}


