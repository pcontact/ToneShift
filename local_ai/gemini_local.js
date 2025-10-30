// Standalone module for on-device Gemini (Prompt API) sessions.
// Designed to be imported by a router or controller.
//
// Features:
// - Independent session manager with TTL cleanup
// - System prompt persistence and summarization for long context
// - Non-streaming and streaming support
// - Returns consistent { sessionId, reply, chatHistory } shape

console.log("Gemini Local AI module loaded (gemini_local.js)");

/* ---------------------------
   Config & state
--------------------------- */
const controllers = new Map();        // reqId -> { controller, sessionKey }
const sessions = new Map();           // key -> { session, systemPrompt, destroyed, lastUsed, history: [] }
const sessionPromises = new Map();    // key -> Promise(session)

const SESSION_TTL_MS = 5 * 60 * 1000;

/* ---------------------------
   Utilities
--------------------------- */
function debugLog(...args) {
  try { console.debug("[local-ai]", ...args); } catch (_) {}
}

function normalizeHistoryItem(item) {
  if (!item) return { role: "user", content: "" };
  let role = item.role ?? "user";
  if (role === "model") role = "assistant";
  const content = typeof item.content === "string"
    ? item.content
    : item.content ?? item.parts?.[0]?.text ?? "";
  return { role, content: String(content) };
}

function normalizeHistory(history = []) {
  return (history || []).map(normalizeHistoryItem);
}

/* ---------------------------
   Language Model detection
--------------------------- */
function getLanguageModelNamespace() {
  const LM =
    (typeof LanguageModel !== "undefined" && LanguageModel) ||
    globalThis?.ai?.languageModel ||
    globalThis?.chrome?.ai?.languageModel ||
    globalThis?.chrome?.aiOriginTrial?.languageModel ||
    null;

  return (LM && typeof LM.create === "function" && typeof LM.availability === "function") ? LM : null;
}

/* ---------------------------
   Summarizer (for long sessions)
--------------------------- */
async function summarizeHistory(LM, history = []) {
  try {
    const normalized = normalizeHistory(history);
    if (!normalized?.length) return null;

    const convo = normalized.filter(h => h.role !== "system")
      .map(h => `${h.role.toUpperCase()}: ${h.content}`).join("\n");

    const systemSumm = "You are a concise summarizer. Produce a 2–6 sentence factual summary of the conversation. Retain goals and facts only.";
    const userSumm = `Summarize the conversation for long-term memory:\n\n${convo}\n\nSummary:`;

    const summSession = await LM.create({ initialPrompts: [{ role: "system", content: systemSumm }] });
    try {
      const result = await summSession.prompt([{ role: "user", content: userSumm }]);
      const text = typeof result === "string" ? result : JSON.stringify(result);
      return text.trim().length > 10 ? text.trim() : null;
    } finally {
      await summSession.destroy?.();
    }
  } catch (e) {
    debugLog("Summarization failed:", e);
    return null;
  }
}

/* ---------------------------
   Session management
--------------------------- */
async function getSessionForKey(key, LM, systemPrompt = "", history=[], options = {}) {
  if (!LM || typeof LM.create !== "function") throw new Error("LanguageModel.create unavailable");

  const existing = sessions.get(key);
  if (existing && !existing.destroyed) {
    //TODO: implement better logic to destroy a session
    //      Because systemPrompt might change when we add conversationsummary as context.
    if (systemPrompt && systemPrompt !== existing.systemPrompt) {
      await destroySessionForKey(key);
    } else {
      existing.lastUsed = Date.now();
      return existing.session;
    }
  }

  if (sessionPromises.has(key)) {
    await sessionPromises.get(key);
    const post = sessions.get(key);
    if (post && !post.destroyed) {
      post.lastUsed = Date.now();
      return post.session;
    }
  }

  const createPromise = (async () => {
    const opts = { ...options };
    if (history) opts.initialPrompts = normalizeHistory(history);
    const session = await LM.create(opts);
    const initHistory = normalizeHistory(history);
    sessions.set(key, { session, systemPrompt, destroyed: false, lastUsed: Date.now(), history: initHistory });
    return session;
    /*
    if (systemPrompt) opts.initialPrompts = [{ role: "system", content: String(systemPrompt) }];
    const session = await LM.create(opts);
    const initHistory = systemPrompt ? [{ role: "system", content: systemPrompt }] : [];
    sessions.set(key, { session, systemPrompt, destroyed: false, lastUsed: Date.now(), history: initHistory });
    return session;
    */
  })();

  sessionPromises.set(key, createPromise);
  try {
    return await createPromise;
  } finally {
    sessionPromises.delete(key);
  }
}

async function destroySessionForKey(key) {
  const entry = sessions.get(key);
  if (!entry) return;
  try { await entry.session.destroy?.(); } catch (_) {}
  entry.destroyed = true;
  sessions.delete(key);
}

// Cleanup loop
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of sessions.entries()) {
    if (now - (entry.lastUsed || 0) > SESSION_TTL_MS) destroySessionForKey(key);
  }
}, 60_000);

/* ---------------------------
   Core API methods
--------------------------- */
export async function askLocalAI({
  text,
  history = [],
  conversationId = null,
  systemPrompt = "",
  persistSession = false
}) {
  const LM = getLanguageModelNamespace();
  if (!LM) {
    return {
      status: "unavailable",
      message: "Prompt API not supported in this environment."
    };
  }

  const avail = await LM.availability();
  if (avail === "unavailable") {
    return { status: "unavailable", message: "The device is not eligible for running on-device model.." };
  } else if (avail === "downloadable") {
    return { status: "downloadable", message: "on-device Model needs to be downloaded before it can be used." };
  } else if (avail === "downloading") {
    return { status: "downloading", message: "on-device model is currently downloading. Please wait until it’s available." };
  } else if (avail !== "available") {
    return { status: avail, message: `Unexpected availability status: ${avail}` };
  }

  history = normalizeHistory(history) // normmalize the history in case of change

  //const trimmed = trimHistoryToContextLimit(history, text);
  // ensure conversation key is valid and in the session entry
  if(!conversationId || typeof conversationId !== "string" || !sessions.get(conversationId)){
    console.warn("Invalid conversationId. Creating a conversationId")
    conversationId = 'sessionId-' + Date.now() + '-' + Math.floor(Math.random() * 1e6);
  }
  const session = await getSessionForKey(conversationId, LM, systemPrompt, history);
  const sessionEntry = sessions.get(conversationId);


  //const messages = buildMessagesForPrompt(text, history, false);
  try{
    const result = await await session.prompt([{ role: "user", content: text }]);
    const reply = typeof result === "string" ? result : JSON.stringify(result);

    // update history
    sessionEntry.history.push({ role: "user", content: text });
    sessionEntry.history.push({ role: "assistant", content: reply });
    sessionEntry.lastUsed = Date.now();

    if (!persistSession) await destroySessionForKey(conversationId);

    return {
      status: "available",
      sessionId: conversationId,
      reply,
      chatHistory: [
        ...history,
        { role: "user", content: text },
        { role: "assistant", content: reply }
      ]
    };
  }catch(e){
     return { status: "error", message: e };
  }
}

export async function streamLocalAI({
  text,
  history = [],
  conversationId = null,
  systemPrompt = "",
  onChunk,
  onDone,
  cancelStreamCaller,
  persistSession = true
}) {
  const LM = getLanguageModelNamespace();
  if (!LM) {
    return {
      status: "unavailable",
      message: "Prompt API not supported in this environment."
    };
  }

  const avail = await LM.availability();
  if (avail === "unavailable") {
    return { status: "unavailable", message: "The device is not eligible for running on-device model.." };
  } else if (avail === "downloadable") {
    return { status: "downloadable", message: "on-device Model needs to be downloaded before it can be used." };
  } else if (avail === "downloading") {
    return { status: "downloading", message: "on-device model is currently downloading. Please wait until it’s available." };
  } else if (avail !== "available") {
    return { status: avail, message: `Unexpected availability status: ${avail}` };
  }

  //const trimmed = trimHistoryToContextLimit(history, text);
  history = normalizeHistory(history) // normmalize the history in case of change

  if(!conversationId || typeof conversationId !== "string" || !sessions.get(conversationId)){
    console.warn("Invalid conversationId. Creating a conversationId")
    conversationId = 'sessionId-' + Date.now() + '-' + Math.floor(Math.random() * 1e6);
  }
  
  if(cancelStreamCaller) cancelStreamCaller(conversationId)


  const session = await getSessionForKey(conversationId, LM, systemPrompt, history);
  const controller = new AbortController();
  controllers.set(conversationId, { controller, sessionKey: conversationId });

  //const messages = buildMessagesForPrompt(text, trimmed, false);

  // TODO: Monitor quota, if it approch limit then add conversation 
  // summary as to system prompt as context

  const stream = session.promptStreaming(text, { signal: controller.signal });

  let accumulated = "";
  for await (const chunk of stream) {
    const piece = typeof chunk === "string" ? chunk : JSON.stringify(chunk);
    accumulated += piece;
    if (onChunk) onChunk(piece);
  }

  if (onDone) onDone(accumulated);

  const entry = sessions.get(conversationId);
  if (entry) {
    entry.history.push({ role: "user", content: text });
    entry.history.push({ role: "assistant", content: accumulated });
  }

  controllers.delete(conversationId);
  if (!persistSession) await destroySessionForKey(conversationId);

  return {
    status: "available",
    sessionId: conversationId,
    reply: accumulated,
    chatHistory: [
      ...history,
      { role: "user", content: text },
      { role: "assistant", content: accumulated }
    ]
  };
}


export async function cancelStream(conversationId) {
  const entry = controllers.get(conversationId);
  if (entry) {
    try { entry.controller.abort(); } catch (_) {}
    controllers.delete(conversationId);
  }
}
