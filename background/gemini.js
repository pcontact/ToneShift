// background/gemini.js
// Cloud-only version
// Handles communication with the Google Generative AI (Gemini) cloud model.

import { GoogleGenerativeAI } from "../libs/vendor/generative-ai.bundle.js";

let model = null;

/** ---------------------------
 * Cloud model initialization
 * ----------------------------*/
async function initCloudModel(apiKey) {
  if (!apiKey) {
    const { apiKey: storedKey } = await chrome.storage.local.get("apiKey");
    apiKey = storedKey;
  }
  if (!apiKey) {
    console.warn("No API key found for Google Generative AI.");
    model = null;
    return null;
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
}

/** ---------------------------
 * Initialization
 * ----------------------------*/
async function init() {
  console.log("Initializing Gemini Cloud AI logic (background)...");
  await initCloudModel().catch((e) => {
    console.error("initCloudModel failed:", e);
  });
}
init();

/** ---------------------------
 * Message handling
 * ----------------------------*/

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg?.action) return;

  switch (msg.action) {
    case "openPopup":
      console.log(msg)
      if(msg.callbackForModelChange) modelPreferenceChangeCallbacks.push(callbackForModelChange)
      if (chrome.action.openPopup) {
        chrome.action.openPopup().catch(() => chrome.runtime.openOptionsPage());
        
      } else {
        chrome.runtime.openOptionsPage();
      }
      return;

    case "updateGeminiApiKey":
      chrome.storage.local.set({ apiKey: msg.apiKey }).catch(() => {});
      initCloudModel(msg.apiKey).catch(console.error);
      return;

    case "askGemini":
      handleAskGemini(msg, sendResponse);
      return true;  

    case "updateGeminiModelPreference":
      //chrome.tab.sendMessage({action: "updateGeminiModelPreference", msg})

    default:
      return;
  }
});

/** ---------------------------
 * askGemini handler (cloud)
 * ----------------------------*/
async function handleAskGemini(msg, sendResponse) {
  try {
    const { text } = msg;
    let history = msg.history

    if (!model) {
      await initCloudModel();
      if (!model) {
        sendResponse({
          error: "no_cloud_model",
          message: "Cloud model not initialized."
        });
        return;
      }
    }
    history = normalizeHistory(history)

    const system = history?.find(m => m.role === "system");
    const nonSystemHistory = (history || []).filter(m => m.role !== "system");

    const systemInstruction = system
      ? { role: "user", parts: [{ text: system.parts?.[0]?.text || "" }] }
      : undefined;

    const chat = model.startChat({ systemInstruction, history: nonSystemHistory });
    const response = await chat.sendMessage(text);

    const textResp =
      response?.response?.text
        ? await response.response.text()
        : (response?.response || response?.text || String(response));
        

    sendResponse({ reply: textResp,
      chatHistory:[
        ...history,
        { role: "user", parts: [{ text: text }] },
        { role: 'model', parts: [{ text: textResp }] }
      ]
    });
  } catch (err) {
    console.error("handleAskGemini error:", err);
    sendResponse({ error: err.message || String(err) });
  }
}

/** ---------------------------
 * Streaming port handler
 * ----------------------------*/
chrome.runtime.onConnect.addListener((clientPort) => {
  if (!clientPort || clientPort.name !== "gemini-stream") return;

  const controllers = new Map();

  clientPort.onDisconnect.addListener(() => {
    for (const ctrl of controllers.values()) {
      try { ctrl.abort(); } catch (_) {}
    }
    controllers.clear();
  });

  clientPort.onMessage.addListener(async (msg) => {
    if (!msg || !msg.action) return;

    if (msg.action === "start") {
      const { conversationId, text } = msg;
      let history = msg.history;

      try {
        if (!model) await initCloudModel();
        if (!model) throw new Error("Cloud model not initialized");

        history = normalizeHistory(history);
        const system = history?.find(h => h.role === "system");
        const nonSystemHistory = (history || []).filter(h => h.role !== "system");
        const systemInstruction = system
          ? { role: "user", parts: [{ text: system.parts?.[0]?.text || "" }] }
          : undefined;

        const chat = model.startChat({ systemInstruction, history: nonSystemHistory });

        const controller = new AbortController();
        if (conversationId) controllers.set(conversationId, controller);

        const streamResult = await chat.sendMessageStream(String(text), {
          signal: controller.signal
        });

        // --- Stream handling with batching ---
        let buffer = "";
        let flushTimer = null;
        const flush = () => {
          if (!buffer) return;
          try {
            clientPort.postMessage({ conversationId, chunk: buffer, done: false });
          } catch (_) {}
          buffer = "";
          flushTimer = null;
        };

        for await (const partial of streamResult.stream) {
          const chunk = partial?.text ? partial.text() : String(partial);
          buffer += chunk;

          // batch messages every ~40ms to avoid port overload
          if (!flushTimer) {
            flushTimer = setTimeout(flush, 40);
          }
        }

        // flush any leftovers
        flush();

        // Get the final full response
        const finalResp = await streamResult.response;
        const finalText = finalResp?.text ? await finalResp.text() : String(finalResp || "");

        // Send final message (done: true)
        clientPort.postMessage({
          conversationId,
          done: true,
          reply: finalText,
          chatHistory: [
            ...history,
            { role: "user", parts: [{ text }] },
            { role: "model", parts: [{ text: finalText }] }
          ]
        });
      } catch (err) {
        console.error("Cloud streaming error:", err);
        clientPort.postMessage({
          conversationId,
          error: err.message || String(err),
          done: true
        });
      } finally {
        if (conversationId) controllers.delete(conversationId);
      }
      return;
    }


    if (msg.action === "cancel") {
      const { conversationId } = msg;
      if (!conversationId) {
        for (const ctrl of controllers.values()) {
          try { ctrl.abort(); } catch (_) {}
        }
        controllers.clear();
        return;
      }

      const ctrl = controllers.get(conversationId);
      if (ctrl) {
        try { ctrl.abort(); } catch (_) {}
        controllers.delete(conversationId);
      }
      return;
    }
  });
});


function createMenu() {
  // clear old items to avoid duplicates when reloading
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "refineText",
      title: "Refine this text",
      contexts: ["page", "selection"] // explicit and safe
    }, () => {
      if (chrome.runtime.lastError) {
        console.error("contextMenus.create error:", chrome.runtime.lastError);
      } else {
        console.log("✅ context menu created");
      }
    });
  });
}

// create on install and also when worker starts (worker may restart)
chrome.runtime.onInstalled.addListener(createMenu);

// click handler
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "refineText") {
    // guard: tab may be undefined on certain pages (e.g. chrome://)
    if (!tab || !tab.id) {
      console.warn("No tab available, not sending message.");
      return;
    }
    //console.log(info)
    // optionally skip non-http pages:
    if (!tab.url || !/^https?:\/\//.test(tab.url)) {
      console.warn("Not a regular page (no http/https).", tab.url);
      //return;
    }

    chrome.tabs.sendMessage(tab.id, { action: "refineText", info }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("sendMessage error:", chrome.runtime.lastError.message);
      } else {
        console.log("content script response:", response);
      }
    });
  }
});

function normalizeHistory(history = []) {
  return (history || []).map(normalizeHistoryItem);
}

function normalizeHistoryItem(item) {
  if (!item) return { role: "user", content: "" };
  let role = item.role ?? "user";
  if (role === "assistant") role = "model";
  const content = typeof item.content === "string"
    ? item.content
    : item.content ?? item.parts?.[0]?.text ?? "";
  return { role, parts:[{ text: content }] };
}



