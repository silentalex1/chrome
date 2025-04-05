document.addEventListener('DOMContentLoaded', () => {
  const extensionsContainer = document.getElementById('extensionList');
  const searchInput = document.querySelector('.search-bar');
  const filterDropdown = document.querySelector('.sort-bar');
  const enableSelectedBtn = document.getElementById('enableBtn');
  const disableSelectedBtn = document.getElementById('disableBtn');
  const removeSelectedBtn = document.getElementById('uninstallBtn');
  const notificationBar = document.getElementById('notification');
  let extensionsData = [];

  function initializePopup() {
    chrome.storage.local.get(['cachedExtensions'], (data) => {
      extensionsData = data.cachedExtensions || [];
      displayExtensions('all');
    });
  }

  function displayExtensions(filter) {
    extensionsContainer.innerHTML = '';
    let filteredData = extensionsData.filter(ext => {
      if (filter === 'enabled') return ext.enabled;
      if (filter === 'disabled') return !ext.enabled;
      if (filter === 'risk') return ext.riskLevel === 'high';
      return true;
    });
    filteredData.forEach(ext => {
      const item = document.createElement('div');
      item.className = `extension-item ${ext.riskLevel}`;
      item.innerHTML = `
        <input type="checkbox" data-id="${ext.id}" ${!ext.mayDisable ? 'disabled' : ''}>
        <span class="extension-name">${ext.name}</span>
        <div class="risk">${ext.riskLevel}</div>
        <button class="toggle-btn" data-id="${ext.id}" ${!ext.mayDisable ? 'disabled' : ''}>${ext.enabled ? 'Disable' : 'Enable'}</button>
        <button class="uninstall-btn" data-id="${ext.id}">Uninstall</button>
      `;
      extensionsContainer.appendChild(item);
    });
    updateStatsPanel();
  }

  function updateStatsPanel() {
    document.getElementById('total').textContent = extensionsData.length;
    document.getElementById('enabled').textContent = extensionsData.filter(ext => ext.enabled).length;
    document.getElementById('mem').textContent = `${extensionsData.reduce((sum, ext) => sum + (ext.enabled ? 0.5 : 0.2), 0).toFixed(1)} MB`;
    document.getElementById('cpu').textContent = `${extensionsData.reduce((sum, ext) => sum + (ext.enabled ? 0.1 : 0.03), 0).toFixed(1)}%`;
    document.getElementById('risk').textContent = extensionsData.filter(ext => ext.riskLevel === 'high').length;
  }

  searchInput.addEventListener('input', () => {
    const query = searchInput.value.toLowerCase();
    displayExtensions(filterDropdown.value, query);
  });

  filterDropdown.addEventListener('change', () => {
    displayExtensions(filterDropdown.value);
  });

  extensionsContainer.addEventListener('click', (e) => {
    const id = e.target.dataset.id;
    if (!id) return;

    if (e.target.classList.contains('toggle-btn')) {
      const enable = !extensionsData.find(ext => ext.id === id).enabled;
      chrome.runtime.sendMessage({ type: 'toggleExtension', extId: id, enable }, () => {
        chrome.storage.local.get(['cachedExtensions'], (data) => {
          extensionsData = data.cachedExtensions;
          displayExtensions(filterDropdown.value);
        });
      });
    }

    if (e.target.classList.contains('uninstall-btn')) {
      chrome.runtime.sendMessage({ type: 'removeExtension', extId: id }, () => {
        chrome.storage.local.get(['cachedExtensions'], (data) => {
          extensionsData = data.cachedExtensions;
          displayExtensions(filterDropdown.value);
        });
      });
    }
  });

  enableSelectedBtn.addEventListener('click', () => {
    const selected = document.querySelectorAll('input[type="checkbox"]:checked');
    selected.forEach(checkbox => {
      const id = checkbox.dataset.id;
      chrome.runtime.sendMessage({ type: 'toggleExtension', extId: id, enable: true }, () => {
        chrome.storage.local.get(['cachedExtensions'], (data) => {
          extensionsData = data.cachedExtensions;
          displayExtensions(filterDropdown.value);
        });
      });
    });
  });

  disableSelectedBtn.addEventListener('click', () => {
    const selected = document.querySelectorAll('input[type="checkbox"]:checked');
    selected.forEach(checkbox => {
      const id = checkbox.dataset.id;
      chrome.runtime.sendMessage({ type: 'toggleExtension', extId: id, enable: false }, () => {
        chrome.storage.local.get(['cachedExtensions'], (data) => {
          extensionsData = data.cachedExtensions;
          displayExtensions(filterDropdown.value);
        });
      });
    });
  });

  removeSelectedBtn.addEventListener('click', () => {
    const selected = document.querySelectorAll('input[type="checkbox"]:checked');
    selected.forEach(checkbox => {
      const id = checkbox.dataset.id;
      chrome.runtime.sendMessage({ type: 'removeExtension', extId: id }, () => {
        chrome.storage.local.get(['cachedExtensions'], (data) => {
          extensionsData = data.cachedExtensions;
          displayExtensions(filterDropdown.value);
        });
      });
    });
  });

  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const tabId = tab.dataset.tab;
      if (tabId === 'adblocker') {
        extensionsContainer.innerHTML = '<div class="adblocker-container"><button id="toggleAdblock">Toggle Adblock</button></div>';
        document.getElementById('toggleAdblock').addEventListener('click', () => {
          chrome.runtime.sendMessage({ type: 'switchAdblock', activate: !adblockActive }, (response) => {
            adblockActive = response.active;
          });
        });
      } else if (tabId === 'bypass') {
        extensionsContainer.innerHTML = '<div class="bypass-container"><button id="bypassBtn">Bypass Methods</button></div>';
        document.getElementById('bypassBtn').addEventListener('click', () => {
          chrome.tabs.create({ url: chrome.runtime.getURL('unblockways.html') });
        });
      } else {
        displayExtensions(filterDropdown.value);
      }
    });
  });

  initializePopup();
});