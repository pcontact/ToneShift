

🔮 ToneShift

Your rhetorical dial for the web.

Instantly rewrite, simplify, or restyle any text you find online — directly where you’re reading.


---

🧩 Overview

ToneShift is a Chrome extension that transforms the way people interact with text online.
By selecting any piece of text on a webpage, users can instantly generate a refined version in a different tone — Simple, Casual, Formal, Short, or Creative — using built-in AI models.

Instead of copying and pasting text into external tools, ToneShift brings the power of intelligent rewriting right to the webpage itself.


---

✨ Features

⚙️ Instant Text Refinement: Right-click or click “Refine this text” to open a live comparison panel.

🧠 AI-Powered Rewrites: Uses both the Gemini API and Chrome’s Built-in AI Model API for fast, context-aware tone adjustments.

🎨 Multiple Tones: Choose from Simple, Casual, Formal, Short, or Creative styles.

🔒 Client-Side Processing: Designed for privacy — text stays local.

⚡ Lightweight UI: Built with vanilla JavaScript and Manifest V3 for performance and simplicity.



---

🏗️ Architecture

ToneShift follows a client-side extension architecture:

User → Chrome Extension → Content Script → AI Model API → Refined Output

Key Components:

Content Script: Detects selected text and injects UI elements.

Popup Panel: Displays side-by-side comparison (original vs refined).

AI Module: Manages tone-specific prompts and model requests.

Background Script: Handles persistent settings and permissions.



---

🛠️ Installation & Testing Instructions (Judges’ Guide)

Follow these steps to set up, run, and evaluate ToneShift:

1. Clone the Repository

git clone https://github.com/pcontact/ToneShift.git
cd ToneShift

2. Load the Extension in Chrome

1. Open Chrome and go to chrome://extensions/


2. Enable Developer mode (toggle in the top right)


3. Click Load unpacked


4. Select the cloned ToneShift folder



3. Activate the Extension

Once loaded, you should see the ToneShift icon in your browser toolbar.

4. Test the Application

1. Navigate to any webpage with text (e.g., a news article or technical blog).


2. Highlight a paragraph or sentence.


3. A “Refine this text” button should appear within one second.


4. Click it — a panel will open showing:

Left: Original text

Right: AI-refined version



5. Use the Adjust Tone dropdown to change the rewrite style.


6. Open the extension popup (click the ToneShift icon) to:

Enable/disable the “Refine this text” button

Switch between local or cloud AI model

Access help and settings




No additional server setup or API keys are required — ToneShift runs client-side using available browser APIs.


---

⚙️ Configuration

If you wish to use the Gemini API for enhanced rewriting:

1. Open the extension popup (click the ToneShift icon).


2. Check the “Use cloud Gemini model” checkbox.



Otherwise, ToneShift defaults to Chrome’s local AI model for testing.


---

🧪 Tests

ToneShift has been manually tested on:

Chrome v138+


Functional tests verify:

Button appearance timing

Correct tone application

Error handling when models are unavailable



---

📦 Tech Stack

Platform: Chrome Extension (Manifest V3)

Language: JavaScript (ES6)

AI Models: Gemini API, Chrome Built-in AI

Version Control: Git + GitHub



---

🤝 Contributing

Contributions are welcome!

1. Fork the project


2. Create a new branch

git checkout -b feature/new-idea


3. Make your changes


4. Commit and push


5. Open a Pull Request



See CONTRIBUTING.md for best practices.


---

📜 License

Distributed under the MIT License. See LICENSE for details.


---

🧠 Roadmap

Future versions of ToneShift will include:

[ ] Inline Rewriting: Apply tone changes directly on the webpage

[ ] Full-Page Refinement: Rewrite entire articles

[ ] Multi-Language Support: Translate and tone-shift simultaneously

[ ] Conversational Deep Dives: Turn refined text into a chat exploration



---

👤 Author

Shedrach — Creator of ToneShift
GitHub Profile


---

🧭 Inspiration

ToneShift was born from a simple frustration: switching tabs to ask an AI for help understanding technical text.
It bridges that gap, giving readers instant, contextual clarity without breaking their reading flow — a small change that transforms how we consume complex information online.

