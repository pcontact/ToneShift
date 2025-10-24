// background/semantic.js

export class BackgroundService {
  constructor() {
    this.pageData = new Map();
    this.initialize();
  }

  initialize() {
    console.log('Semantic Search background service initialized');

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (['PAGE_INDEXED', 'GET_CACHED_CHUNKS', 'SEARCH_QUERY'].includes(request.type)) {
        this.handleMessage(request, sender, sendResponse);
        return true;
      }
    });

    chrome.tabs.onRemoved.addListener(tabId => this.pageData.delete(tabId));

    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.url?.startsWith('http')) {
        this.pageData.delete(tabId);
      }
    });
  }

  handleMessage(request, sender, sendResponse) {
    const tabId = sender.tab?.id;
    switch (request.type) {
      case 'PAGE_INDEXED':
        if (tabId) {
          this.pageData.set(tabId, {
            url: request.data.url,
            chunks: request.data.chunks,
            timestamp: Date.now(),
            chunkCount: request.data.chunkCount
          });
        }
        sendResponse({ success: true });
        break;

      case 'GET_CACHED_CHUNKS':
        if (tabId && this.pageData.has(tabId)) {
          sendResponse({ success: true, data: this.pageData.get(tabId) });
        } else {
          sendResponse({ success: false, error: 'No cached data' });
        }
        break;

      case 'SEARCH_QUERY':
        this.handleSearchQuery(request, sender, sendResponse);
        break;

      default:
        sendResponse({ success: false, error: 'Unknown message type' });
    }
  }

  async handleSearchQuery(request, sender, sendResponse) {
    try {
      const tabId = sender.tab?.id;
      if (!tabId || !this.pageData.has(tabId)) {
        sendResponse({ success: false, error: 'Page not indexed. Please refresh and try again.' });
        return;
      }

      const pageData = this.pageData.get(tabId);
      const results = this.simpleKeywordSearch(request.query, pageData.chunks);

      sendResponse({
        success: true,
        results: results.slice(0, 10),
        query: request.query,
        totalMatches: results.length
      });
    } catch (error) {
      console.error('Search error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  simpleKeywordSearch(query, chunks) {
    const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    return chunks
      .map((chunk, index) => {
        const text = chunk.text.toLowerCase();
        let score = 0;
        queryTerms.forEach(term => {
          const matches = (text.match(new RegExp(term, 'g')) || []).length;
          score += matches;
        });
        return { ...chunk, score, originalIndex: index };
      })
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score);
  }

  getStorageStats() {
    return {
      cachedPages: this.pageData.size,
      totalChunks: Array.from(this.pageData.values()).reduce((s, d) => s + d.chunkCount, 0)
    };
  }
}
