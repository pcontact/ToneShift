// universal_gemini_router.js
// A universal router that delegates AI requests between local and cloud Gemini models.
// Provides a consistent interface for ask(), stream(), and cancelStream().

import * as LocalGemini from "../local_ai/gemini_local.js";

const ROUTER_DEBUG = true;
function log(...args) {
  if (ROUTER_DEBUG) console.debug("[GeminiRouter]", ...args);
}

const activeCloudPorts = new Map();

export function createGeminiRouter({ useLocalModel = false } = {}) {

  log(`Router initialized: useLocalModel=${useLocalModel}`);

  if (useLocalModel === "auto") {
    try {
      const LM = globalThis?.ai?.languageModel ?? globalThis?.chrome?.ai?.languageModel;
      if (LM && typeof LM.availability === "function") {
        LM.availability().then(status => {
          log("Local model availability:", status);
          if (status !== "available") useLocalModel = false;
        });
      } else useLocalModel = false;
    } catch { useLocalModel = false; }
  }

  return {
    async ask({ text, history = [], conversationId = null, systemPrompt = "", persistSession = false }) {
      const {useCloudModel} = await chrome.storage.local.get("useCloudModel")
      let useLocalModel = !useCloudModel
      try {
        if (useLocalModel) {
          log("→ using LOCAL model");
          const result = await LocalGemini.askLocalAI({
            text, history, conversationId, systemPrompt, persistSession
          });
          result["useLocalModel"] = useLocalModel; // may include status/message fields
          result["useCloudModel"] = useCloudModel; // may include status/message fields
          return result
        }
        log("→ using CLOUD model");
        const result =  await askCloudGemini({ text, history, conversationId});
        result["useLocalModel"] = useLocalModel; // may include status/message fields
        result["useCloudModel"] = useCloudModel; // may include status/message fields
        return result

      } catch (err) {
        log("ask() failed:", err);
        return {
          status: "error", 
          message: err.message || String(err), 
          useLocalModel, 
          useCloudModel
        };
      }
    },

    async stream({ text, history = [], conversationId = null, systemPrompt = "", persistSession = false, onChunk, onDone, cancelStreamCaller }) {
      const {useCloudModel} = await chrome.storage.local.get("useCloudModel")
      let useLocalModel = !useCloudModel
      try {
        
        if (useLocalModel) {
          log("→ streaming via LOCAL model");
          const result = await LocalGemini.streamLocalAI({
            text, history, conversationId, systemPrompt, persistSession, onChunk, onDone, cancelStreamCaller
          });
          result["useLocalModel"] = useLocalModel; // may include status/message fields
          result["useCloudModel"] = useCloudModel; // may include status/message fields
          return result
        }

        log("→ streaming via CLOUD model");
        const result = await streamCloudGemini({ conversationId, text, history, onChunk, onDone, cancelStreamCaller});
        result["useLocalModel"] = useLocalModel; // may include status/message fields
        result["useCloudModel"] = useCloudModel; // may include status/message fields
        return result

      } catch (err) {
        log("stream() failed:", err);
        return {
          status: "error", 
          message: err.message || String(err), 
          useLocalModel, 
          useCloudModel
        };
      }
    },

    async cancelStream(conversationId) {
      try {
        if (useLocalModel) {
          log(`Canceling LOCAL stream id=${conversationId}`);
          return await LocalGemini.cancelStream(conversationId);
        }
        log(`Canceling CLOUD stream id=${conversationId}`);
        return cancelCloudStream(conversationId);
      } catch (err) {
        log("cancelStream() failed:", err);
        return { status: "error", message: err.message || String(err) };
      }
    }
  };
}

/* ------------------------------------------------------------------
   Cloud-side adapter helpers
------------------------------------------------------------------ */

async function askCloudGemini({ text, history, conversationId}) {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage({ action: "askGemini", text, history }, (response) => {
        // No port maintance here
        if(!conversationId || typeof conversationId !== "string"){
          conversationId = 'sessionID-' + Date.now() + '-' + Math.floor(Math.random() * 1e6);
        }
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (response?.error) {
          reject(new Error(response.message || response.error));
          return;
        }

        resolve({
          sessionId: conversationId,
          reply: response?.reply || "",
          chatHistory: response?.chatHistory,
          status:"available"
        });
      });
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

/**
 * Stream text from the cloud model using a Chrome Port connection.
 * Properly tracks port references for cancelation.
 */
function streamCloudGemini({ conversationId, text, history, onChunk, onDone, cancelStreamCaller}) {
  return new Promise((resolve, reject) => {
    try {
      const port = chrome.runtime.connect({ name: "gemini-stream" });
      if(!conversationId || typeof conversationId !== "string" || !activeCloudPorts.get(conversationId)){
        conversationId = 'sessionId-' + Date.now() + '-' + Math.floor(Math.random() * 1e6);
      }
      if(cancelStreamCaller) cancelStreamCaller(conversationId)
        console.log(cancelStreamCaller)

      activeCloudPorts.set(conversationId, port);
      let accumulated = "";
      const onMsg = (msg) => {
        if (!msg || msg.conversationId !== conversationId) return;

        if (msg.error) {
          cleanup();
          reject(new Error(msg.error));
          return;
        }

        if (msg.chunk && !msg.done) {
          accumulated += msg.chunk;
          onChunk?.(msg.chunk);
        }

        if (msg.done) {
          setTimeout(() => {
            cleanup();
          }, 25); 
          if (onDone) onDone(accumulated);
          resolve({ sessionId: conversationId, reply: accumulated, status:"available", 
            chatHistory:msg.chatHistory
          });
        }
      };

      const cleanup = () => {
        try {
          port.onMessage.removeListener(onMsg);
          port.disconnect();
        } catch (_) {}
        activeCloudPorts.delete(conversationId);
        //conversationId=null // cloud ai model is stateless(no session) set the id to false incase of switch 
      };

      port.onDisconnect.addListener(() => cleanup());
      port.onMessage.addListener(onMsg);

      port.postMessage({ action: "start", conversationId, text, history });
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

/**
 * Cancel an active cloud stream.
 */
function cancelCloudStream(conversationId) {
  const port = activeCloudPorts.get(conversationId);
  if (!port) {
    log(`No active cloud stream found for id=${conversationId}`);
    return;
  }
  try {
    port.postMessage({ action: "cancel", conversationId });
    port.disconnect();
  } catch (err) {
    console.error("Cloud stream cancel failed", err);
  } finally {
    activeCloudPorts.delete(conversationId);
  }
}
