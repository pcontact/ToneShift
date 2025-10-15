
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


