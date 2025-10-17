// chatPanel.js
import { extractMainTextFromDocument } from './utils/extractMainText.js'
import { getContextText } from "./utils/getRewriteContext.js"

let panelVisible = false;
let lastHighlight = '';
let chatHistoryMap = new Map();
let scrollListenerAdded = false;
let anchorY = 0;
let isMouseOverPanel = false;
let isInputHandlerSet = false;

// ----------------- CSS Injection -----------------
export function injectCSS() {
    if (document.getElementById('tsChatPanelStyles')) return;
    const style = document.createElement('style');
    style.id = 'tsChatPanelStyles';
    style.textContent = `
    /* --- Global Reset for Isolation --- */
    .tsChatPanelContainer, 
    .tsChatPanelContainer * {
        all: unset;
        box-sizing: border-box;
        font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    }

    /* --- Core Panel (match microcard look) --- */
    .tsChatPanelContainer { 
        position: absolute;
        width: 600px; max-width: 92%; 
        background: var(--ts-panel-bg, #F8F9FA);
        border: 1px solid rgba(108,99,255,0.12);
        border-radius: 12px; 
        box-shadow: 0 10px 30px rgba(38, 32, 63, 0.12);
        display: flex; flex-direction: column; 
        overflow: hidden; z-index: 999999;
        transform: translateY(10px);
        opacity: 0;
        transition: transform 0.28s cubic-bezier(.2,.9,.2,1), opacity 0.2s ease, top 0.25s ease, left 0.25s ease;
    }
    .tsChatPanelContainer.tsVisible { 
        transform: translateY(0); 
        opacity: 1; 
    }

    /* --- Header --- */
    .tsChatPanelHeader { 
        padding: 12px 14px; 
        font-weight: 700; 
        font-size: 15px;
        color: #1E1E1E;
        background: linear-gradient(90deg, rgba(108,99,255,0.06), transparent);
        border-bottom: 1px solid rgba(108,99,255,0.06);
    }

    /* --- Messages Area --- */
    .tsChatPanelMessages { 
        flex: 1; 
        padding: 12px; 
        overflow-y: auto; 
        max-height: 340px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        scrollbar-width: thin;
    }

    /* --- Input + Send --- */
    .tsChatPanelInput {
        display: flex;
        gap: 8px;
        border-top: 1px solid rgba(0,0,0,0.04);
        padding: 10px;
        align-items: center;
        background: transparent;
    }

    .tsChatPanelInput input {
        flex: 1;
        padding: 10px 12px;
        border-radius: 10px;
        border: 1px solid rgba(108,99,255,0.12);
        outline: none;
        font-size: 14px;
        color: #222;
        background: #fff;
        box-shadow: inset 0 1px 0 rgba(0,0,0,0.02);
    }

    .tsChatSendBtn {
        display: flex;
        align-items: center;
        justify-content: center;
        background: #6C63FF;
        color: white;
        border: none;
        border-radius: 10px;
        width: 40px;
        height: 36px;
        margin-left: 6px;
        cursor: pointer;
        font-size: 16px;
        transition: transform 0.12s ease, box-shadow 0.12s ease;
        box-shadow: 0 6px 16px rgba(108,99,255,0.14);
    }

    .tsChatSendBtn:hover {
        transform: translateY(-1px) scale(1.02);
        box-shadow: 0 10px 24px rgba(108,99,255,0.18);
    }

    /* --- Floating Bubble --- */
    .tsChatPanelBubble { 
        position: fixed; 
        bottom: 20px; 
        right: 20px; 
        cursor: pointer; 
        background: #6C63FF; 
        color: white; 
        border-radius: 50%; 
        width: 44px; 
        height: 44px; 
        display: flex; 
        align-items: center; 
        justify-content: center; 
        z-index: 999999; 
        transition: transform 0.25s ease, opacity 0.25s ease;
        border: none;
        box-shadow: 0 6px 20px rgba(38, 32, 63, 0.12);
    }

    .tsChatPanelBubble.tsHidden { 
        opacity: 0; 
        transform: scale(0); 
    }

    /* --- User & AI Messages --- */
    .tsChatUserMessage {
        margin: 6px 0;
        background: #EAF2FF;
        padding: 8px 10px;
        border-radius: 12px;
        align-self: flex-end;
        max-width: 80%;
        font-size: 14px;
        color: #111;
        box-shadow: 0 4px 12px rgba(16,24,40,0.04);
    }

    /* === AI Chat Response Bubble — microcard inspired === */
    .tsChatAIResponse {
        position: relative;
        margin: 6px 0;
        background: linear-gradient(180deg, #F6F2FF 0%, #EFE9FF 100%);
        padding: 12px 14px 30px 14px;
        border-radius: 12px;
        font-size: 14px;
        color: #1E1E1E;
        max-width: 80%;
        line-height: 1.6;
        word-break: break-word;
        transition: background 0.18s ease, box-shadow 0.18s ease;
        white-space: normal;
        box-shadow: 0 8px 24px rgba(38,32,63,0.06);
    }

    .tsChatAIResponse:hover {
        background: #F3EBFF;
        box-shadow: 0 12px 28px rgba(38,32,63,0.08);
    }

    /* === Paragraphs === */
    .tsChatAIResponse p {
        display: block !important;
        margin: 0.75em 0 !important;
        line-height: 1.6;
    }

    .tsChatAIResponse p:first-child { margin-top: 0 !important; }
    .tsChatAIResponse p:last-child { margin-bottom: 0 !important; }
    .tsChatAIResponse p + p { margin-top: 0.9em !important; }

    /* === Inline Code === */
    .tsChatAIResponse code {
        background: rgba(0,0,0,0.04);
        padding: 2px 6px;
        border-radius: 6px;
        font-family: "Fira Code", "Consolas", monospace;
        font-size: 0.95em;
        color: #6C63FF;
    }

    /* === Links === */
    .tsChatAIResponse a { color: #6C63FF; text-decoration: none; }
    .tsChatAIResponse a:hover { text-decoration: underline; }

    /* === Lists === */
    .tsChatAIResponse ul, .tsChatAIResponse ol { margin: 0.8em 0 0.8em 1.4em; padding: 0; }
    .tsChatAIResponse li { margin-bottom: 0.45em; }

    /* === Blockquotes === */
    .tsChatAIResponse blockquote { margin: 0.8em 0; padding-left: 1em; border-left: 3px solid rgba(108,99,255,0.12); color: #444; font-style: italic; }

    /* === Copy Button === */
    .tsCopyBtn { all: unset; position: absolute; bottom: 8px; right: 8px; background: rgba(255,255,255,0.9); color: #6C63FF; cursor: pointer; border-radius: 8px; padding: 4px 6px; font-size: 12px; opacity: 0; transition: opacity 0.2s ease, transform 0.12s ease; box-shadow: 0 6px 16px rgba(108,99,255,0.06); }
    .tsChatAIResponse:hover .tsCopyBtn { opacity: 1; transform: translateY(-2px); }
    .tsCopyBtn:hover { color: #4b3fe6; }
    .tsCopyBtn.tsCopied { color: #28a745; font-weight: 700; }

    .tsCopyTooltip { display: none; }

    /* --- Copied animation fade-out --- */
    @keyframes tsCopiedFade { 0% { opacity: 1; transform: translateY(0); } 100% { opacity: 0; transform: translateY(-4px); } }
    .tsCopiedText { position: absolute; bottom: 34px; right: 6px; color: #28a745; font-size: 11px; background: rgba(255,255,255,0.95); border-radius: 6px; padding: 4px 6px; animation: tsCopiedFade 1.2s forwards; pointer-events: none; }

    /* --- Typing Bubble --- */
    .tsTypingBubble { display: inline-flex; align-items: center; background: rgba(108,99,255,0.08); border-radius: 16px; padding: 6px 10px; margin: 4px 0; gap: 6px; width: fit-content; opacity: 0; transform: translateY(5px); animation: tsTypingFadeIn 0.28s forwards; }
    .tsTypingBubble span { width: 6px; height: 6px; background: #8f86ff; border-radius: 50%; animation: tsTypingDots 1.2s infinite ease-in-out; }
    .tsTypingBubble span:nth-child(2) { animation-delay: 0.18s; } .tsTypingBubble span:nth-child(3) { animation-delay: 0.36s; }
    @keyframes tsTypingDots { 0%,20% { opacity: 0.18; transform: translateY(0); } 50% { opacity: 1; transform: translateY(-2px); } 100% { opacity: 0.18; transform: translateY(0); } }
    @keyframes tsTypingFadeIn { to { opacity: 1; transform: translateY(0); } }
    @keyframes tsTypingFadeOut { to { opacity: 0; transform: translateY(5px); } }
    `;
    document.head.appendChild(style);
}

// ----------------- HTML Injection -----------------
export function injectHTML() {
    if (document.getElementById('tsChatPanelContainer')) return;
    const container = document.createElement('div');
    container.id = 'tsChatPanelContainer';
    container.className = 'tsChatPanelContainer';
    container.innerHTML = `
        <div class="tsChatPanelHeader">Gideon</div>
        <div class="tsChatPanelMessages"></div>
        <div class="tsChatPanelInput">
            <input type="text" placeholder="Ask for more detail..." />
        </div>
    `;
    document.body.appendChild(container);

    container.addEventListener('mouseenter', () => isMouseOverPanel = true);
    container.addEventListener('mouseleave', () => {
        isMouseOverPanel = false;
        checkScrollHide();
    });
}

// ----------------- Typing Bubble Functions -----------------
function showTypingBubble() {
    const messages = document.querySelector('.tsChatPanelMessages');
    if (!messages) return;
    if (document.querySelector('.tsTypingBubble')) return;

    const bubble = document.createElement('div');
    bubble.className = 'tsTypingBubble';
    bubble.innerHTML = '<span></span><span></span><span></span>';
    messages.appendChild(bubble);
    autoScroll();
}

function hideTypingBubble() {
    const bubble = document.querySelector('.tsTypingBubble');
    if (!bubble) return;
    bubble.style.animation = 'tsTypingFadeOut 0.3s forwards';
    setTimeout(() => bubble.remove(), 300);
}

// ----------------- Chat Messaging -----------------
export function addUserMessage(text, saveToHistory = true) {
    const messages = document.querySelector('.tsChatPanelMessages');
    if (!messages) return;

    const msg = document.createElement('div');
    msg.className = 'tsChatUserMessage';
    msg.textContent = text;
    messages.appendChild(msg);
    autoScroll();
    showTypingBubble();

    if (saveToHistory) {
      const hash = generateHash(lastHighlight.toString().trim())
      if (!chatHistoryMap.has(hash)) chatHistoryMap.set(hash, []);
      chatHistoryMap.get(hash).push({ type: 'user', text });
    }
}

export function addAIResponse(text, saveToHistory = true) {
    hideTypingBubble();

    const messages = document.querySelector('.tsChatPanelMessages');
    if (!messages) return;

    const msg = document.createElement('div');
    msg.className = 'tsChatAIResponse';
    const html = simpleMarkdownToHTML(text)
    msg.innerHTML = html;

    // Copy button
    const copyBtn = document.createElement('button');
    copyBtn.className = 'tsCopyBtn';
    copyBtn.innerHTML = '📋';

    const tooltip = document.createElement('span');
    tooltip.className = 'tsCopyTooltip';
    tooltip.textContent = 'Copy to clipboard';
    copyBtn.appendChild(tooltip);

    let resetTimeout = null;
    let copiedNote = null;

    async function handleCopy(e) {
        e.stopPropagation();
        try {
            await navigator.clipboard.writeText(text);
            if (resetTimeout) clearTimeout(resetTimeout);
            if (copiedNote && copiedNote.isConnected) copiedNote.remove();

            copyBtn.classList.add('tsCopied');
            copyBtn.innerHTML = '✅';
            copyBtn.appendChild(tooltip);

            copiedNote = document.createElement('span');
            copiedNote.className = 'tsCopiedText';
            copiedNote.textContent = 'Copied!';
            msg.appendChild(copiedNote);

            resetTimeout = setTimeout(() => {
                if (copiedNote?.isConnected) copiedNote.remove();
                copyBtn.classList.remove('tsCopied');
                copyBtn.innerHTML = '📋';
                copyBtn.appendChild(tooltip);
            }, 1500);
        } catch (err) {
            console.error('Copy failed:', err);
            copyBtn.innerHTML = '⚠️';
            resetTimeout = setTimeout(() => {
                copyBtn.innerHTML = '📋';
                copyBtn.appendChild(tooltip);
            }, 1200);
        }
    }

    copyBtn.onclick = handleCopy;
    msg.appendChild(copyBtn);
    messages.appendChild(msg);
    autoScroll();

    if (saveToHistory) {
      const hash = generateHash(lastHighlight.toString().trim())
      if (!chatHistoryMap.has(hash)) chatHistoryMap.set(hash, []);
      chatHistoryMap.get(hash).push({ type: 'ai', text });
    }
}

function autoScroll() {
    const messages = document.querySelector('.tsChatPanelMessages');
    if (messages) messages.scrollTop = messages.scrollHeight;
}

// ----------------- Input Handling -----------------
export async function attachInputHandler(callback) {
    const container = document.querySelector('.tsChatPanelInput');
    if (!container) return;
    const input = container.querySelector('input');
    if (!input) return;

    let sendBtn = container.querySelector('.tsChatSendBtn');
    if (!sendBtn) {
        sendBtn = document.createElement('button');
        sendBtn.type = 'button';
        sendBtn.className = 'tsChatSendBtn';
        sendBtn.innerHTML = '✈️';
        container.appendChild(sendBtn);
    }

    const sendMessage = async () => {
        const userText = input.value.trim();
        if (!userText) return;
        input.value = '';
        await callback(userText);
    };

    input.onclick = e => { if (e.key === 'Enter') sendMessage(); };
    sendBtn.onclick = sendMessage;
    isInputHandlerSet = true;
}

// ----------------- Panel Controls -----------------
export function openChatPanel(highlightedText) {
    injectCSS();
    injectHTML();
    const panel = document.getElementById('tsChatPanelContainer');
    panel.style.display = 'flex';

    const header = panel.querySelector(".tsChatPanelHeader")
    setOwnText(header, "✨AI - Explaining highlighted text…")

    const messages = document.querySelector('.tsChatPanelMessages');
    messages.innerHTML = '';

    panelVisible = true;
    lastHighlight = highlightedText;
    const hash = generateHash(lastHighlight.toString().trim());
    if (chatHistoryMap.has(hash)) {
        // replay without saving (prevent duplicate writes)
        chatHistoryMap.get(hash).forEach(msg => {
            msg.type === 'ai' ? addAIResponse(msg.text, false) : addUserMessage(msg.text, false);
        });
    } else {
        const text = highlightedText.toString().trim();
        sendToGemini(text, true, true);
    }

    updatePanelPosition();
    requestAnimationFrame(() => panel.classList.add('tsVisible'));

    if (!scrollListenerAdded) {
        window.addEventListener('scroll', () => {
            updatePanelPosition();
            checkScrollHide();
        });
        scrollListenerAdded = true;
    }
}
function setOwnText(el, text) {
    let textNode = [...el.childNodes].find(n => n.nodeType === Node.TEXT_NODE);
    if (textNode) {
        textNode.nodeValue = text;
    } else {
        el.insertBefore(document.createTextNode(text), el.firstChild);
    }
}

function generateHash(string){
  // FNV-1a 64-bit hash -> hex (fast, deterministic, low collision rate for typical text)
  if (typeof string !== 'string') string = String(string ?? '');
  const encoder = new TextEncoder();
  const data = encoder.encode(string);
  let h = 0xcbf29ce484222325n; // FNV offset basis (64-bit)
  const prime = 0x100000001b3n; // FNV prime (64-bit)
  for (let i = 0; i < data.length; i++) {
    h ^= BigInt(data[i]);
    h = (h * prime) & ((1n << 64n) - 1n);
  }
  return h.toString(16).padStart(16, '0');
}


  
export function collapsePanel() {
    const panel = document.getElementById('tsChatPanelContainer');
    if (!panel || !panelVisible) return;

    panel.classList.remove('tsVisible');
    setTimeout(() => panel.style.display = 'none', 300);
    panelVisible = false;

    let bubble = document.getElementById('tsChatPanelBubble');
    if (!bubble) {
        bubble = document.createElement('div');
        bubble.id = 'tsChatPanelBubble';
        bubble.className = 'tsChatPanelBubble tsHidden';
        bubble.textContent = '💬';
        bubble.title = 'Reopen explanation';
        bubble.onclick = expandPanel;
        document.body.appendChild(bubble);
        requestAnimationFrame(() => bubble.classList.remove('tsHidden'));
    }
}

export function expandPanel() {
    const panel = document.getElementById('tsChatPanelContainer');
    panel.style.display = 'flex';
    requestAnimationFrame(() => panel.classList.add('tsVisible'));
    panelVisible = true;

    const bubble = document.getElementById('tsChatPanelBubble');
    if (bubble) {
        bubble.classList.add('tsHidden');
        setTimeout(() => bubble.remove(), 300);
    }

    updatePanelPosition();
}

export function closePanel() {
    const panel = document.getElementById('tsChatPanelContainer');
    const bubble = document.getElementById('tsChatPanelBubble');
    if (panel) panel.remove();
    if (bubble) bubble.remove();
    chatHistoryMap.clear();
    panelVisible = false;
}

// ----------------- Adaptive Positioning -----------------
function updatePanelPosition() {
    if (!panelVisible) return;
    const panel = document.getElementById('tsChatPanelContainer');
    if (!panel) return;
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    const panelWidth = panel.offsetWidth || 380;
    const panelHeight = panel.offsetHeight || 150;
    const padding = 10;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (rect && rect.width > 0) {
        const spaceBelow = viewportHeight - rect.bottom;
        let top = (spaceBelow >= panelHeight + padding)
            ? rect.bottom + window.scrollY + padding
            : rect.top + window.scrollY - panelHeight - padding;

        let left = rect.left + window.scrollX;
        left = Math.min(Math.max(left, 10), viewportWidth - panelWidth - 10);
        top = Math.min(Math.max(top, 10), viewportHeight + window.scrollY - panelHeight - 10);

        panel.style.top = `${top}px`;
        panel.style.left = `${left}px`;
        anchorY = rect.top + window.scrollY;
    } else {
        panel.style.top = "40%";
        panel.style.left = "50%";
        panel.style.transform = "translate(-50%, -50%)";
        anchorY = window.innerHeight * 0.4;
    }
}

// ----------------- Fade-Out / Scroll-Hide -----------------
function gracefullyRemovePanel() {
    const panel = document.getElementById('tsChatPanelContainer');
    if (!panel || !panel.isConnected) return;
    panel.style.transition = 'opacity 0.3s ease';
    panel.style.opacity = '0';
    setTimeout(() => { if (panel.isConnected) panel.remove(); }, 300);
    panelVisible = false;
}

function checkScrollHide() {
    if (!panelVisible) return;
    const currentY = window.scrollY;
    if (Math.abs(currentY - anchorY) > 200 && !isMouseOverPanel) gracefullyRemovePanel();
}

// ----------------- Global Events -----------------
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') collapsePanel();
});

document.addEventListener('click', e => {
    const panel = document.getElementById('tsChatPanelContainer');
    const bubble = document.getElementById('tsChatPanelBubble');
    if (!panelVisible || !panel) return;
    if (!panel.contains(e.target) && (!bubble || !bubble.contains(e.target))) {
        collapsePanel();
    }
});

 
// ==============================
// Persistent system prompt
// ==============================
const systemPrompt = {
  role: "system",
  parts: [
    {
      text: `You are a friendly, human-like assistant who helps users understand complex text in simple, clear, and engaging ways. Users may be students, researchers, or casual readers.

Your goals:
- Simplify concepts using plain language and examples.
- Highlight the main idea quickly and clearly.
- Encourage confidence and curiosity.

Guidelines:
- Write conversationally; avoid robotic or formal tones.
- Use context when available to improve understanding.
- Explain necessary jargon simply.
- Keep explanations concise but clear.
- Use examples or metaphors to make abstract ideas concrete.`,
    },
  ],
};

// ==============================
// Global Configuration
// ==============================
let chatHistory = [systemPrompt];
const MAX_TOKENS = 4096; // model context window
const MODEL_WINDOW = 1024; // Gemini Nano limit
// Token Budgets
const OUTPUT_BUDGET = 300;  // Reserved for model output
const SYSTEM_BUDGET = 200;  // System + instructions
const USER_BUDGET = 300;    // User text
const CONTEXT_BUDGET = 200; // Context
const SAFE_INPUT_LIMIT = SYSTEM_BUDGET + USER_BUDGET + CONTEXT_BUDGET; // 700

// Debug Mode Toggle
const DEBUG_MODE = true;

// ==============================
// Utility Functions
// ==============================
function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

function debugLog(...args) {
  if (DEBUG_MODE) console.log("[Gemini Debug]", ...args);
}

function trimHistory(history, limit) {
  let total = 0;
  const trimmed = [];

  const system = history.find(msg => msg.role === "system");
  const others = history.filter(msg => msg.role !== "system");

  total += estimateTokens(system.parts[0].text);
  for (let i = others.length - 1; i >= 0; i--) {
    const msg = others[i];
    const tokens = estimateTokens(msg.parts?.[0]?.text || "");
    if (total + tokens > limit) break;
    trimmed.unshift(msg);
    total += tokens;
  }
  return [system, ...trimmed];
}

// ==============================
// Summarization Helpers
// ==============================
function getCompressionRatio(currentTokens, targetTokens) {
  if (currentTokens <= targetTokens) return 1;
  const ratio = targetTokens / currentTokens;
  return Math.max(ratio, 0.2);
}

async function summarizeToFit(text, targetTokens, label = "text") {
  const current = estimateTokens(text);
  if (current <= targetTokens) {
    debugLog(`${label}: within budget (${current}/${targetTokens})`);
    return text;
  }

  const ratio = getCompressionRatio(current, targetTokens);
  const compressionHint =
    ratio < 0.5
      ? "strongly compress while keeping all essential ideas"
      : "lightly compress while preserving most details";

  debugLog(`${label}: summarizing (${current} → ${targetTokens}), ratio = ${ratio.toFixed(2)}`);

  const prompt = `Summarize the following ${label} to fit roughly ${targetTokens} tokens.
Please ${compressionHint} and retain key facts, tone, and important meaning:

${text}`;

  const response = await chrome.runtime.sendMessage({
    action: "askGemini",
    text: prompt,
    history: [],
  });

  const summary = response?.reply || text;
  const after = estimateTokens(summary);
  debugLog(`${label} after summarization: ${after} tokens`);
  return summary;
}

// ==============================
// Main sendToGemini Function
// ==============================
export async function sendToGemini(userText, withBuildPrompt=false, withContext = false) {
  if (!userText || typeof userText !== "string" || userText.trim().length === 0) return;
  addUserMessage(userText);

  let context = "";

  // Context extraction + summarization
  if (withContext) {
    const fullPageText = extractMainTextFromDocument(document);
    context = getContextText(fullPageText, userText);
    const contextTokens = estimateTokens(context);
    debugLog(`Raw context tokens: ${contextTokens}`);

    if (contextTokens > CONTEXT_BUDGET) {
      context = await summarizeToFit(context, CONTEXT_BUDGET, "context");
    }
  }

  // User text summarization
  const userTokens = estimateTokens(userText);
  debugLog(`Raw user tokens: ${userTokens}`);

  if (userTokens > USER_BUDGET) {
    userText = await summarizeToFit(userText, USER_BUDGET, "user text");
  }

  // Build final prompt
  let finalPrompt= userText
  if (withBuildPrompt) finalPrompt = buildPrompt(userText, context);

  // Compute total input tokens
  const totalTokens =
    estimateTokens(systemPrompt.parts[0].text) + estimateTokens(finalPrompt);

  debugLog("Final input token breakdown:", {
    system: estimateTokens(systemPrompt.parts[0].text),
    user: estimateTokens(userText),
    context: estimateTokens(context),
    total: totalTokens,
    limit: SAFE_INPUT_LIMIT,
  });

  // Last safety compression if total > limit
  if (totalTokens > SAFE_INPUT_LIMIT) {
    debugLog(`⚠️ Final prompt exceeds safe limit (${totalTokens} > ${SAFE_INPUT_LIMIT}), compressing once more.`);
    finalPrompt = await summarizeToFit(finalPrompt, SAFE_INPUT_LIMIT - SYSTEM_BUDGET, "combined prompt");
  }

  // Send to Gemini Nano
  chatHistory.push({ role: "user", parts: [{ text: finalPrompt }] });
  chatHistory = trimHistory(chatHistory, MAX_TOKENS);

  debugLog("Sending to Gemini...", {
    totalTokens: estimateTokens(finalPrompt),
    outputBudget: OUTPUT_BUDGET,
  });

  const response = await chrome.runtime.sendMessage({
    action: "askGemini",
    text: finalPrompt,
    history: chatHistory,
  });

  if (response.error) {
    addAIResponse("Something went wrong. Please try again.");
    return;
  }

  addAIResponse(response.reply);
  chatHistory.push({ role: "model", parts: [{ text: response.reply }] });
  chatHistory = trimHistory(chatHistory, MAX_TOKENS);

  debugLog("✅ Response received and stored.");
}

// ==============================
// Prompt Builder
// ==============================
function buildPrompt(text, context, goal = "Simplify the concept and explain the main idea") {
  return `
  Please help me understand the following text:
  ${text}
  
    Optional context:
    ${context || "N/A"}

    My goal:
    ${goal}

    Respond in clear, natural language, focusing on clarity and motivation to continue reading.`;
}

function simpleMarkdownToHTML(markdown) {
  // Escape HTML first
  let html = markdown
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Headers
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // Bold **text**
  html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');

  // Italic *text*
  // Handles spaces, punctuation, and line breaks more reliably
  html = html.replace(/(\s|^)\*(?!\s)([^*]+?)\*(\s|$)/gim, '$1<em>$2</em>$3');

  // Inline code `code`
  html = html.replace(/`([^`]+)`/gim, '<code>$1</code>');

  // Links [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  // Paragraphs and line breaks
  html = html.replace(/\n{2,}/g, '</p><p>');
  html = html.replace(/\n/g, '<br>');
  html = '<p>' + html + '</p>';

  return html.trim();
}

