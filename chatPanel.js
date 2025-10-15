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

    /* --- Core Panel --- */
    .tsChatPanelContainer { 
        position: absolute;
        width: 400px; max-width: 90%; 
        background: #fff; border: 1px solid #ccc; 
        border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); 
        display: flex; flex-direction: column; 
        overflow: hidden; z-index: 9999;
        transform: translateY(10px);
        opacity: 0;
        transition: transform 0.3s ease, opacity 0.3s ease, top 0.3s ease, left 0.3s ease;
    }
    .tsChatPanelContainer.tsVisible { 
        transform: translateY(0); 
        opacity: 1; 
    }

    /* --- Header --- */
    .tsChatPanelHeader { 
        padding: 10px; 
        font-weight: 600; 
        font-size: 14px;
        background: #f5f5f5; 
        border-bottom: 1px solid #eee;
    }

    /* --- Messages Area --- */
    .tsChatPanelMessages { 
        flex: 1; 
        padding: 10px; 
        overflow-y: auto; 
        max-height: 300px;
        display: flex;
        flex-direction: column;
        scrollbar-width: thin;
    }

    /* --- Input + Send --- */
    .tsChatPanelInput {
        display: flex;
        border-top: 1px solid #eee;
        align-items: center;
    }

    .tsChatPanelInput input {
        flex: 1;
        padding: 8px 10px;
        border: none;
        outline: none;
        font-size: 14px;
        color: #333;
        background: white;
    }

    .tsChatSendBtn {
        display: flex;
        align-items: center;
        justify-content: center;
        background: #007bff;
        color: white;
        border: none;
        border-radius: 4px;
        width: 32px;
        height: 32px;
        margin-left: 6px;
        cursor: pointer;
        font-size: 16px;
        transition: background 0.2s ease, transform 0.2s ease;
    }

    .tsChatSendBtn:hover {
        background: #0056b3;
        transform: scale(1.1);
    }

    /* --- Floating Bubble --- */
    .tsChatPanelBubble { 
        position: fixed; 
        bottom: 20px; 
        right: 20px; 
        cursor: pointer; 
        background: #007bff; 
        color: white; 
        border-radius: 50%; 
        width: 40px; 
        height: 40px; 
        display: flex; 
        align-items: center; 
        justify-content: center; 
        z-index: 9999; 
        transition: transform 0.3s ease, opacity 0.3s ease;
        border: none;
        box-shadow: 0 3px 10px rgba(0,0,0,0.2);
    }

    .tsChatPanelBubble.tsHidden { 
        opacity: 0; 
        transform: scale(0); 
    }

    /* --- User & AI Messages --- */
    .tsChatUserMessage {
        margin: 6px 0;
        background: #d1e7ff;
        padding: 6px 8px;
        border-radius: 8px;
        align-self: flex-end;
        max-width: 80%;
        font-size: 14px;
        color: #111;
    }

    .tsChatAIResponse {
        position: relative;
        margin: 6px 0;
        background: #f1f1f1;
        padding: 6px 8px 22px 8px;
        border-radius: 8px;
        font-size: 14px;
        line-height: 1.4;
        color: #111;
        word-break: break-word;
        transition: background 0.2s ease;
        max-width: 80%;
    }

    .tsChatAIResponse:hover {
        background: #eef5ff;
    }

    /* --- Copy Button --- */
    .tsCopyBtn {
        all: unset;
        position: absolute;
        bottom: 4px;
        right: 6px;
        background: transparent;
        color: #888;
        cursor: pointer;
        font-size: 12px;
        opacity: 0;
        transition: opacity 0.25s ease, color 0.25s ease, transform 0.25s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        border: none;
        outline: none;
        box-shadow: none;
    }

    .tsChatAIResponse:hover .tsCopyBtn {
        opacity: 1;
    }

    .tsCopyBtn:hover {
        color: #007bff;
        transform: scale(1.2);
    }

    .tsCopyBtn:focus,
    .tsCopyBtn:focus-visible {
        outline: none !important;
        border: none !important;
        box-shadow: none !important;
    }

    .tsCopyBtn.tsCopied {
        color: #28a745;
        font-weight: 600;
    }

    /* --- Tooltip --- */
    .tsCopyTooltip {
        position: absolute;
        bottom: 24px;
        right: 0;
        background: #333;
        color: white;
        font-size: 11px;
        padding: 3px 6px;
        border-radius: 4px;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s ease, transform 0.2s ease;
        transform: translateY(4px);
        white-space: nowrap;
    }

    .tsCopyBtn:hover .tsCopyTooltip {
        opacity: 1;
        transform: translateY(0);
    }

    /* --- Copied animation fade-out --- */
    @keyframes tsCopiedFade {
        0% { opacity: 1; transform: translateY(0); }
        100% { opacity: 0; transform: translateY(-4px); }
    }

    .tsCopiedText {
        position: absolute;
        bottom: 26px;
        right: 2px;
        color: #28a745;
        font-size: 11px;
        background: rgba(255,255,255,0.9);
        border-radius: 4px;
        padding: 2px 5px;
        animation: tsCopiedFade 1.2s forwards;
        pointer-events: none;
    }

    /* --- Typing Bubble --- */
    .tsTypingBubble {
        display: inline-flex;
        align-items: center;
        background: #f1f1f1;
        border-radius: 16px;
        padding: 6px 10px;
        margin: 4px 0;
        gap: 4px;
        width: fit-content;
        opacity: 0;
        transform: translateY(5px);
        animation: tsTypingFadeIn 0.3s forwards;
    }

    .tsTypingBubble span {
        width: 6px;
        height: 6px;
        background: #888;
        border-radius: 50%;
        animation: tsTypingDots 1.2s infinite ease-in-out;
    }

    .tsTypingBubble span:nth-child(2) { animation-delay: 0.2s; }
    .tsTypingBubble span:nth-child(3) { animation-delay: 0.4s; }

    @keyframes tsTypingDots {
        0%, 20% { opacity: 0.2; transform: translateY(0); }
        50% { opacity: 1; transform: translateY(-2px); }
        100% { opacity: 0.2; transform: translateY(0); }
    }

    @keyframes tsTypingFadeIn {
        to { opacity: 1; transform: translateY(0); }
    }

    @keyframes tsTypingFadeOut {
        to { opacity: 0; transform: translateY(5px); }
    }
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
        <div class="tsChatPanelHeader">Explaining highlighted text…</div>
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
export function addUserMessage(text) {
    const messages = document.querySelector('.tsChatPanelMessages');
    if (!messages) return;

    const msg = document.createElement('div');
    msg.className = 'tsChatUserMessage';
    msg.textContent = text;
    messages.appendChild(msg);
    autoScroll();
    showTypingBubble();

    if (!chatHistoryMap.has(lastHighlight)) chatHistoryMap.set(lastHighlight, []);
    chatHistoryMap.get(lastHighlight).push({ type: 'user', text });
}

export function addAIResponse(text) {
    hideTypingBubble();

    const messages = document.querySelector('.tsChatPanelMessages');
    if (!messages) return;

    const msg = document.createElement('div');
    msg.className = 'tsChatAIResponse';
    msg.textContent = text;

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

    if (!chatHistoryMap.has(lastHighlight)) chatHistoryMap.set(lastHighlight, []);
    chatHistoryMap.get(lastHighlight).push({ type: 'ai', text });
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

    const messages = document.querySelector('.tsChatPanelMessages');
    messages.innerHTML = '';

    panelVisible = true;
    lastHighlight = highlightedText;

    if (chatHistoryMap.has(lastHighlight)) {
        chatHistoryMap.get(lastHighlight).forEach(msg => {
            msg.type === 'ai' ? addAIResponse(msg.text) : addUserMessage(msg.text);
        });
    } else {
        const text = highlightedText.toString().trim();
        sendToGemini(text, true);
        //addAIResponse(`Here’s what this means: ${highlightedText}`);
        //addUserMessage(highlightedText)
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

 
// Persistent system prompt
const systemPrompt = {
  role: "system",
  parts: [
    {
      text: `You are a friendly, human-like assistant who helps users understand complex text in simple, clear, and engaging ways. Users may be students, researchers, or casual readers, and their input may be a sentence, paragraph, or include context like surrounding text or page summaries.

            Your goals:

            Simplify concepts: Break down difficult ideas using plain language, analogies, or everyday examples.

            Highlight the main idea: Show the core message quickly and clearly.

            Encourage confidence: Make users feel capable and motivated to continue reading.

            Guidelines:

            Write naturally and conversationally; avoid robotic, formal, or lecturing tones.

            Integrate any provided context to improve understanding.

            Explain necessary jargon simply.

            Keep explanations concise but thorough enough for comprehension.

            Use examples or metaphors to make abstract ideas concrete.

            Think of your responses as a knowledgeable friend or peer, eager to help the user grasp the idea effortlessly while inspiring confidence to keep learning.`.trim(),
    },
  ],
};

let chatHistory = [systemPrompt];
const MAX_TOKENS = 4096; // Gemini nano context window size
const INPUT_TOKEN_THRESHOLD = 500 //Token threshold for user input text. 524 token for model response

// Estimate tokens (rough heuristic)
function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

function trimHistory(history, limit) {
  let total = 0;
  const trimmed = [];

  // Keep system prompt
  const system = history.find(msg => msg.role === "system");
  const others = history.filter(msg => msg.role !== "system");

  // Count system prompt tokens
  total += estimateTokens(system.parts[0].text);

  // Traverse backwards through conversation
  for (let i = others.length - 1; i >= 0; i--) {
    const msg = others[i];
    const tokens = estimateTokens(msg.parts?.[0]?.text || "");
    if (total + tokens > limit) break;
    trimmed.unshift(msg);
    total += tokens;
  }

  return [system, ...trimmed];
}

export async function sendToGemini(userText, withContext=false) {
    if (!userText || userText.trim().length === 0 || typeof userText !== "string") return;  
    addUserMessage(userText);
    if (withContext){
        const fullPageText  = extractMainTextFromDocument(document)
        const context = getContextText(fullPageText, userText)

        console.log("context: ",context)
        userText = buildPrompt(userText, context)
        console.log("New userText:", userText)
    }

    // logic to handle userText greater than 500 token threshold
    if(estimateTokens(userText) > INPUT_TOKEN_THRESHOLD){
        // push the userText in the context window(chatHistory)
        // and change userText to instruct the AI to explain based on preceeding texts
        
        //chatHistory.push({role:"user", parts:[{text:userText}] })
        //userText = "Now provide your explanation"
    }
    
    chatHistory.push({ role: "user", parts: [{ text: userText }] });

    // Trim before sending
    chatHistory = trimHistory(chatHistory, MAX_TOKENS);
    console.log(chatHistory);

    const response = await chrome.runtime.sendMessage({
        action: "askGemini",
        text: userText,
        history: chatHistory,
    });

    if (response.error) {
        const message = "Something went wrong. Please try again."
        addAIResponse(message);
        return;
    }

    addAIResponse(response.reply);

    // Add model reply
    chatHistory.push({ role: "model", parts: [{ userText: response.reply }] });

    // Trim again after receiving response
    chatHistory = trimHistory(chatHistory, MAX_TOKENS);

    //console.log("Gemini:", response.reply);
}

function buildPrompt(text, context, goal="Simplify the Concept and Explain the main idea") {
    const goals = [
        "Simplify the concept",
        "Explain the main idea",
        "Give me confidence to continue reading",
        "Provide examples/analogies"
    ];

    return `Please help me understand the following text:

            ${text}

            Optional context:  
            ${context || "N/A"}
            My goal:  
            ${goal || "N/A"}

            Please respond in clear, natural language, making the idea easy to grasp and motivating me to continue reading.
    `
}

