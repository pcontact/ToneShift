(function () {
  const waitForGemini = setInterval(() => {
    if (window.GoogleGenerativeAI) {
      clearInterval(waitForGemini);

      const GEMINI_API_KEY = "AIzaSyA0ywocM0TghKY3MbP-Az8ns6PjfetxNWg"; // Replace with your real key
      const genAI = new window.GoogleGenerativeAI(GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      console.log("✅ Gemini model initialized");

      window.addEventListener("message", async (event) => {
        if (event.source !== window) return;
        if (event.data.type !== "TS_GEMINI_REQUEST") return;

        try {
          const { text, tone, complexity, brevity } = event.data;

          // Construct prompt using universal template
          const promptText = `
          You are an AI text editor. Rewrite the text below according to the user’s settings:

          User Settings:
          - Tone: ${tone} → describe the emotional style and keep the text consistent with this tone.
          - Complexity: ${complexity} → adjust vocabulary, sentence length, and structure according to this complexity.
          - Brevity: ${brevity} → adjust text length and level of explanation according to this brevity.

          Rules:
          1. Follow the tone precisely.
          2. Use vocabulary and sentence structure appropriate for the chosen complexity.
            - Very simple / Simple → short sentences, everyday words, one idea per sentence.
            - Moderately complex → some multi-clause sentences and mild technical terms.
            - Complex / Very complex → long sentences, multiple clauses, technical or specialized terms.
          3. Adjust length based on brevity:
            - Verbose → include brief explanations for clarity but keep sentences readable.
            - Concise → remove unnecessary words, focus on core ideas.
          4. Maintain factual accuracy; do not add new content.
          5. Produce coherent, polished text that reads naturally and respects all three settings.

          Text to rewrite:
          ${text}

          Please rewrite the text according to the above rules.
          `;


          /*
          const { text, tone, complexity, brevity } = event.data;

          const promptText = `
          You are an expert text editor AI. Rewrite the text below according to the user's settings.

          Settings:
          - Tone: ${tone}
          - Complexity: ${complexity}
          - Brevity: ${brevity}

          Text to rewrite:
          ${text}

          Please produce a polished, coherent version respecting these instructions.
          `;
          */

          console.log("Calling Gemini model...");

          console.log("prompt text: ", promptText)

          const rawOutput = await model.generateContent(promptText);

          console.log("Raw model output:", rawOutput);
          const output = rawOutput?.response?.text() || "No response from gemini";
          window.postMessage({ type: "TS_GEMINI_RESPONSE", text: output }, "*");
        } catch (err) {
          console.error("Gemini error:", err);
          window.postMessage({ type: "TS_GEMINI_RESPONSE", text: "⚠️ Error: " + err.message }, "*");
        }
      });
    }
  }, 200);
})();
