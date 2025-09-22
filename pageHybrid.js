(function () {
  let cloudModel = null;

  // --- API key bridge ---
  function getApiKey() {
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
      const genAI = new window.GoogleGenerativeAI(key);
      cloudModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      console.log("✅ Gemini cloud model initialized with user key");
    }
    return cloudModel;
  }

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
  }

  // --- Gemini Cloud ---
  async function tryGeminiCloud(promptText) {
    try {
      console.log("☁️ Using Gemini cloud API...");
      const model = await getCloudModel();
      const rawOutput = await model.generateContent(promptText);
      const output =
        rawOutput?.response?.text() || "⚠️ No response from Gemini";
      //console.log("model output:", output);
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

  // --- Listener ---
  window.addEventListener("message", async (event) => {
    if (event.source !== window) return;
    if (event.data.type !== "TS_GEMINI_REQUEST") return;

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
        const result = await tryGeminiCloud(buildPromptAlign(fluentRewrite, textWithPlaceholders))

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


// === Hybrid Two-Pass Rewrite Pipeline ===
// Prompt for free rewrite (fluency, tone/complexity/brevity)
function buildPromptFreeRewrite(textWithoutPlaceholders, { tone, complexity, brevity }) {
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
function buildPromptAlign(fluentRewrite, textWithPlaceholders) {
  return `
You are an AI alignment editor. 
We already have a fluent rewrite (correct tone/complexity/brevity) and the original text with placeholders.

Task:
- Use the fluent rewrite as the base wording.
- Reinsert all placeholders (_TS_TAG_X_START ... _END) from the tagged original.
- Do not delete, duplicate, or invent placeholders.
- You may move placeholders slightly for natural flow, but their semantic role must stay the same.
- Do not change the tone, complexity, or brevity from the fluent rewrite.

Fluent Rewrite:
${fluentRewrite}

Original with Placeholders:
${textWithPlaceholders}
`;
}

  console.log("✅ Hybrid AI handler ready (Chrome Nano + Gemini fallback)");
})();
