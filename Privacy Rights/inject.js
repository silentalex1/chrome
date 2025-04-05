(function() {
  const blockedPatterns = [
    'ads', 'analytics', 'track', 'beacon', 'pixel', 'advert', 'promo', 'sponsor', 'banner', 'affiliate'
  ];

  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      if (mutation.addedNodes.length) {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1) {
            const src = node.src || node.getAttribute('data-src') || '';
            const href = node.href || node.getAttribute('data-href') || '';
            const className = node.className || '';
            const id = node.id || '';
            if (blockedPatterns.some(pattern => src.includes(pattern) || href.includes(pattern) || className.includes(pattern) || id.includes(pattern))) {
              node.parentNode?.removeChild(node);
            }
          }
        });
      }
    });
  });

  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
})();