
import { GoogleGenerativeAI } from "./vendor/generative-ai.bundle.js";

let model = null;
let isLocalMode = true
// Load API key from storage and init model

async function initCloudModel(apiKey) {
  if (!apiKey) {
    const { apiKey: storedKey } = await chrome.storage.local.get("apiKey");
    apiKey = storedKey;
  }

  if (!apiKey) {
    console.warn("No API key found for Google Generative AI.");
    return null;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
}


async function init() {

  console.log("Initializing ToneShift background script...");
  const data = await chrome.storage.local.get("useCloudModel");
  console.log("Loaded useCloudModel:", data.useCloudModel);
  if(!data.hasOwnProperty("useCloudModel")) {
    await chrome.storage.local.set({ useCloudModel: false });
    return;
  }
  isLocalMode = !data.useCloudModel;
  console.log("isLocalMode set to:", isLocalMode);
  if (data.useCloudModel) {
    await initCloudModel();
  }
}
init();


chrome.runtime.onInstalled.addListener(() => {
  console.log("✅ ToneShift installed");
});

// Inject sidebar when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["content.js"]
  });
});

// Handle messages globally
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "openPopup") {
    if (chrome.action.openPopup) {
      chrome.action.openPopup().catch(() => chrome.runtime.openOptionsPage());
    } else {
      chrome.runtime.openOptionsPage();
    }
    return;
  }

  if (msg.action === 'updateGeminiModelPreference') {
    isLocalMode = !msg.useCloudModel;
    console.log("Gemini model preference updated. Local mode:", isLocalMode);
    if (!isLocalMode) {
      initCloudModel().catch(err => console.error("Error initializing cloud model:", err));
    }
    return;
  }

  if (msg.action === 'updateGeminiApiKey') {
    const newApiKey = msg.apiKey;
    console.log("Updating Gemini API Key.");
    if (!isLocalMode) {
      initCloudModel(newApiKey).catch(err => console.error("Error updating cloud model API key:", err));
    }
    return;
  }
});


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "askGemini") {
    const { text, history } = message;

    // Return true to indicate asynchronous response
    (async () => {
      try {
        const system = history.find(msg => msg.role === "system");
        const nonSystemHistory = history.filter(msg => msg.role !== "system");

        const systemInstruction = system
          ? { role: isLocalMode ? "system" : "user", parts: [{ text: system.parts?.[0]?.text || "" }] }
          : undefined;

        if (isLocalMode) {
          console.log("Using local Gemini model via Chrome Prompt API. isLocalMode:", isLocalMode);
          // Use Chrome Built-in Prompt API
          const session = await ai.languageModel.create();
          const result = await session.prompt(text, {
            systemInstruction,
            history: nonSystemHistory,
          });
          sendResponse({ reply: result });
        } else {
          console.log("Using cloud Gemini model via GoogleGenerativeAI. isLocalMode:", isLocalMode);
          // Use original Gemini-based logic
          const chat = model.startChat({
            systemInstruction,
            history: nonSystemHistory,
          });
          const response = await chat.sendMessage(text);
          const reply = response.response.text();
          sendResponse({ reply });
        }
      } catch (err) {
        console.error("AI logic error:", err);
        sendResponse({ error: err.message });
      }
    })();
    return true; // Keeps sendResponse open for async
  }
});


  // --- Streaming support via long-lived port ---
  // Clients should connect with chrome.runtime.connect({ name: 'gemini-stream' })
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== 'gemini-stream') return;

    const controllers = new Map();

    port.onMessage.addListener(async (msg) => {
      if (!msg) return;

      if (msg.action === 'start') {
        const { text, history, id } = msg;

        try {
          const system = history.find(h => h.role === 'system');
          const nonSystemHistory = history.filter(h => h.role !== 'system');

          const systemInstruction = system
            ? { role: isLocalMode ? 'system' : 'user', parts: [{ text: system.parts?.[0]?.text || '' }] }
            : undefined;

          if (isLocalMode) {
            // Use Chrome Prompt API's streaming
            const session = await ai.languageModel.create();
            const stream = session.promptStreaming(String(text), { systemInstruction, history: nonSystemHistory });

            let prev = '';
            for await (const chunk of stream) {
              const current = chunk.text();
              const delta = current.slice(prev.length);
              if (delta) port.postMessage({ id, chunk: delta, done: false });
              prev = current;
            }

            const finalText = await stream.response.text();
            port.postMessage({ id, chunk: '', done: true, reply: finalText });
          } else {
            // Use original Gemini-based streaming logic
            const chat = model.startChat({ systemInstruction, history: nonSystemHistory });
            const controller = new AbortController();
            if (id) controllers.set(id, controller);

            const streamResult = await chat.sendMessageStream(String(text), { signal: controller.signal });

            let prev = '';
            for await (const partial of streamResult.stream) {
              const current = partial.text();
              const delta = current.slice(prev.length);
              if (delta) port.postMessage({ id, chunk: delta, done: false });
              prev = current;
            }

            const finalResp = await streamResult.response;
            const finalText = await finalResp.text();
            port.postMessage({ id, chunk: '', done: true, reply: finalText });
          }
        } catch (err) {
          console.error('AI streaming error:', err);
          port.postMessage({ id, error: err.message || String(err), done: true });
        } finally {
          if (id) controllers.delete(id);
          try { port.disconnect(); } catch (e) { /* ignore */ }
        }
      } else if (msg.action === 'cancel') {
        const { id } = msg;
        if (id) {
          const ctrl = controllers.get(id);
          if (ctrl) {
            try { ctrl.abort(); } catch (e) { /* ignore */ }
            controllers.delete(id);
          }
        } else {
          // Abort all
          for (const ctrl of controllers.values()) {
            try { ctrl.abort(); } catch (e) { /* ignore */ }
          }
          controllers.clear();
        }
      }
    });
  });



