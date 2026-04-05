// Mock chrome APIs globally so utils.js can be imported without errors
globalThis.chrome = {
  storage: {
    session: {
      get: async () => ({}),
      set: async () => {},
    },
    sync: {
      get: async () => ({}),
      set: async () => {},
    },
    local: {
      get: async () => ({}),
      set: async () => {},
    },
    onChanged: {
      addListener: () => {},
    },
  },
  runtime: {
    sendMessage: async () => {},
    getURL: (path) => `chrome-extension://fake-id/${path}`,
    getManifest: () => ({ version: '1.0.0' }),
    lastError: null,
  },
  notifications: {
    create: () => {},
    onButtonClicked: { addListener: () => {} },
    onClicked: { addListener: () => {} },
  },
  action: {
    setBadgeText: () => {},
    setBadgeBackgroundColor: () => {},
  },
  tabs: {
    create: () => {},
    get: () => {},
    update: () => {},
    query: () => {},
    remove: () => {},
  },
  alarms: {
    create: () => {},
    getAll: async () => [],
    onAlarm: { addListener: () => {} },
  },
  offscreen: {
    hasDocument: async () => false,
    createDocument: async () => {},
  },
  declarativeNetRequest: {
    getDynamicRules: async () => [],
    updateDynamicRules: async () => {},
  },
  windows: {
    getCurrent: () => {},
    update: () => {},
  },
}

// Mock navigator.userAgent
if (!globalThis.navigator) {
  globalThis.navigator = { userAgent: 'test' }
}

// Mock crypto.randomUUID
if (!globalThis.crypto?.randomUUID) {
  globalThis.crypto = {
    ...globalThis.crypto,
    randomUUID: () => 'test-uuid-1234',
  }
}
