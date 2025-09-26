// Jest setup file for Obsidian plugin testing
// Mock Obsidian API for testing

// Mock the global Obsidian API
global.window = global.window || {};
global.document = global.document || {};

// Mock Obsidian App and Plugin classes
class MockApp {
	vault = {
		adapter: {
			list: jest.fn(),
			read: jest.fn(),
			exists: jest.fn(),
			stat: jest.fn()
		},
		getAllLoadedFiles: jest.fn(() => []),
		getAbstractFileByPath: jest.fn(),
		on: jest.fn(),
		off: jest.fn()
	};

	workspace = {
		on: jest.fn(),
		off: jest.fn(),
		getLeaf: jest.fn(),
		createLeafBySplit: jest.fn(),
		detachLeavesOfType: jest.fn(),
		getLeavesOfType: jest.fn(() => []),
		revealLeaf: jest.fn(),
		getRightLeaf: jest.fn(),
		onLayoutReady: jest.fn((callback) => callback())
	};

	metadataCache = {
		on: jest.fn(),
		off: jest.fn(),
		getFileCache: jest.fn()
	};
}

class MockPlugin {
	app: MockApp;
	manifest = {
		id: 'test-plugin',
		name: 'Test Plugin',
		version: '1.0.0'
	};

	constructor(app: MockApp, manifest: any) {
		this.app = app;
		this.manifest = manifest;
	}

	loadData = jest.fn();
	saveData = jest.fn();
	addCommand = jest.fn();
	addRibbonIcon = jest.fn();
	addStatusBarItem = jest.fn();
	registerView = jest.fn();
	registerDomEvent = jest.fn();
}

// Mock IndexedDB for testing
const FDBFactory = require('fake-indexeddb/lib/FDBFactory');
global.indexedDB = new FDBFactory();

// Export mocks for use in tests
export { MockApp, MockPlugin };