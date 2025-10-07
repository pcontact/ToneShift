// --------------------
// ToneShift Hybrid AI handler (Chrome Nano + Gemini fallback)
// Now modular ES module

// --- Module-scoped state ---
let cloudModel = null;
let _rewriteWithFormat = false; // indicate if we will use buildPromptAlign in the pipeline

// --- API key bridge ---
export function getApiKey() {
  return new Promise((resolve) => {
    window.postMessage({ type: "TS_GET_API_KEY" }, "*");

    function handler(event) {
      if (event.source !== window) return;
      if (event.data.type === "TS_API_KEY") {
        window.removeEventListener("message", handler);
        resolve(event.data.apiKey);
      }
    }

    window.addEventListener("message", handler);
  });
}

// --- Init Gemini Cloud ---
async function getCloudModel() {
  if (!cloudModel) {
    const key = await getApiKey();
    if (!key) throw new Error("No Gemini API key set. Please add it in popup.");
    //console.log(":::::::",window.GoogleGenerativeAI)
    const genAI = new window.GoogleGenerativeAI(key);
    cloudModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    console.log("✅ Gemini cloud model initialized with user key");
  }
  return cloudModel;
}

// --- Chrome Nano ---
async function tryChromeAI(promptText) {
  if (!(window.ai && window.ai.languageModel)) return null;

  try {
    console.log("Using Chrome built-in AI (Nano)...");
    const session = await window.ai.languageModel.create({
      temperature: 0.7,
      topK: 40,
    });
    const response = await session.prompt(promptText);
    return response;
  } catch (err) {
    console.warn("Chrome AI failed:", err);
    return null;
  }
}

// --- Gemini Cloud ---
async function tryGeminiCloud(promptText) {
  try {
    console.log("☁️ Using Gemini cloud API...");
    const model = await getCloudModel();
    const rawOutput = await model.generateContent(promptText);
    const output = rawOutput?.response?.text() || "⚠️ No response from Gemini";
    return { success: true, text: output };
  } catch (err) {
    let message = "⚠️ Error: " + err.message;
    if (err.message.includes("No Gemini API key")) {
      message =
        "⚠️ No API key found. Please open the ToneShift popup and add your Gemini API key.";
    }
    console.error("Gemini error:", err);
    return { success: false, error: message };
  }
}

// --- Summarizer function to export ---
async function summarizeText(text) {
  const prompt = buildPromptSummary(text)
  let output = await tryChromeAI(prompt)

 // fallback Gemini if needed
  if (!output) {
    let result = await tryGeminiCloud(prompt);
    if (result.success) {
      return result.text
    }
  }
  return output.text
}


// -- Concise Prompt builder for summary (no added ideas) --
export function buildPromptSummary(textToSummarize) {
  return `
    "Please summarize the following text clearly and concisely. 
    Highlight the main ideas, key points, and any important details. 
    Keep the summary coherent and easy to understand. If possible, maintain the tone of the original text.
    Here is the text:
    ${textToSummarize}
  `;
}


// --- Prompt builder for rewrite ---
export function buildPromptContextAwareRewrite(
  textWithoutPlaceholders,
  pageContext,
  { tone, complexity, brevity }
) {
  return `
You are an AI text editor. Rewrite the user-selected section according to these settings:

// --- Prompt builder ---
function buildPrompt(text, tone, complexity, brevity) {
  return `
You are an AI text editor. Rewrite the text below according to the user’s settings.

User Settings:
- Tone: ${tone}
- Complexity: ${complexity}
- Brevity: ${brevity}

Rules for Rewriting:
1. Follow the tone precisely.
2. Adjust vocabulary and sentence structure to match complexity.
3. Match verbosity or conciseness based on brevity.
4. Keep meaning accurate — don’t add new information.
5. Produce polished, natural-sounding text.

Rules for Placeholders:
- Placeholders are marked as:  _TS_TAG_X_START[original text]_TS_TAG_X_END
- The text inside [ ... ] is the part directly affected by the placeholder tag.
- You may move the placeholder and its text within the sentence if needed for natural flow, but always keep the START and END markers around the same text span.
- Never delete or duplicate a placeholder.
- Do not alter the placeholder markers (_TS_TAG_X_START / _TS_TAG_X_END).
- You may rewrite the text inside [ ... ] for tone, complexity, or brevity, but its semantic role must remain the same.

Text to rewrite:
${text}
`;
}


  // --- Chrome Nano ---
  async function tryChromeAI(promptText) {
    if (!(window.ai && window.ai.languageModel)) return null;

    try {
      console.log("Using Chrome built-in AI (Nano)...");
      const session = await window.ai.languageModel.create({
        temperature: 0.7,
        topK: 40,
      });
      const response = await session.prompt(
        promptText
      );
      return response;
    } catch (err) {
      console.warn("Chrome AI failed:", err);
      return null;
    }
    return;
  }

  // Chrome Nano succeeded
  let result2 = { success: false };
  if (_rewriteWithFormat) {
    result2 = await tryChromeAI(buildPromptAlign(output, textWithPlaceholders));
  } else {
    result2 = output;
  }

  window.postMessage({ type: "TS_GEMINI_RESPONSE", text: result2 }, "*");
  return;
}

console.log("✅ Modular Hybrid AI handler ready");

export function initHybridListener() {
  window.addEventListener("message", async (event) => {
    if (event.source !== window) return;
    if (event.data.type !== "TS_GEMINI_REQUEST") return;
    await handleHybridRequest(event.data);
  });

    const { textWithPlaceholders, textWithoutPlaceholders, tone, complexity, brevity } = event.data;
    const profile = {tone, complexity, brevity}

    const freeWritePrompt = buildPromptFreeRewrite(textWithoutPlaceholders, profile)

    //console.log("received: ", event.data.type)

    try {
      // Step 1: try Chrome Nano
      let output = await tryChromeAI(freeWritePrompt);

      // Step 2: fallback if needed
      if (!output) {
        const fluentRewrite = await tryGeminiCloud(freeWritePrompt);
        console.log("fluenRewrite: ", fluentRewrite)

        let result = {success:false}
        if (fluentRewrite.success){
          result = await tryGeminiCloud(buildPromptAlign(fluentRewrite.text, textWithPlaceholders))
          console.log("After alignment: ", result)
        }

        if (result.success) {
          window.postMessage(
            { type: "TS_GEMINI_RESPONSE", text: result.text },
            "*"
          );
        } else {
          window.postMessage(
            { type: "TS_GEMINI_ERROR", error: result.error },
            "*"
          );
        }
        return;
      }

      // If Chrome Nano succeeded
      const result2 = await tryChromeAI(buildPromptAlign(output, textWithPlaceholders))

      window.postMessage({ type: "TS_GEMINI_RESPONSE", text: result2 }, "*");
    } catch (err) {
      console.error("Hybrid handler error:", err);
      window.postMessage(
        { type: "TS_GEMINI_ERROR", error: err.message || "Unknown error" },
        "*"
      );
    }
  });
}
initHybridListener()



// === Hybrid Two-Pass Rewrite Pipeline ===
// Prompt for free rewrite (fluency, tone/complexity/brevity)
function buildPromptFreeRewrite(textWithoutPlaceholders, { tone, complexity, brevity }) {
  console.log("calling buildPromptFreeRewrite: ", textWithoutPlaceholders)
  return `
You are an AI text editor. Rewrite the text according to these settings:

- Tone: ${tone}
- Complexity: ${complexity}
- Brevity: ${brevity}

Rules:
1. Match tone precisely.
2. Adjust vocabulary and sentence structure to fit complexity.
3. Match verbosity or conciseness to brevity.
4. Keep meaning accurate, no new facts.
5. Produce fluent, natural, polished text.

Text:
${textWithoutPlaceholders}
`;
}

// Prompt for alignment (merge placeholders back in)
function buildPromptAlign(naturalText, placeholderText) {
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

  console.log("✅ Hybrid AI handler ready (Chrome Nano + Gemini fallback)");
})();
