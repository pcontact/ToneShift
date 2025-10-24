// chatPanel.js
import { positionPanel, positionPanelAtPoint } from "./utils/helpers.js"
import { extractMainTextFromDocument } from "./utils/extractMainText.js"
let panelVisible = false;
let chatHistoryMapKey = ''
let chatHistoryMap = new Map(); // used for chat replay on the DOM
let scrollListenerAdded = false;
let anchorY = 0;
let isMouseOverPanel = false;
export let isInputHandlerSet = false;
let visibilityCallbacks = []

// ----------------- CSS Injection -----------------
export function injectCSS() {
    if (document.getElementById('tsChatPanelStyles')) return;
    const style = document.createElement('style');
    style.id = 'tsChatPanelStyles';
    style.textContent = `
    /* --- Global Reset for Isolation --- */
    .tsChatPanelContainer, 
    .tsChatPanelContainer * {
        box-sizing: border-box;
        font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    }
    .tsChatPanelContainer > * {
      all: unset;
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
        height: 400px;
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
    /* --- CLOSE BUTTON --- */
    .tsCloseButton {
      position: absolute;
      top: 8px;
      right: 10px;
      background: none;
      border: none;
      color: #777;
      font-size: 14px;
      cursor: pointer;
      line-height: 1;
      transition: color 0.2s ease, transform 0.3s ease;
    }

    .tsCloseButton:hover {
      color: #6C63FF;
      transform: rotate(90deg) scale(1.1);
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
    .tsTextInputContainer {
      display: flex;
      flex-direction: column;
      gap: 8px;
      width: 100%;
      max-width: 720px;
    }

    .tsTextInputContainer textarea {
      width: 100%;
      padding: 5px 12px;
      border-radius: 10px;
      border: 1px solid rgba(108, 99, 255, 0.12);
      outline: none;
      font-size: 14px;
      color: #222;
      background: #e0dcdcff;
      box-shadow: inset 0 1px 0 rgba(0, 0, 0, 0.02);
      
      resize: none;
      overflow-y: hidden; /* handled dynamically */
      line-height: 20px;
      min-height: 20px; /* one line */
      max-height: 100px; /* five lines (5 * 20px) */
      white-space: pre-wrap;
      word-wrap: break-word;
    }

    .tsChatSendBtn {
        display: flex;
        z-index: 9999;
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
    .tsChatSendBtn svg {
      width: 20px;
      height: 20px;
      vertical-align: middle;
      fill: currenColor;
    }

    .tsChatSendBtn:hover {
        transform: translateY(-1px) scale(1.02);
        box-shadow: 0 10px 24px rgba(108,99,255,0.18);
    }
    .tsChatSendBtn:hover:disabled{
      transform: none;
    }
    .tsChatSendBtn:disabled{
      background: #b1adf1ff;
    }

  /* --- Cancel button variant (uses same layout but different icon states) --- */
  .tsCancelBtn {
    background: #fff; /* neutral background so icon is clearly visible */
    color: inherit;
    padding: 6px;
    box-shadow: 0 6px 16px rgba(108,99,255,0.06);
    width: 40px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .tsCancelBtn svg {
    width: 16px; height: 16px; display: block;
    transition: transform 0.09s ease, fill 0.12s ease, stroke 0.12s ease;
    stroke: #000; fill: #000; visibility: visible;
  }
  .tsCancelBtn:hover svg { stroke: #e23b3b; fill: #e23b3b; transform: scale(1.05); }
  .tsCancelBtn:hover { box-shadow: 0 8px 22px rgba(226,59,59,0.12); transform: translateY(-1px) scale(1.02); }
  .tsCancelBtn:active svg { stroke: #b22222; fill: #b22222; transform: scale(0.96); }
  .tsCancelBtn:active { transform: translateY(0) scale(0.96); }

  /* Use data-URI SVG backgrounds as a fallback when inner SVGs are suppressed by 'all: unset' */
  .tsCancelBtn {
    background-repeat: no-repeat;
    background-position: center;
    background-size: 16px 16px;
    /* black icon */
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><circle cx='12' cy='12' r='10' fill='none' stroke='%23000' stroke-width='1.5'/><rect x='7' y='7' width='10' height='10' fill='%23000' rx='2' ry='2'/></svg>");
  }
  .tsCancelBtn:hover {
    /* red icon on hover */
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><circle cx='12' cy='12' r='10' fill='none' stroke='%23e23b3b' stroke-width='1.5'/><rect x='7' y='7' width='10' height='10' fill='%23e23b3b' rx='2' ry='2'/></svg>");
  }
  .tsCancelBtn:active {
    /* darker red when active */
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><circle cx='12' cy='12' r='10' fill='none' stroke='%23b22222' stroke-width='1.5'/><rect x='7' y='7' width='10' height='10' fill='%23b22222' rx='2' ry='2'/></svg>");
  }

  /* Cancel spinner shown inside the cancel button while cancel is processing */
  .tsCancelSpinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 2px solid rgba(0,0,0,0.08);
    border-top-color: #6C63FF; /* theme accent */
    box-sizing: border-box;
    margin-left: 6px;
    vertical-align: middle;
    animation: tsSpin 0.9s linear infinite;
  }

  @keyframes tsSpin { to { transform: rotate(360deg); } }

  /* Retry button - small pill that follows the primary theme */
  .tsRetryBtn {
    all: unset;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: #fff;
    color: #6C63FF;
    border: 1px solid rgba(108,99,255,0.12);
    padding: 6px 10px;
    border-radius: 10px;
    cursor: pointer;
    font-size: 13px;
    margin-left: 8px;
    box-shadow: 0 6px 16px rgba(108,99,255,0.06);
    transition: transform 0.12s ease, box-shadow 0.12s ease, background 0.12s ease;
  }

  .tsRetryBtn:hover { background: rgba(108,99,255,0.04); transform: translateY(-1px); box-shadow: 0 10px 20px rgba(108,99,255,0.12); }
  .tsRetryBtn:active { transform: scale(0.98); }

  /* Small, mild cancel note shown in AI bubble when user cancels */
  .tsCancelNote {
    display: inline-block;
    margin-top: 8px;
    padding: 6px 8px;
    background: rgba(0,0,0,0.04);
    color: #333;
    border-radius: 8px;
    font-size: 12px;
    line-height: 1;
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
        word-wrap: break-word;
        overflow-wrap: break-word;
    }
    .tsChatUserMessage:hover .tsCopyBtn { opacity: 1; transform: translateY(-2px); }

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
        overflow-wrap: break-word;
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
    
    .tsDisclaimerBadge{
      font-size: 10px;
      padding-bottom:4px;
      color: #797575ff;
      justify-content: center;
      text-align:center;
    }

    .tsChatHomePageContainer { 
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      flex-direction: column;
      align-items: stretch;       /* allows children to fill width */
      justify-content: center;    /* vertically centers children */
      width: 100%;
      max-width: 1000px;          /* optional: prevent it from getting too wide */
      padding: 20px 50px;            /* horizontal padding */
      box-sizing: border-box;     /* ensures padding doesn't break layout */
      display:none;
    }
    .tsChatHomePageContainer.tsVisible { 
        display: flex;
    }
    .tsChatPanelGreeting {
      font-weight: bold;     /* makes the text bold */
      text-align: center;    /* centers the text horizontally */
      width: 100%;           /* ensures it spans the parent width */
      margin: 0 auto;        /* keeps it centered if it’s a block element */
      display: block;        /* ensures text-align works predictably */
      font-size:25px
  }


    .tsChatPanelHomeActionBar {
        padding:10px;
        display: grid;
        grid-template-columns: repeat(2, auto);
        justify-content: center;
        align-items: center;
        gap: 1rem; /* space between buttons */
        width: 100%;
        height: 100%; /* or a fixed height if needed */
        text-align: center;
    }

    .tsChatPanelHomeActionBar button {
        padding: 0.2rem 0.6rem;    /* smaller padding = smaller button */
        font-size: 0.8rem;         /* scales down the text */
        border: none;
        border-radius: 4px;
        cursor: pointer;
        background-color: #6C63FF;
        color: white;
        transition: background-color 0.3s ease;
        width: auto;               /* ensures buttons size to their text */
    }


    .tsChatPanelHomeActionBar button:hover {
        transform: translateY(-1px) scale(1.02);
        box-shadow: 0 10px 24px rgba(108,99,255,0.18);
    }





    `;
    document.head.appendChild(style);
}

// ----------------- HTML Injection -----------------
export async function injectHTML() {
    if (document.getElementById('tsChatPanelContainer')) return;
    const isCloudAI =  await chrome.storage.local.get("useCloudModel");
    let aiModeLabel = isCloudAI.useCloudModel ? "Cloud AI" : "Local AI"

    const container = document.createElement('div');
    container.id = 'tsChatPanelContainer';
    container.className = 'tsChatPanelContainer';
    container.innerHTML = `
        <div class="tsChatPanelHeader">Gideon
          <div class="tsCloseButton">x</div>
        </div>
        <div class="tsChatPanelMessages">
        
          <div class="tsChatHomePageContainer">
            <div class="tsChatPanelGreeting">How can i help you?</div>
            <div class="tsChatPanelHomeActionBar">
              <button id="tsChatPanelSummarizeBtn">Summarize page</button>
              <button id="tsChatPanelExplainBtn"> Help me explain</button>
            </div>
          </div>

        </div>

        <div class="tsChatPanelInput">
            <div class = "tsTextInputContainer">
              <div style="display:none">Search</div>
              <textarea id="tsChatPanelTextInput" placeholder="Ask for more detail..." /></textarea>
              
            </div>
        </div>
         <div class="tsDisclaimerBadge">AI generated. Using current page as context. (${aiModeLabel})</div>
    `;
    document.body.appendChild(container);
    const textarea = document.getElementById('tsChatPanelTextInput');
    const lineHeight = 20; // matches CSS line-height
    const maxLines = 5;

    textarea.addEventListener('input', () => {
      textarea.style.height = 'auto'; // reset
      const scrollHeight = textarea.scrollHeight;
      const maxHeight = lineHeight * maxLines;
      textarea.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
      textarea.style.height = Math.min(scrollHeight, maxHeight) + 'px';
    });

    container.addEventListener('mouseenter', () => isMouseOverPanel = true);
    container.addEventListener('mouseleave', () => {
        isMouseOverPanel = false;
        //checkScrollHide();
    });

    const summarizeBtn = container.querySelector("#tsChatPanelSummarizeBtn")
    const explainBtn = container.querySelector("#tsChatPanelExplainBtn")

    summarizeBtn.addEventListener("click", async (e)=>{
      e.stopPropagation()
      container.querySelector(".tsChatHomePageContainer").remove()
      const userText = "Summarize this page"
      addUserMessage(userText)
      showTypingBubble()
      const awaitSummary = addAIResponse("Summarizing, please wait...")
      const summary = await getPageSummary();
      hideTypingBubble()
      awaitSummary.remove()
      if(!summary){
        addAIResponse("Something went wrong while summarizing this page.")
        return
      }
      addAIResponse(summary)
      addToChatHistoryMap(userText, summary)
    })
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
function addToChatHistoryMap(userText, aiText) {
  if(!chatHistoryMapKey) setChatHistoryMapKey()

  const hash = generateHash(chatHistoryMapKey.toString().trim());
  if (!chatHistoryMap.has(hash)) {
    chatHistoryMap.set(hash, []);
  }
  const history = chatHistoryMap.get(hash);
  history.push({ type: 'user', text: userText });
  history.push({ type: 'ai', text: aiText });
}

export function addUserMessage(text, saveToHistory = true) {
    const messages = document.querySelector('.tsChatPanelMessages');
    if (!messages) return;

    const msg = document.createElement('div');
    msg.className = 'tsChatUserMessage';
    msg.textContent = text;
    messages.appendChild(msg);
    autoScroll();
    showTypingBubble();
}

export function addAIResponse(text, saveToHistory = true) {
    //hideTypingBubble();

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

    return msg
}

function autoScroll() {
    const messages = document.querySelector('.tsChatPanelMessages');
    if (messages) messages.scrollTop = messages.scrollHeight;
}

// ----------------- Input Handling -----------------
let inputHandlers = []
export async function registerInputHandler(callback) {
  if(!typeof callback === "function"){
    console.warn(callback, "is not a function")
    return
  }
  inputHandlers.push(callback)
  console.log("registering for callback")
  const container = document.querySelector('.tsChatPanelInput');
  if (!container) return;
  console.log("container")
  const input = container.querySelector('#tsChatPanelTextInput');
  let sendBtn = container.querySelector('.tsChatSendBtn');

  if (!input) return;

  console.log("attaching handler")

  const sendMessage = async () => {
    const userText = input.value.trim();
    if (!userText) return;
    input.value = '';

    const msg = document.querySelector(".tsChatPanelMessages")
    msg.querySelector(".tsChatHomePageContainer")?.remove()
    //inputHandlers.forEach(async callback =>{
      //await callback(userText)
    //})
    await callback(userText);
  };

  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); sendMessage(); } });
  input.addEventListener('keyup', ()=>{
    if(input.value.trim().length > 0 && sendBtn.disabled){sendBtn.disabled=false}
  })
  // If a cancel button is active, a response is being generated.
  // Don't show the send button in this case. It will be restored later.
  if (container.querySelector('.tsCancelBtn')) {
      isInputHandlerSet = true;
      console.log("there is cnacel btn")
      return;
  }

  if (!sendBtn) {
      sendBtn = document.createElement('button');
      sendBtn.type = 'button';
      sendBtn.className = 'tsChatSendBtn';
      sendBtn.disabled = true;
      sendBtn.title = 'Send message';
      sendBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
        <path d="M2 21l21-9L2 3v7l15 2-15 2z"/>
      </svg>
    `;

      container.appendChild(sendBtn);
  }

  sendBtn.addEventListener('click', (e) => { e.stopPropagation(); sendMessage(); });
  isInputHandlerSet = true;
}

// Helper: create a fresh send button wired to the current input handler, or reattach the handler
export function createOrRestoreSendButton(onSend) {
  const inputContainer = document.querySelector('.tsChatPanelInput');
  if (!inputContainer) return;

  // Try to find an existing send button
  let sendBtn = inputContainer.querySelector('.tsChatSendBtn');

  // Case 1: A hidden send button exists — unhide and rebind
  if (sendBtn) {
    if (sendBtn.dataset.hiddenByCancel === '1') {
      sendBtn.style.display = '';
      delete sendBtn.dataset.hiddenByCancel;
    }

    // Remove old click listeners by cloning
    const newBtn = sendBtn.cloneNode(true);
    newBtn.type = 'button';

    // Clean event logic: stop propagation and handle text
    newBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const inputField = inputContainer.querySelector('#tsChatPanelTextInput');
      if (!inputField) return;
      const text = inputField.value.trim();
      if (!text) return;
      inputField.value = '';
      if (typeof onSend === 'function') onSend(text);
    });

    // Replace the old node to clear previous handlers
    try { sendBtn.replaceWith(newBtn); } catch (err) { console.error('Failed to replace send button:', err); }
    return;
  }

  // Case 2: No button exists — create a new one
  sendBtn = document.createElement('button');
  sendBtn.className = 'tsChatSendBtn';
  sendBtn.type = 'button';
  sendBtn.title = 'Send message';
 sendBtn.innerHTML = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
    <path d="M2 21l21-9L2 3v7l15 2-15 2z"/>
  </svg>
`;


  sendBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const inputField = inputContainer.querySelector('#tsChatPanelTextInput');
    if (!inputField) return;
    const text = inputField.value.trim();
    if (!text) return;
    inputField.value = '';
    if (typeof onSend === 'function') onSend(text);
  });

  inputContainer.appendChild(sendBtn);
}


// ----------------- Panel Controls -----------------
export async function openChatPanel(highlightedText) {
    injectCSS();
    await injectHTML();
    const panel = document.getElementById('tsChatPanelContainer');
    panel.style.display = 'flex';

    const header = panel.querySelector(".tsChatPanelHeader")
    setOwnText(header, "✨Gideon - Ask & Learn.")
    const btnClose = header.querySelector(".tsCloseButton")
    btnClose.title = "Close"
    if(btnClose) btnClose.onclick = () => {
      gracefullyRemovePanel();
    };

    if(!highlightedText && !chatHistoryMapKey){
      panel.querySelector(".tsChatHomePageContainer").classList.add("tsVisible")
      positionPanel(highlightedText, panel)
      //updatePanelPosition();
      requestAnimationFrame(() => panel.classList.add('tsVisible'));
      panelVisible = true
      visibilityCallbacks.forEach(callback =>{
        callback(panelVisible)
      })
      return
    }

    const messages = document.querySelector('.tsChatPanelMessages');
    messages.innerHTML = '';

    //if(!chatHistoryMapKey) setChatHistoryMapKey()
    //chatHistoryMapKey = highlightedText;
    const hash = generateHash(chatHistoryMapKey.toString().trim());
    if (chatHistoryMap.has(hash)) {
        // replay without saving (prevent duplicate writes)
        chatHistoryMap.get(hash).forEach(msg => {
            msg.type === 'ai' ? addAIResponse(msg.text, false) : addUserMessage(msg.text, false);
        });
    } 

    if(highlightedText){
      const text = highlightedText.toString().trim();
      sendToGemini(text, getDefaultContext(), true);
    }
    positionPanel(highlightedText, panel)
    //updatePanelPosition();
    requestAnimationFrame(() => panel.classList.add('tsVisible'));
    panelVisible = true
    visibilityCallbacks.forEach(callback =>{
      callback(panelVisible)
    })

    if (!scrollListenerAdded) {
        window.addEventListener('scroll', () => {
            //updatePanelPosition();
            checkScrollHide();
        });
        scrollListenerAdded = true;
    }
}

function setChatHistoryMapKey(){
  chatHistoryMapKey = window.location.href
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


export function registerVisibilityCallback(callback){
  console.log(callback)
  visibilityCallbacks.push(callback)
}

export function collapsePanel() {
    const panel = document.getElementById('tsChatPanelContainer');
    if (!panel || !panelVisible) return;

    closePanel()
    return

    panel.classList.remove('tsVisible');
    setTimeout(() => panel.style.display = 'none', 300);
    panelVisible = false;
    visibilityCallbacks.forEach(callback =>{
    callback(panelVisible)
  })


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
    visibilityCallbacks.forEach(callback =>{
      callback(panelVisible)
    })

    const bubble = document.getElementById('tsChatPanelBubble');
    if (bubble) {
        bubble.classList.add('tsHidden');
        setTimeout(() => bubble.remove(), 300);
    }

    //updatePanelPosition();
}

export function closePanel() {
    const panel = document.getElementById('tsChatPanelContainer');
    const bubble = document.getElementById('tsChatPanelBubble');
    if (panel) panel.remove();
    if (bubble) bubble.remove();
    chatHistoryMap.clear();
    panelVisible = false;
    visibilityCallbacks.forEach(callback =>{
      callback(panelVisible)
    })
    isInputHandlerSet = false
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
     visibilityCallbacks.forEach(callback =>{
      callback(panelVisible)
    })

}

function checkScrollHide() {
    if (!panelVisible) return;
    const currentY = window.scrollY;
    if (Math.abs(currentY - anchorY) > 50 && !isMouseOverPanel) gracefullyRemovePanel();
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
      text: `Your name is Gideon, you are a friendly, human-like assistant who helps users understand complex text in simple, clear, and engaging ways. Users may be students, researchers, or casual readers.

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
const SYSTEM_BUDGET = 100;  // System + instructions
const USER_BUDGET = 300;    // User text
export const CONTEXT_BUDGET = 300; // Context
const SAFE_INPUT_LIMIT = SYSTEM_BUDGET + USER_BUDGET + CONTEXT_BUDGET; // 700

// Debug Mode Toggle
const DEBUG_MODE = true;

// Default context
let defaultContext = "";

// ==============================
// Utility Functions
// ==============================
function removeLastUserMessage() {
  // 1. Remove from UI
  /*
  const messagesContainer = document.querySelector('.tsChatPanelMessages');
  if (messagesContainer) {
    const userMessages = messagesContainer.querySelectorAll('.tsChatUserMessage');
    if (userMessages.length > 0) {
      userMessages[userMessages.length - 1].remove();
    }
  }
    */

  // Remove from chatHistoryMap (for session replay)
  const hash = generateHash(chatHistoryMapKey.toString().trim());
  if (chatHistoryMap.has(hash)) {
    const history = chatHistoryMap.get(hash);
    // Find and remove the last user message from the array
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].type === 'user') {
        history.splice(i, 1);
        break; // Only remove the most recent one
      }
    }
  }

  // Remove from chatHistory (for model context)
  for (let i = chatHistory.length - 1; i >= 0; i--) {
    if (chatHistory[i].role === 'user') {
      chatHistory.splice(i, 1);
      break; // Only remove the most recent one
    }
  }
}

function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

function debugLog(...args) {
  if (DEBUG_MODE) console.log("[Gemini Debug]", ...args);
}

function trimHistory(history, limit) {
  let total = 0;
  const trimmed = [];

  if (!Array.isArray(history)) return [];

  console.log(history);

  // Get system message safely
  const system = history.find(msg => msg?.role === "system");

  // Filter out invalid or undefined entries
  const others = history.filter(msg => msg && msg.role !== "system");

  // Add system tokens if present
  if (system && system.parts?.[0]?.text) {
    total += estimateTokens(system.parts[0].text);
  }

  // Traverse others from end
  for (let i = others.length - 1; i >= 0; i--) {
    const msg = others[i];
    const text = msg.parts?.[0]?.text || "";
    const tokens = estimateTokens(text);
    if (total + tokens > limit) break;
    trimmed.unshift(msg);
    total += tokens;
  }

  return system ? [system, ...trimmed] : trimmed;
}


// ==============================
// Summarization Helpers
// ==============================
function getCompressionRatio(currentTokens, targetTokens) {
  if (currentTokens <= targetTokens) return 1;
  const ratio = targetTokens / currentTokens;
  return Math.max(ratio, 0.2);
}

export async function summarizeToFit(text, targetTokens, label = "text") {
    console.log("Summarizing to fit:", { text, label, targetTokens });
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

  console.log("from summarizeTofit, response: ", response)
  const summary = response?.reply || text;
  const after = estimateTokens(summary);
  debugLog(`${label} after summarization: ${after} tokens`);
  return summary;
}

// ==============================
// Main sendToGemini Function
// ==============================
export async function sendToGemini(userText, context = defaultContext, withBuildPrompt = false) {
  if (!userText || typeof userText !== "string" || userText.trim().length === 0) return;

  const userTokens = estimateTokens(userText);
  debugLog(`Raw user tokens: ${userTokens}`);

  if (userTokens > USER_BUDGET) {
    userText = await summarizeToFit(userText, USER_BUDGET, "user text");
  }

  let finalPrompt = userText;
  if (withBuildPrompt){
    finalPrompt = buildPrompt(userText, context);
    userText = `Explain this text in simpler terms:` + userText
    addUserMessage(userText)

  }else{addUserMessage(userText)}


  const totalTokens =
    estimateTokens(systemPrompt.parts[0].text) + estimateTokens(finalPrompt);

  debugLog("Final input token breakdown:", {
    system: estimateTokens(systemPrompt.parts[0].text),
    user: estimateTokens(userText),
    context: estimateTokens(context),
    total: totalTokens,
    limit: SAFE_INPUT_LIMIT,
  });

  if (totalTokens > SAFE_INPUT_LIMIT) {
    debugLog(`⚠️ Final prompt exceeds safe limit (${totalTokens} > ${SAFE_INPUT_LIMIT}), compressing once more.`);
    finalPrompt = await summarizeToFit(finalPrompt, SAFE_INPUT_LIMIT - SYSTEM_BUDGET, "combined prompt");
  }

  chatHistory.push({ role: "user", parts: [{ text: finalPrompt }] });
  chatHistory = trimHistory(chatHistory, MAX_TOKENS);

  debugLog("Opening streaming port to Gemini...");
  const port = chrome.runtime.connect({ name: 'gemini-stream' });
  let portAlive = true;
  port.onDisconnect.addListener(() => {
    portAlive = false;
    try {
      if (inputContainer) {
        createOrRestoreSendButton((text) => sendToGemini(userText, context, false));
      }
      if (inputField) inputField.disabled = false;
    } catch (e) { /* ignore */ }
  });

  const messages = document.querySelector('.tsChatPanelMessages');
  const aiMsg = document.createElement('div');
  aiMsg.className = 'tsChatAIResponse';

  // Cancel button with unique class (do NOT use tsChatSendBtn here)
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'tsCancelBtn';
  cancelBtn.title = 'Cancel generation';

  // SVG stop icon (unchanged)
  const svgns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Stop');
  svg.style.cssText = 'width:16px;height:16px;display:block;vertical-align:middle;visibility:visible;stroke:#000;fill:#000;';

  const circle = document.createElementNS(svgns, 'circle');
  circle.setAttribute('cx', '12');
  circle.setAttribute('cy', '12');
  circle.setAttribute('r', '10');
  circle.setAttribute('fill', 'none');
  circle.setAttribute('stroke', '#000');
  circle.setAttribute('stroke-width', '1.5');
  circle.style.cssText = 'stroke:#000;fill:none;stroke-width:1.5px;';

  const rect = document.createElementNS(svgns, 'rect');
  rect.setAttribute('x', '7');
  rect.setAttribute('y', '7');
  rect.setAttribute('width', '10');
  rect.setAttribute('height', '10');
  rect.setAttribute('fill', '#000');
  rect.setAttribute('rx', '2');
  rect.setAttribute('ry', '2');
  rect.style.cssText = 'fill:#000;';

  svg.appendChild(circle);
  svg.appendChild(rect);
  cancelBtn.appendChild(svg);

  const thinking = document.createElement('div');
  thinking.textContent = 'Thinking ...';
  aiMsg.appendChild(thinking);
  messages.appendChild(aiMsg);
  autoScroll();

  let accumulated = '';
  const reqId = 'req-' + Date.now() + '-' + Math.floor(Math.random() * 1e6);

  const _retryUserText = userText;
  const _retryWithBuildPrompt = withBuildPrompt;

  const textInputcontainer = document.querySelector('.tsTextInputContainer');
  const inputField = textInputcontainer ? textInputcontainer.querySelector('#tsChatPanelTextInput') : null;

  const inputContainer = document.querySelector(".tsChatPanelInput")

  // keep an optional clone if you want to use it later (not required for hide/unhide flow)
  let originalSendBtn = null;
  const spinner = document.createElement('span');
  spinner.className = 'tsCancelSpinner';
  spinner.style.marginLeft = '8px';
  spinner.style.fontSize = '12px';
  spinner.textContent = '';
  let cancelRequested = false;

  // Helper: unhide previously hidden send button (if any). Returns true if unhidden.
  const unhideExistingSendBtn = () => {
    if (!inputContainer) return false;
    const sendBtn = inputContainer.querySelector('.tsChatSendBtn');
    if (!sendBtn) return false;
    if (sendBtn.dataset.hiddenByCancel === '1') {
      createOrRestoreSendButton((text) => sendToGemini(text, context, withBuildPrompt));
      return true;
    }
    return false;
  };

  // Centralized restore helper: remove cancel button and unhide/create send button
  const restoreSendButton = () => {
    try {
      if (cancelBtn.isConnected) {
        cancelBtn.remove();
      }

      // try to unhide an existing send button (preferred)
      if (unhideExistingSendBtn()) return;

      // if none to unhide, create or restore via helper
      createOrRestoreSendButton((text) => sendToGemini(text, context, false));
    } catch (e) {
      console.error('restoreSendButton failed', e);
    }
  };

  try {
    debugLog(("Sending chat history on port: ", chatHistory))
    port.postMessage({ action: 'start', id: reqId, text: finalPrompt, history: chatHistory });
  } catch (err) {
    console.error('Failed to post start message to port', err);
  }

  const onMsg = (m) => {
    if (!m || (m.id && m.id !== reqId)) return;

    if (m.canceled) {
      try { if (thinking && thinking.isConnected) thinking.textContent = 'Canceled.'; } catch (e) {}
      //showCancelNote(aiMsg, 'Canceled.');
      cancelRequested = false;
      try { if (spinner && spinner.parentNode) spinner.remove(); } catch (e) {}
      try { if (originalSendBtn && cancelBtn.isConnected) cancelBtn.replaceWith(originalSendBtn); else if (cancelBtn.isConnected) cancelBtn.remove(); } catch (e) {}
      try { if (inputField) inputField.disabled = false; } catch (e) {}
      port.onMessage.removeListener(onMsg);
      removeLastUserMessage()
      setTimeout(() => { addRetryAction(aiMsg, _retryUserText, _retryWithBuildPrompt, context); try { if (thinking && thinking.isConnected) thinking.remove(); } catch (e) {} }, 2000);
      // prefer centralized restore to keep behavior consistent
      restoreSendButton();
      return;
    }

    if (m.error) {
      if (cancelRequested) {
        try { if (thinking && thinking.isConnected) thinking.textContent = 'Canceled.'; } catch (e) {}
        //showCancelNote(aiMsg, 'Canceled.');
      } else {
        try {
          if (thinking && thinking.isConnected){
            debugLog('⚠️ Error' + m.error)
            thinking.textContent = 'Something went wrong';
          }
        } catch (e) {}
      }
      cancelRequested = false;
      hideTypingBubble();
      try {
        if (spinner && spinner.parentNode) spinner.remove();
        // use centralized restore
        restoreSendButton();
      } catch (e) {}
      try { if (inputField) inputField.disabled = false; } catch (e) {}
      try { port.disconnect(); } catch (e) {}
      port.onMessage.removeListener(onMsg);
      removeLastUserMessage()
      if (!cancelRequested) addRetryAction(aiMsg, _retryUserText, _retryWithBuildPrompt, context);
      return;
    }

    if (m.chunk) {
      const wasEmpty = accumulated.length === 0;
      accumulated += m.chunk;
      if (wasEmpty) {
        hideTypingBubble();
        try { if (inputField) inputField.disabled = true; } catch (e) {}
      }
      thinking.textContent = accumulated;
      autoScroll();
      return;
    }

    if (m.done) {
      const final = (m.reply && m.reply.trim()) || accumulated;
      try { if (spinner && spinner.parentNode) spinner.remove(); } catch (e) {}
      // restore via centralized helper
      restoreSendButton();
      try { if (inputField) inputField.disabled = false; } catch (e) {}
      aiMsg.innerHTML = simpleMarkdownToHTML(final);

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
          await navigator.clipboard.writeText(final);
          if (resetTimeout) clearTimeout(resetTimeout);
          if (copiedNote && copiedNote.isConnected) copiedNote.remove();
          copyBtn.classList.add('tsCopied');
          copyBtn.innerHTML = '✅';
          copyBtn.appendChild(tooltip);
          copiedNote = document.createElement('span');
          copiedNote.className = 'tsCopiedText';
          copiedNote.textContent = 'Copied!';
          aiMsg.appendChild(copiedNote);
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

      copyBtn.addEventListener('click', handleCopy);
      aiMsg.appendChild(copyBtn);
      addToChatHistoryMap(_retryUserText, final)

      chatHistory.push({ role: 'model', parts: [{ text: final }] });
      chatHistory = trimHistory(chatHistory, MAX_TOKENS);

      port.onMessage.removeListener(onMsg);
      try { port.disconnect(); } catch (e) {}
    }
  };

  port.onMessage.addListener(onMsg);

  // Insert cancel button and hide send button (if present)
  if (inputContainer) {
    const sendBtn = inputContainer.querySelector('.tsChatSendBtn');
    if (sendBtn) {
      // keep a clone if you want an independent copy (optional)
      originalSendBtn = sendBtn.cloneNode(true);
      // hide the real send button so it's not visible (and mark it)
      sendBtn.dataset.hiddenByCancel = '1';
      sendBtn.style.display = 'none';
      // append cancelBtn to the input container
      inputContainer.appendChild(cancelBtn);
    } else {
      // no send btn currently — just append cancel
      inputContainer.appendChild(cancelBtn);
    }
  }

  cancelBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    try {
      cancelRequested = true;
      if (!portAlive) {
        thinking.textContent = 'Canceled by you.';
        // restore visible send button
        restoreSendButton();
        try { if (inputField) inputField.disabled = false; } catch (e) {}
        return;
      }
      spinner.textContent = '⏳';
      cancelBtn.appendChild(spinner);
      cancelBtn.disabled = true;
      port.postMessage({ action: 'cancel', id: reqId });
    } catch (err) {
      console.error('Cancel request failed', err);
      thinking.textContent = 'Canceled by you.';
      cancelRequested = false;
      restoreSendButton();
      try { if (inputField) inputField.disabled = false; } catch (e) {}
    }
    thinking.textContent = 'Canceling…';
  });

  function addRetryAction(containerEl, uText, rebuild, ctx) {
    const existing = containerEl.querySelector('.tsRetryBtn');
    if (existing) return;
    const retryBtn = document.createElement('button');
    retryBtn.className = 'tsRetryBtn tsChatSendBtn';
    retryBtn.textContent = 'Retry';
    retryBtn.style.marginTop = '8px';
    retryBtn.onclick = (ev) => {
      ev.stopPropagation();
      try { if (retryBtn.isConnected) retryBtn.remove(); } catch (e) {}
      sendToGemini(_retryUserText, ctx, _retryWithBuildPrompt);
    };
    containerEl.appendChild(retryBtn);
  }

  function showCancelNote(containerEl, text) {
    try {
      const existing = containerEl.querySelector('.tsCancelNote');
      if (existing) existing.remove();
      const note = document.createElement('div');
      note.className = 'tsCancelNote';
      note.setAttribute('role', 'status');
      note.setAttribute('aria-live', 'polite');
      note.textContent = text;
      containerEl.appendChild(note);
    } catch (e) { /* ignore */ }
  }
}



// ==============================
// Prompt Builder
// ==============================
function buildPrompt(text, context, goal = "Simplify the concept and explain the main idea") {
  return `
    Explain this text in simpler terms:
    ${text}
    

    Context (if any):
    ${context || "N/A"}
    `
}

function simpleMarkdownToHTML(markdown) {
  // Escape HTML first
  if(!markdown) return
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

export function setDefaultContext(summary) {
  defaultContext = summary;
}

export function getDefaultContext() {
  return defaultContext;
}

// ----------------- AI summarizer wrapper -----------------
async function summarizeWithAI(text) {
  // Defensive: ensure text is present
  if (!text) {
    console.warn("summarizeWithAI: no text provided");
    return "";
  }

  console.log("Summarizing new content...");

  try {
    // If there's a shared helper available, prefer it
    if (typeof summarizeToFit === "function") {
      try {
        const target = typeof CONTEXT_BUDGET !== "undefined" ? CONTEXT_BUDGET : 1500;
        const summary = await summarizeToFit(text, target, "page content");
        console.log("AI Summary (via summarizeToFit):", summary);
        return summary || "";
      } catch (innerErr) {
        console.warn("summarizeToFit failed:", innerErr);
        // fall through to fallback
      }
    }

    // For debug / dev, produce a simple truncated fallback summary:
    const fallback = text.slice(0, 1000).replace(/\s+/g, " ").trim();
    console.log("Using fallback summarizer (dev):", fallback);
    return fallback || "";

  } catch (err) {
    console.error("summarizeWithAI unexpected failure:", err);
    return "";
  }
}

// ----------------- Core concurrency-safe summary logic -----------------
let pageSummary = null;
let inFlightSummaryPromise = null;
let observerInitialized = false;

async function getPageSummary() {
  // Return cached immediately
  if (pageSummary !== null) return pageSummary;

  // Return existing in-flight promise if present
  if (inFlightSummaryPromise) return inFlightSummaryPromise;

  const text = typeof extractMainTextFromDocument === "function"
    ? extractMainTextFromDocument(document)
    : (console.warn("extractMainTextFromDocument is not defined"), null);

  if (!text) {
    console.log("No text found to summarize.");
    return null;
  }

  inFlightSummaryPromise = (async () => {
    try {
      const summary = await summarizeWithAI(text);
      pageSummary = summary || "";
      try { setDefaultContext(pageSummary); } catch (e) { /* non-fatal */ }

      if (!observerInitialized) {
        initObserver();
        observerInitialized = true;
      }

      return pageSummary;
    } catch (err) {
      console.error("Summarization failed:", err);
      return null;
    } finally {
      inFlightSummaryPromise = null; // allow future re-summarizations
    }
  })();

  return inFlightSummaryPromise;
}

function initObserver() {
  // Make sure MutationObserver exists and document.body is available
  if (typeof MutationObserver === "undefined" || !document.body) {
    console.warn("MutationObserver unavailable or document.body missing");
    return;
  }

  const observer = new MutationObserver(() => {
    debouncedReSummarize();
  });

  observer.observe(document.body, { childList: true, subtree: true });
  console.log("MutationObserver initialized for re-summarization.");
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
// Debounced re-summarize
const debouncedReSummarize = debounce(async () => {
  const text = typeof extractMainTextFromDocument === "function"
    ? extractMainTextFromDocument(document)
    : null;

  if (!text) return;

  // If already running, skip (guard)
  if (inFlightSummaryPromise) {
    console.log("Summarization already in progress, skipping re-summary.");
    return;
  }

  console.log("Detected page change, updating summary...");
  inFlightSummaryPromise = (async () => {
    try {
      const summary = await summarizeWithAI(text);
      pageSummary = summary || "";
      try { setDefaultContext(pageSummary); } catch (e) { /* ignore */ }
      return pageSummary;
    } catch (err) {
      console.error("Re-summarization failed:", err);
    } finally {
      inFlightSummaryPromise = null;
    }
  })();
}, 3000);

window.addEventListener("load", async () => {
  // If you prefer setDefaultContext in the load handler, use the following:
  const summary = await getPageSummary();
  try { setDefaultContext(summary); } catch (e) { /* ignore */ }
});