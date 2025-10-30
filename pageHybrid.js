import { createGeminiRouter} from "./utils/universal_gemini_router.js"

const DEBUG_MODE = true

const geminiRouter = createGeminiRouter()

// --- Prompt builder for rewrite ---

export function buildPromptContextAwareRewrite(textWithoutPlaceholders, pageContext, mode){
  return `
    Style Settings: ${mode}

    User-Selected Section:
    ${textWithoutPlaceholders}
    `
}

// Prompt for alignment (merge placeholders back in)
export function buildPromptAlign(naturalText, placeholderText) {
  return `You are an AI Text Alignment Specialist. Your task is to analyze a "Natural Text" and a "Text with Placeholders" and rewrite the Natural Text by inserting the placeholders **only** where the surrounding words in the Natural Text logically and semantically match the context of the placeholder in the provided example.

**CRITICAL INSTRUCTIONS:**
1.  **Analyze for Logical Matches:** Carefully compare the two texts. For each placeholder, find the word/phrase in the Natural Text that has the **exact same meaning and role**.
2.  **Insert Tags Precisely:** Rewrite the Natural Text by wrapping the identified word or phrase with the **exact, corresponding placeholder tag**.
3.  **Preserve Original Text:** Do NOT change, add, or remove any words from the "Natural Text" except to insert the tags.
4.  **Handle Placeholders Strictly:**
    -   **Do NOT delete** placeholders that have a match.
    -   **Do NOT duplicate** placeholders.
    -   **Do NOT invent** new placeholders.
5.  **Omit Unmatched Placeholders:** If a placeholder does not have a clear semantic match in the "Natural Text", **omit it entirely**.
6.  **List Omitted Tags:** After the rewritten text, add a line with "#omitted placeholders" followed by a JSON string array of all omitted placeholder tags.

**Example:**
- **Natural Text:** "A personal computer (PC) is a computer for one person. People use it to write, browse the internet."
- **Text with Placeholders:** "A _TS_TAG_0_START[personal computer]_TS_TAG_0_END ( _TS_TAG_1_START[PC]_TS_TAG_1_END ), or simply _TS_TAG_2_START[computer]_TS_TAG_2_END , is a _TS_TAG_3_START[computer]_TS_TAG_3_END designed for individual use. _TS_TAG_7_START[_TS_TAG_6_START[_TS_TAG_4_START[[]_TS_TAG_4_END1_TS_TAG_5_START[]]_TS_TAG_5_END]_TS_TAG_6_END]_TS_TAG_7_END It is typically used for tasks such as _TS_TAG_8_START[word processing]_TS_TAG_8_END , _TS_TAG_9_START[internet browsing]_TS_TAG_9_END , _TS_TAG_10_START[email]_TS_TAG_10_END , _TS_TAG_11_START[multimedia]_TS_TAG_11_END playback, and _TS_TAG_12_START[gaming]_TS_TAG_12_END ."

- **Output:**
"A _TS_TAG_0_START[personal computer]_TS_TAG_0_END (_TS_TAG_1_START[PC]_TS_TAG_1_END) is a computer for one person. People use it to write, browse the internet."
#omitted placeholders
["_TS_TAG_2_START[computer]_TS_TAG_2_END", "_TS_TAG_3_START[computer]_TS_TAG_3_END", "_TS_TAG_7_START[_TS_TAG_6_START[_TS_TAG_4_START[[]_TS_TAG_4_END1_TS_TAG_5_START[]]_TS_TAG_5_END]_TS_TAG_6_END]_TS_TAG_7_END", "_TS_TAG_8_START[word processing]_TS_TAG_8_END", "_TS_TAG_9_START[internet browsing]_TS_TAG_9_END", "_TS_TAG_10_START[email]_TS_TAG_10_END", "_TS_TAG_11_START[multimedia]_TS_TAG_11_END", "_TS_TAG_12_START[gaming]_TS_TAG_12_END"]

**Your Task:**
- **Natural Text:** "${naturalText}"
- **Text with Placeholders:** "${placeholderText}"

**Output:`;
}

// --- Hybrid AI handler ---
export async function performRewrite(eventData) {
  let {
    textWithPlaceholders,
    textWithoutPlaceholders,
    rewriteWithFormat,
    context,
    tone,
    complexity,
    brevity,
    mode
  } = eventData;
  const profile = { tone, complexity, brevity };
  
  const freeWritePrompt = buildPromptContextAwareRewrite(
    textWithoutPlaceholders,
    context,
    mode
  );
  //debugLog("context aware prompt: ", freeWritePrompt)

  let reply = ""
  let result = {}
  
  const fluentResult = await geminiRouter.ask({
    text: freeWritePrompt,
    history:[],
    persistSession:false,
    systemPrompt: `
      You are an AI text editor. Rewrite only the user-selected section according to the style settings provided.
      Rules:
      - Rewrite only the user-selected section.
      - Interpret the style settings directly and apply them faithfully in tone, word choice, and structure.
      - Keep the original meaning — do not add or remove facts.
      - The result must read smoothly, naturally, and feel complete in context.
    `
  })
  result=fluentResult
  console.log(result)
  return result
}

debugLog("✅ Modular Hybrid AI handler ready");

function debugLog(...args) {
  if (DEBUG_MODE) console.log("[Gemini Debug]", ...args);
}