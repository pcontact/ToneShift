
import { GoogleGenerativeAI } from "./vendor/generative-ai.bundle.js";

let model = null;

// Load API key from storage and init model

async function initModel() {
  const data = await chrome.storage.local.get("apiKey");
  const apiKey = data.apiKey || "YOUR_API_KEY";
  //console.log("Using API Key:", apiKey);

  const genAI = new GoogleGenerativeAI(apiKey);
  model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
}

// Initialize on load
initModel();


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
    // Try opening popup first (only works with user gesture)
    if (chrome.action.openPopup) {
      chrome.action.openPopup().catch(() => {
        chrome.runtime.openOptionsPage(); // fallback
      });
    } else {
      chrome.runtime.openOptionsPage();
    }
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "askGemini") {
    const { text, history } = message;

    (async () => {
      try {
        // Extract the system instruction
        const system = history.find(msg => msg.role === "system");
        const nonSystemHistory = history.filter(msg => msg.role !== "system");

        // Format systemInstruction properly
        const systemInstruction = system
          ? { role: "user", parts: [{ text: system.parts?.[0]?.text || "" }] }
          : undefined;

        const chat = model.startChat({
          systemInstruction,
          history: nonSystemHistory,
        });

        const response = await chat.sendMessage(text);
        const reply = response.response.text();

        sendResponse({ reply });
      } catch (err) {
        console.error("Gemini error:", err);
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

  // Keep AbortControllers per-request id so multiple streams can be handled on one port
  const controllers = new Map();

    port.onMessage.addListener(async (msg) => {
      if (!msg) return;

      if (msg.action === 'start') {
        const { text, history, id } = msg;
        try {
          // Start chat as before but using the streaming API
          const system = history.find(h => h.role === 'system');
          const nonSystemHistory = history.filter(h => h.role !== 'system');

          const systemInstruction = system
            ? { role: 'user', parts: [{ text: system.parts?.[0]?.text || '' }] }
            : undefined;

          const chat = model.startChat({ systemInstruction, history: nonSystemHistory });

          // Create an AbortController so caller can cancel this request
          const controller = new AbortController();
          if (id) controllers.set(id, controller);

          // sendMessageStream returns { stream: asyncIterable, response: promise }
          // The vendor SDK expects the request to be a string or an array of parts
          // formatNewContent(request) treats a string as text content. Do not pass
          // an object like { text } which is iterable and causes "request is not iterable".
          const streamResult = await chat.sendMessageStream(
            String(text),
            { signal: controller.signal }
          );

          // Iterate the stream and send incremental deltas to client
          let prev = '';
          try {
            for await (const partial of streamResult.stream) {
              try {
                const current = partial.text();
                // send only the delta since last partial
                const delta = current.slice(prev.length);
                if (delta) port.postMessage({ id, chunk: delta, done: false });
                prev = current;
              } catch (e) {
                // partial.text() can throw for blocked responses; forward minimal info
                console.error('Error reading partial chunk text', e);
              }
            }
          } catch (streamErr) {
            // If aborted, notify client
            if (streamErr.name === 'AbortError') {
              port.postMessage({ id, canceled: true, done: true });
              try { port.disconnect(); } catch (e) { /* ignore */ }
              return;
            }
            throw streamErr;
          }

          // Wait for final aggregated response
          const finalResp = await streamResult.response;
          try {
            const finalText = finalResp.text();
            port.postMessage({ id, chunk: '', done: true, reply: finalText });
          } catch (e) {
            port.postMessage({ id, error: e.message || String(e), done: true });
          }

          try { port.disconnect(); } catch (e) { /* ignore */ }
        } catch (err) {
          if (err.name === 'AbortError') {
            port.postMessage({ id, canceled: true, done: true });
          } else {
            console.error('Gemini streaming error:', err);
            port.postMessage({ id, error: err.message || String(err), done: true });
          }
          try { port.disconnect(); } catch (e) { /* ignore */ }
        } finally {
          if (id) controllers.delete(id);
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
          // no id => abort all
          for (const ctrl of controllers.values()) {
            try { ctrl.abort(); } catch (e) { /* ignore */ }
          }
          controllers.clear();
        }
      }
    });
  });


