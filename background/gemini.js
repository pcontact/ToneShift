// background/gemini.js

import { GoogleGenerativeAI } from "../libs/vendor/generative-ai.bundle.js";

let model = null;
let isLocalMode = true;

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
  console.log("Initializing ToneShift AI logic...");
  const data = await chrome.storage.local.get("useCloudModel");
  if (!data.hasOwnProperty("useCloudModel")) {
    await chrome.storage.local.set({ useCloudModel: false });
    return;
  }
  isLocalMode = !data.useCloudModel;
  if (data.useCloudModel) await initCloudModel();
}
init();



chrome.action.onClicked.addListener(tab => {
  chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
});

// Unified handler for Gemini-related messages
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg.action) return;

  switch (msg.action) {
    case "openPopup":
      if (chrome.action.openPopup) {
        chrome.action.openPopup().catch(() => chrome.runtime.openOptionsPage());
      } else {
        chrome.runtime.openOptionsPage();
      }
      return;

    case "updateGeminiModelPreference":
      isLocalMode = !msg.useCloudModel;
      if (!isLocalMode) initCloudModel().catch(console.error);
      return;

    case "updateGeminiApiKey":
      if (!isLocalMode) initCloudModel(msg.apiKey).catch(console.error);
      return;

    case "askGemini":
      handleAskGemini(msg, sendResponse);
      return true;
  }
});

async function handleAskGemini(msg, sendResponse) {
  try {
    const { text, history } = msg;
    const system = history.find(m => m.role === "system");
    const nonSystemHistory = history.filter(m => m.role !== "system");

    const systemInstruction = system
      ? { role: isLocalMode ? "system" : "user", parts: [{ text: system.parts?.[0]?.text || "" }] }
      : undefined;

    if (isLocalMode) {
      const session = await ai.languageModel.create();
      const result = await session.prompt(text, { systemInstruction, history: nonSystemHistory });
      sendResponse({ reply: result });
    } else {
      const chat = model.startChat({ systemInstruction, history: nonSystemHistory });
      const response = await chat.sendMessage(text);
      sendResponse({ reply: response.response.text() });
    }
  } catch (err) {
    console.error("AI logic error:", err);
    sendResponse({ error: err.message });
  }
}

// Streaming support
chrome.runtime.onConnect.addListener(port => {
  if (port.name !== "gemini-stream") return;
  const controllers = new Map();

  port.onMessage.addListener(async msg => {
    if (!msg) return;

    if (msg.action === "start") {
      const { text, history, id } = msg;
      try {
        const system = history.find(h => h.role === "system");
        const nonSystemHistory = history.filter(h => h.role !== "system");

        const systemInstruction = system
          ? { role: isLocalMode ? "system" : "user", parts: [{ text: system.parts?.[0]?.text || "" }] }
          : undefined;

        if (isLocalMode) {
          const session = await ai.languageModel.create();
          const stream = session.promptStreaming(String(text), { systemInstruction, history: nonSystemHistory });
          let prev = "";
          for await (const chunk of stream) {
            const current = chunk.text();
            const delta = current.slice(prev.length);
            if (delta) port.postMessage({ id, chunk: delta, done: false });
            prev = current;
          }
          const finalText = await stream.response.text();
          port.postMessage({ id, chunk: "", done: true, reply: finalText });
        } else {
          const chat = model.startChat({ systemInstruction, history: nonSystemHistory });
          const controller = new AbortController();
          if (id) controllers.set(id, controller);
          const streamResult = await chat.sendMessageStream(String(text), { signal: controller.signal });

          let prev = "";
          for await (const partial of streamResult.stream) {
            const current = partial.text();
            const delta = current.slice(prev.length);
            if (delta) port.postMessage({ id, chunk: delta, done: false });
            prev = current;
          }

          const finalResp = await streamResult.response;
          const finalText = await finalResp.text();
          port.postMessage({ id, chunk: "", done: true, reply: finalText });
        }
      } catch (err) {
        console.error("AI streaming error:", err);
        port.postMessage({ id, error: err.message || String(err), done: true });
      } finally {
        if (id) controllers.delete(id);
        try { port.disconnect(); } catch (_) {}
      }
    } else if (msg.action === "cancel") {
      const { id } = msg;
      if (id) {
        const ctrl = controllers.get(id);
        if (ctrl) {
          try { ctrl.abort(); } catch (_) {}
          controllers.delete(id);
        }
      } else {
        for (const ctrl of controllers.values()) {
          try { ctrl.abort(); } catch (_) {}
        }
        controllers.clear();
      }
    }
  });
});


function createMenu() {
  // clear old items to avoid duplicates when reloading
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "helpMeExplain",
      title: "Help me Explain",
      contexts: ["page", "selection", "link", "image"] // explicit and safe
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
createMenu(); // call at top-level to ensure it exists after reload

// click handler
chrome.contextMenus.onClicked.addListener((info, tab) => {
  console.log("context menu clicked", info, tab);
  if (info.menuItemId === "helpMeExplain") {
    // guard: tab may be undefined on certain pages (e.g. chrome://)
    if (!tab || !tab.id) {
      console.warn("No tab available, not sending message.");
      return;
    }
    console.log(info)
    // optionally skip non-http pages:
    if (!tab.url || !/^https?:\/\//.test(tab.url)) {
      console.warn("Not a regular page (no http/https).", tab.url);
      //return;
    }

    chrome.tabs.sendMessage(tab.id, { action: "helpMeExplain", info }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("sendMessage error:", chrome.runtime.lastError.message);
      } else {
        console.log("content script response:", response);
      }
    });
  }
});




