let adblockActive = false;
let cachedExtensions = [];

function initializeExtension() {
  chrome.storage.local.get(['cachedExtensions', 'adblockActive'], (data) => {
    cachedExtensions = data.cachedExtensions || [];
    adblockActive = data.adblockActive || false;
    updateAdblockRules();
    syncExtensions();
  });
}

chrome.runtime.onInstalled.addListener(() => {
  initializeExtension();
});

chrome.alarms.create('syncExtensions', { periodInMinutes: 2 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'syncExtensions') {
    syncExtensions();
  }
});

async function syncExtensions() {
  const extensions = await chrome.management.getAll();
  cachedExtensions = extensions.map(ext => ({
    id: ext.id,
    name: ext.name,
    enabled: ext.enabled,
    permissions: ext.permissions || [],
    hostPermissions: ext.hostPermissions || [],
    installType: ext.installType,
    version: ext.version,
    mayDisable: ext.mayDisable || false,
    riskLevel: assessRisk(ext)
  }));
  chrome.storage.local.set({ cachedExtensions });
}

function assessRisk(ext) {
  const permissionScore = (ext.permissions.length + (ext.hostPermissions || []).length) * 1.5;
  const installTypeScore = ext.installType === 'development' ? 8 : 0;
  const activityScore = ext.enabled ? 4 : 0;
  const totalScore = permissionScore + installTypeScore + activityScore;
  if (totalScore > 15) return 'high';
  if (totalScore > 8) return 'medium';
  return 'low';
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'fetchExtensions') {
    sendResponse({ extensions: cachedExtensions });
    return true;
  }

  if (message.type === 'toggleExtension') {
    chrome.management.setEnabled(message.extId, message.enable, () => {
      syncExtensions().then(() => {
        sendResponse({ success: true });
      });
    });
    return true;
  }

  if (message.type === 'removeExtension') {
    chrome.management.uninstall(message.extId, { showConfirmDialog: false }, () => {
      syncExtensions().then(() => {
        sendResponse({ success: true });
      });
    });
    return true;
  }

  if (message.type === 'switchAdblock') {
    adblockActive = message.activate;
    chrome.storage.local.set({ adblockActive }, () => {
      updateAdblockRules();
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          if (tab.url && !tab.url.startsWith('chrome://')) {
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['content.js']
            });
          }
        });
      });
      sendResponse({ success: true, active: adblockActive });
    });
    return true;
  }

  if (message.type === 'checkAdblock') {
    sendResponse({ active: adblockActive });
    return true;
  }
});

function updateAdblockRules() {
  chrome.declarativeNetRequest.updateEnabledRulesets({
    enableRulesetIds: adblockActive ? ['ruleset_1'] : [],
    disableRulesetIds: adblockActive ? [] : ['ruleset_1']
  });
}

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (adblockActive && blockAdRequests(details)) {
      return { cancel: true };
    }
    return { cancel: false };
  },
  { urls: ['<all_urls>'], types: ['script', 'image', 'xmlhttprequest', 'sub_frame'] },
  ['blocking']
);

function blockAdRequests(details) {
  const url = new URL(details.url);
  const adDomains = [
    'doubleclick.net', 'adservice.google.com', 'adnxs.com', 'googlesyndication.com',
    'facebook.com/tr', 'taboola.com', 'outbrain.com', 'revcontent.com', 'adroll.com',
    'criteo.com', 'amazon-adsystem.com', 'pubmatic.com', 'rubiconproject.com',
    'openx.net', 'indexww.com', 'adform.net', 'media.net', 'yieldmanager.com'
  ];
  return adDomains.some(domain => url.hostname.includes(domain));
}