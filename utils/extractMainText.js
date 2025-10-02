(function() {

  let extractionDone = false;
  let debounceTimer = null;
  const MAX_WAIT = 5000; // max time to keep trying (ms)
  
  function extractMainText() {
    try {
      if (extractionDone) return

      const docClone = document.cloneNode(true);
      const article = new Readability(docClone).parse();
      window.postMessage({
        type: 'TONESHIFT_MAIN_TEXT',
        text: article ? article.textContent : null
      }, '*');

      extractionDone = true
      if(observer) observer.disconnect()
      clearTimeout(timeoutTimer)
    } catch (e) {
      console.warn('Error extracting main text:', e);
    }
  }

  // Initial extraction
  extractMainText();

  //Observe dynamically loaded content
  const observer = new MutationObserver(() => {
      if (debounceTimer) clearTimeout(debounceTimer);
      // Debounce: wait 300ms after last mutation before running
      debounceTimer = setTimeout(extractMainText, 300);
  });

observer.observe(document.body, { childList: true, subtree: true });

//Safety timeout: stop trying after MAX_WAIT
const timeoutTimer = setTimeout(() => {
    if (!extractionDone) {
        console.warn("Main text extraction timed out.");
        observer.disconnect();
    }
}, MAX_WAIT);

})();

