// Obsidian API Mocks
// Provides mock implementations of Obsidian's Plugin and Vault APIs

class MockWorkspaceLeaf {
    constructor() {
        this.view = null;
    }
}

class MockWorkspace {
    constructor() {
        this.leftSplit = null;
        this.rightSplit = null;
        this.activeLeaf = new MockWorkspaceLeaf();
        this.rootSplit = null;
        this.layoutReady = false;
        this.layoutReadyCallbacks = [];
    }

    getActiveViewOfType(type) {
        return null;
    }

    getLeaf(newLeaf = false) {
        return {
            view: null,
            setViewState: jest.fn().mockImplementation(async (viewState) => {
                // Mock implementation
                return Promise.resolve();
            })
        };
    }

    getRightLeaf(newLeaf = false) {
        // Simulate the runtime scenario where getRightLeaf might return null
        if (process.env.TEST_LAYOUT_FAILURE === 'true') {
            return null;
        }

        // Return a leaf mock with setViewState
        return {
            view: null,
            setViewState: jest.fn().mockImplementation(async (viewState) => {
                // Mock implementation
                return Promise.resolve();
            })
        };
    }

    onLayoutReady(callback) {
        if (this.layoutReady) {
            // If layout is already ready, call immediately
            setTimeout(callback, 0);
        } else {
            // Store callback for later execution
            this.layoutReadyCallbacks.push(callback);
        }
    }

    // Test helper method to trigger layout ready
    triggerLayoutReady() {
        this.layoutReady = true;
        this.layoutReadyCallbacks.forEach(callback => {
            try {
                callback();
            } catch (error) {
                console.warn('Layout ready callback error:', error);
            }
        });
        this.layoutReadyCallbacks = [];
    }

    on(event, callback) {
        return { unsubscribe: jest.fn() };
    }

    off(event, callback) {
        // Mock implementation
    }

    trigger(event, ...args) {
        // Mock implementation
    }

    detachLeavesOfType(viewType) {
        // Mock implementation for view cleanup
        return [];
    }

    getLeavesOfType(viewType) {
        // Mock implementation - return empty array by default
        return [];
    }

    revealLeaf(leaf) {
        // Mock implementation for revealing existing leaf
    }
}

class MockVault {
    constructor() {
        this.files = new Map();
        this.folders = new Set();
        this.eventHandlers = new Map(); // Store event handlers by event type
    }

    // File operations
    async read(file) {
        if (typeof file === 'string') {
            return this.files.get(file) || '';
        }
        return this.files.get(file.path) || '';
    }

    async write(path, content) {
        this.files.set(path, content);
    }

    async delete(file) {
        const path = typeof file === 'string' ? file : file.path;
        this.files.delete(path);
    }

    // File discovery
    getFiles() {
        return Array.from(this.files.keys()).map(path => ({
            path,
            name: path.split('/').pop(),
            extension: path.split('.').pop()
        }));
    }

    getMarkdownFiles() {
        return this.getFiles().filter(file => file.extension === 'md');
    }

    getAbstractFileByPath(path) {
        if (this.files.has(path)) {
            const mockFile = new MockTFile(path);
            mockFile.stat.size = this.files.get(path).length;
            return mockFile;
        }
        return null;
    }

    // File watching
    on(event, callback) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event).push(callback);
        return { unsubscribe: jest.fn() };
    }

    off(event, callback) {
        if (this.eventHandlers.has(event)) {
            const handlers = this.eventHandlers.get(event);
            const index = handlers.indexOf(callback);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }

    trigger(event, file) {
        if (this.eventHandlers.has(event)) {
            const handlers = this.eventHandlers.get(event);
            handlers.forEach(handler => {
                try {
                    handler(file);
                } catch (error) {
                    console.warn('Mock event handler error:', error);
                }
            });
        }
    }

    // Helper methods for testing
    addFile(path, content = '') {
        this.files.set(path, content);
    }

    addFolder(path) {
        this.folders.add(path);
    }
}

class MockApp {
    constructor() {
        this.vault = new MockVault();
        this.workspace = new MockWorkspace();
        this.metadataCache = {
            getFileCache: jest.fn().mockReturnValue({}),
            on: jest.fn(),
            off: jest.fn()
        };

        // Mock vault adapter with getBasePath and getResourcePath methods for plugin directory resolution
        const basePathFn = () => {
            const testPath = process.env.TEST_VAULT_PATH;
            if (testPath) {
                // If TEST_VAULT_PATH is provided, use it (might be file:// URL or path)
                return testPath.startsWith('file://') ? testPath : testPath;
            }
            // Default to file:// URL format for URL constructor compatibility
            return 'file:///mock/vault/path';
        };
        this.vault.adapter = {
            getBasePath: basePathFn,
            getResourcePath: (relativePath) => {
                const basePath = basePathFn();
                // Handle both file:// URLs and filesystem paths
                if (basePath.startsWith('file://')) {
                    // Ensure base path has trailing slash for proper URL resolution
                    const baseWithSlash = basePath.endsWith('/') ? basePath : basePath + '/';
                    const url = new URL(relativePath, baseWithSlash);
                    return url.href;
                } else {
                    return `${basePath}/${relativePath}`;
                }
            },
            ...this.vault.adapter
        };
    }
}

class MockPlugin {
    constructor(app, manifest) {
        this.app = app || new MockApp();
        this.manifest = manifest || {
            id: 'test-plugin',
            name: 'Test Plugin',
            version: '1.0.0'
        };
        this.commands = [];
        this.settings = {};
    }

    // Plugin lifecycle
    async onload() {
        // Mock implementation
    }

    async onunload() {
        // Mock implementation
    }

    // Settings
    async loadData() {
        return this.settings;
    }

    async saveData(data) {
        this.settings = { ...this.settings, ...data };
    }

    // Commands
    addCommand(command) {
        this.commands.push(command);
        return command;
    }

    // View registration
    registerView(type, viewCreator) {
        // Mock implementation - store the view creator for later use
        this.viewCreators = this.viewCreators || {};
        this.viewCreators[type] = viewCreator;
    }

    // Ribbon
    addRibbonIcon(icon, title, callback) {
        return {
            remove: jest.fn()
        };
    }

    // Status bar
    addStatusBarItem() {
        return {
            setText: jest.fn(),
            addClass: jest.fn(),
            removeClass: jest.fn(),
            setAttr: jest.fn(),
            createEl: jest.fn().mockReturnValue({
                createEl: jest.fn().mockReturnThis(),
                setText: jest.fn().mockReturnThis(),
                addClass: jest.fn().mockReturnThis()
            }),
            addEventListener: jest.fn(),
            remove: jest.fn()
        };
    }

    // Settings tab
    addSettingTab(tab) {
        return tab;
    }
}

class MockNotice {
    constructor(message, timeout = 5000) {
        this.message = message;
        this.timeout = timeout;
        console.log(`[Notice] ${message}`);
    }

    hide() {
        // Mock implementation
    }
}

class MockComponent {
    constructor() {
        this._loaded = false;
        this._children = [];
    }

    load() {
        this._loaded = true;
        this.onload && this.onload();
    }

    unload() {
        this._loaded = false;
        this.onunload && this.onunload();
        this._children.forEach(child => child.unload());
        this._children = [];
    }

    addChild(child) {
        this._children.push(child);
        if (this._loaded) {
            child.load();
        }
        return child;
    }

    removeChild(child) {
        const index = this._children.indexOf(child);
        if (index >= 0) {
            this._children.splice(index, 1);
            child.unload();
        }
    }

    register(callback) {
        // Mock register functionality
        return callback;
    }

    registerEvent(eventRef) {
        // Mock registerEvent functionality - stores event reference for cleanup
        this._events = this._events || [];
        this._events.push(eventRef);
        return eventRef;
    }

    registerInterval(callback, interval) {
        const id = setInterval(callback, interval);
        this.register(() => clearInterval(id));
        return id;
    }
}

class MockTFile {
    constructor(path, name) {
        this.path = path;
        this.name = name || path.split('/').pop();
        this.extension = this.name.split('.').pop();
        this.stat = {
            ctime: Date.now(),
            mtime: Date.now(),
            size: 0
        };
    }
}

class MockPluginSettingTab {
    constructor(app, plugin) {
        this.app = app;
        this.plugin = plugin;
        this.containerEl = {
            createEl: jest.fn().mockReturnValue({
                createEl: jest.fn().mockReturnThis(),
                setText: jest.fn().mockReturnThis(),
                addClass: jest.fn().mockReturnThis()
            }),
            empty: jest.fn()
        };
    }

    display() {
        // Mock implementation
    }

    hide() {
        // Mock implementation
    }
}

class MockModal {
    constructor(app) {
        this.app = app;
        this.containerEl = {
            createEl: jest.fn().mockReturnValue({
                createEl: jest.fn().mockReturnThis(),
                setText: jest.fn().mockReturnThis(),
                addClass: jest.fn().mockReturnThis(),
                addEventListener: jest.fn(),
                focus: jest.fn()
            }),
            empty: jest.fn(),
            addClass: jest.fn()
        };
        this.contentEl = this.containerEl;
    }

    open() {
        // Mock implementation
    }

    close() {
        // Mock implementation
    }

    onOpen() {
        // Override in subclasses
    }

    onClose() {
        // Override in subclasses
    }
}

class MockItemView {
    constructor(leaf) {
        this.leaf = leaf;
        this.containerEl = {
            createEl: jest.fn().mockReturnValue({
                createEl: jest.fn().mockReturnThis(),
                setText: jest.fn().mockReturnThis(),
                addClass: jest.fn().mockReturnThis(),
                addEventListener: jest.fn(),
                focus: jest.fn()
            }),
            empty: jest.fn(),
            addClass: jest.fn()
        };
        this.contentEl = this.containerEl;
    }

    getViewType() {
        return 'mock-view';
    }

    getDisplayText() {
        return 'Mock View';
    }

    async onOpen() {
        // Override in subclasses
    }

    async onClose() {
        // Override in subclasses
    }

    load() {
        // Mock implementation
    }

    unload() {
        // Mock implementation
    }
}

// Utility functions
const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

// Export the mock classes
module.exports = {
    Plugin: MockPlugin,
    Component: MockComponent,
    PluginSettingTab: MockPluginSettingTab,
    Modal: MockModal,
    ItemView: MockItemView,
    TFile: MockTFile,
    App: MockApp,
    Vault: MockVault,
    Workspace: MockWorkspace,
    WorkspaceLeaf: MockWorkspaceLeaf,
    Notice: MockNotice,
    debounce: debounce,

    // Helper to create test app with sample data
    createTestApp: (sampleFiles = {}) => {
        const app = new MockApp();
        Object.entries(sampleFiles).forEach(([path, content]) => {
            app.vault.addFile(path, content);
        });
        return app;
    },

    // Helper to create test plugin
    createTestPlugin: (app, manifest) => {
        return new MockPlugin(app, manifest);
    }
};