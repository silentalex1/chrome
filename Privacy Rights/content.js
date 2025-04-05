(() => {
  let isAdblockOn = false;
  const adFilters = [
    /ads\.google\.com/i, /doubleclick\.net/i, /adserver\.com/i, /\.ad\./i,
    /paywall/i, /analytics/i, /track/i, /banner/i, /sponsor/i, /promo/i,
    /advert/i, /affiliate/i, /popunder/i, /pop-up/i
  ];

  function setupAdblock() {
    chrome.storage.local.get(['adblockActive'], (data) => {
      isAdblockOn = data.adblockActive || false;
      if (isAdblockOn) {
        removeAds();
      }
    });
  }

  function removeAds() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1) {
            const src = node.src || '';
            const href = node.href || '';
            const className = node.className || '';
            const id = node.id || '';
            if (adFilters.some(filter => filter.test(src) || filter.test(href) || filter.test(className) || filter.test(id))) {
              node.remove();
            }
          }
        });
      });
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    const adElements = document.querySelectorAll('iframe, ins, [class*="ad"], [id*="ad"]');
    adElements.forEach(node => node.remove());
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'updateAdblock') {
      isAdblockOn = message.activate;
      if (isAdblockOn) {
        removeAds();
      } else {
        location.reload();
      }
      sendResponse({ success: true });
    }
  });

  setupAdblock();
})();