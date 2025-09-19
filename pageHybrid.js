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
You are an AI text editor. Rewrite the text below according to the user’s settings:

User Settings:
- Tone: ${tone}
- Complexity: ${complexity}
- Brevity: ${brevity}

Rules:
1. Follow the tone precisely.
2. Adjust vocabulary and sentence structure to match complexity.
3. Match verbosity or conciseness based on brevity.
4. Keep meaning accurate, don’t add new info.
5. Produce polished, natural-sounding text.

Text to rewrite:
${text}
`;
  }

  // --- Chrome Nano ---
  async function tryChromeAI(text, tone, complexity, brevity) {
    if (!(window.ai && window.ai.languageModel)) return null;

    try {
      console.log("Using Chrome built-in AI (Nano)...");
      const session = await window.ai.languageModel.create({
        temperature: 0.7,
        topK: 40,
      });
      const response = await session.prompt(
        buildPrompt(text, tone, complexity, brevity)
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

    const { text, tone, complexity, brevity } = event.data;

    try {
      // Step 1: try Chrome Nano
      let output = await tryChromeAI(text, tone, complexity, brevity);

      // Step 2: fallback if needed
      if (!output) {
        const prompt = buildPrompt(text, tone, complexity, brevity);
        const result = await tryGeminiCloud(prompt);

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
      window.postMessage({ type: "TS_GEMINI_RESPONSE", text: output }, "*");
    } catch (err) {
      console.error("Hybrid handler error:", err);
      window.postMessage(
        { type: "TS_GEMINI_ERROR", error: err.message || "Unknown error" },
        "*"
      );
    }
  });

  console.log("✅ Hybrid AI handler ready (Chrome Nano + Gemini fallback)");
})();
