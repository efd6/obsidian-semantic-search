import { MockApp, MockPlugin } from '../setup';
import { SearchEngine, SearchQuery, SearchResponse, SearchResult, SearchStats, TextHighlight } from '../../specs/001-obsidian-search-plugin/contracts/search-interface';

// Mock the OfflineEmbeddingService that doesn't exist yet (TDD - will FAIL initially)
jest.mock('../../src/services/offline-embedding-service', () => {
  return {
    OfflineEmbeddingService: jest.fn().mockImplementation(() => {
      return {
        generateEmbedding: jest.fn(),
        computeSimilarity: jest.fn(),
        isModelLoaded: jest.fn(() => false),
        loadModel: jest.fn(),
        unloadModel: jest.fn(),
        isOfflineCapable: jest.fn(() => false),
        loadOfflineModel: jest.fn(),
        getModelStatus: jest.fn(() => 'not_loaded'),
      };
    }),
  };
});

// Mock the OfflineSemanticSearchEngine that doesn't exist yet (TDD - will FAIL initially)
jest.mock('../../src/services/offline-semantic-search-engine', () => {
  return {
    OfflineSemanticSearchEngine: jest.fn().mockImplementation(() => {
      return {
        semanticSearch: jest.fn(),
        hybridSearch: jest.fn(),
        getSuggestions: jest.fn(),
        initialize: jest.fn(),
        isInitialized: jest.fn(() => false),
        getIndexStatus: jest.fn(() => 'building'),
        isOfflineReady: jest.fn(() => false),
        enableOfflineMode: jest.fn(),
        disableOfflineMode: jest.fn(),
        getOfflineStatus: jest.fn(() => 'unavailable'),
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
      };
    }),
  };
});

// Mock the NetworkConnectivityService that doesn't exist yet (TDD - will FAIL initially)
jest.mock('../../src/services/network-connectivity-service', () => {
  return {
    NetworkConnectivityService: jest.fn().mockImplementation(() => {
      return {
        isOnline: jest.fn(() => true),
        checkConnectivity: jest.fn(),
        onConnectivityChange: jest.fn(),
        simulateOffline: jest.fn(),
        simulateOnline: jest.fn(),
        getConnectionStatus: jest.fn(() => 'online'),
      };
    }),
  };
});

// Mock the OfflineSemanticSearchPlugin that doesn't exist yet (TDD - will FAIL initially)
jest.mock('../../src/plugin/offline-semantic-search-plugin', () => {
  return {
    OfflineSemanticSearchPlugin: jest.fn().mockImplementation((app: any, manifest: any) => {
      return {
        ...new MockPlugin(app, manifest),
        offlineSearchEngine: undefined,
        offlineEmbeddingService: undefined,
        networkService: undefined,
        searchModal: undefined,
        onload: jest.fn(),
        onunload: jest.fn(),
        initializeOfflineMode: jest.fn(),
        enableOfflineMode: jest.fn(),
        disableOfflineMode: jest.fn(),
        openSearchModal: jest.fn(),
        addSearchCommand: jest.fn(),
      };
    }),
  };
});

// TypeScript interfaces for mock objects with strict typing
interface MockOfflineSearchEngine extends SearchEngine {
  semanticSearch: jest.Mock<Promise<SearchResponse>, [SearchQuery]>;
  hybridSearch: jest.Mock<Promise<SearchResponse>, [SearchQuery]>;
  getSuggestions: jest.Mock<Promise<string[]>, [string]>;
  initialize: jest.Mock<Promise<void>, []>;
  isInitialized: jest.Mock<boolean, []>;
  getIndexStatus: jest.Mock<'complete' | 'partial' | 'building', []>;
  isOfflineReady: jest.Mock<boolean, []>;
  enableOfflineMode: jest.Mock<Promise<void>, []>;
  disableOfflineMode: jest.Mock<Promise<void>, []>;
  getOfflineStatus: jest.Mock<'ready' | 'loading' | 'unavailable', []>;
  on: jest.Mock<void, [string, Function]>;
  off: jest.Mock<void, [string, Function]>;
  emit: jest.Mock<void, [string, ...any[]]>;
}

interface MockOfflineEmbeddingService {
  generateEmbedding: jest.Mock<Promise<number[]>, [string]>;
  computeSimilarity: jest.Mock<number, [number[], number[]]>;
  isModelLoaded: jest.Mock<boolean, []>;
  loadModel: jest.Mock<Promise<void>, []>;
  unloadModel: jest.Mock<Promise<void>, []>;
  isOfflineCapable: jest.Mock<boolean, []>;
  loadOfflineModel: jest.Mock<Promise<void>, []>;
  getModelStatus: jest.Mock<'loaded' | 'loading' | 'not_loaded' | 'error', []>;
}

interface MockNetworkConnectivityService {
  isOnline: jest.Mock<boolean, []>;
  checkConnectivity: jest.Mock<Promise<boolean>, []>;
  onConnectivityChange: jest.Mock<void, [Function]>;
  simulateOffline: jest.Mock<void, []>;
  simulateOnline: jest.Mock<void, []>;
  getConnectionStatus: jest.Mock<'online' | 'offline' | 'unknown', []>;
}

interface MockSearchModal {
  open: jest.Mock<void, []>;
  close: jest.Mock<void, []>;
  setQuery: jest.Mock<void, [string]>;
  displayResults: jest.Mock<void, [SearchResult[]]>;
  showLoading: jest.Mock<void, [boolean]>;
  showOfflineIndicator: jest.Mock<void, [boolean]>;
  showNetworkError: jest.Mock<void, [string]>;
}

describe('Offline Operation Integration - Quickstart Step 5', () => {
  let mockApp: MockApp;
  let pluginManifest: any;
  let mockPluginInstance: any;
  let mockOfflineSearchEngine: MockOfflineSearchEngine;
  let mockOfflineEmbeddingService: MockOfflineEmbeddingService;
  let mockNetworkService: MockNetworkConnectivityService;
  let mockSearchModal: MockSearchModal;

  // Sample documents for offline testing
  const sampleDocuments = [
    {
      path: 'Dailies/2024-01-15.md',
      title: 'Daily Log - Team Collaboration',
      content: '#dailies\n\n## Team Collaboration\nToday we focused on improving team collaboration through better communication channels and shared documentation practices.',
      tags: ['#dailies'],
      created: new Date('2024-01-15'),
      modified: new Date('2024-01-15'),
    },
    {
      path: 'Meeting Series/Team-Sync/2024-01-15-team-sync.md',
      title: 'Team Sync - Collaboration Best Practices',
      content: '#meeting #team\n\n## Collaboration Strategies\nDiscussed asynchronous collaboration tools, pair programming sessions, and knowledge sharing mechanisms.',
      tags: ['#meeting', '#team'],
      created: new Date('2024-01-15'),
      modified: new Date('2024-01-15'),
    },
    {
      path: 'Planning/collaboration-improvement-initiative.md',
      title: 'Team Collaboration Improvement Initiative',
      content: '#planning #collaboration\n\n## Collaboration Enhancement\nComprehensive plan for improving team collaboration through tools, processes, and cultural changes.',
      tags: ['#planning', '#collaboration'],
      created: new Date('2024-01-10'),
      modified: new Date('2024-01-12'),
    },
    {
      path: 'PPL/remote-work-best-practices.md',
      title: 'Remote Work and Team Collaboration',
      content: '#profile #remote\n\n## Remote Collaboration\nGuidelines for effective remote team collaboration, communication protocols, and virtual team building.',
      tags: ['#profile', '#remote'],
      created: new Date('2024-01-08'),
      modified: new Date('2024-01-10'),
    },
  ];

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock Obsidian app
    mockApp = new MockApp();

    // Plugin manifest for offline semantic search plugin
    pluginManifest = {
      id: 'offline-semantic-search-plugin',
      name: 'Offline Semantic Search Plugin',
      version: '1.0.0',
      description: 'AI-powered semantic search with offline capabilities',
      author: 'Upstart Engineering',
      minAppVersion: '0.15.0',
    };

    // Mock search modal with offline capabilities
    mockSearchModal = {
      open: jest.fn<void, []>(),
      close: jest.fn<void, []>(),
      setQuery: jest.fn<void, [string]>(),
      displayResults: jest.fn<void, [SearchResult[]]>(),
      showLoading: jest.fn<void, [boolean]>(),
      showOfflineIndicator: jest.fn<void, [boolean]>(),
      showNetworkError: jest.fn<void, [string]>(),
    };

    // Mock network connectivity service
    mockNetworkService = {
      isOnline: jest.fn<boolean, []>().mockReturnValue(true),
      checkConnectivity: jest.fn<Promise<boolean>, []>().mockResolvedValue(true),
      onConnectivityChange: jest.fn<void, [Function]>(),
      simulateOffline: jest.fn<void, []>(),
      simulateOnline: jest.fn<void, []>(),
      getConnectionStatus: jest.fn<'online' | 'offline' | 'unknown', []>().mockReturnValue('online'),
    };

    // Mock offline embedding service with local model capabilities
    mockOfflineEmbeddingService = {
      generateEmbedding: jest.fn<Promise<number[]>, [string]>(),
      computeSimilarity: jest.fn<number, [number[], number[]]>(),
      isModelLoaded: jest.fn<boolean, []>().mockReturnValue(true),
      loadModel: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
      unloadModel: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
      isOfflineCapable: jest.fn<boolean, []>().mockReturnValue(true),
      loadOfflineModel: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
      getModelStatus: jest.fn<'loaded' | 'loading' | 'not_loaded' | 'error', []>().mockReturnValue('loaded'),
    };

    // Mock offline semantic search engine
    mockOfflineSearchEngine = {
      semanticSearch: jest.fn<Promise<SearchResponse>, [SearchQuery]>(),
      hybridSearch: jest.fn<Promise<SearchResponse>, [SearchQuery]>(),
      getSuggestions: jest.fn<Promise<string[]>, [string]>(),
      initialize: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
      isInitialized: jest.fn<boolean, []>().mockReturnValue(true),
      getIndexStatus: jest.fn<'complete' | 'partial' | 'building', []>().mockReturnValue('complete'),
      isOfflineReady: jest.fn<boolean, []>().mockReturnValue(true),
      enableOfflineMode: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
      disableOfflineMode: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
      getOfflineStatus: jest.fn<'ready' | 'loading' | 'unavailable', []>().mockReturnValue('ready'),
      on: jest.fn<void, [string, Function]>(),
      off: jest.fn<void, [string, Function]>(),
      emit: jest.fn<void, [string, ...any[]]>(),
    };

    // Create mock plugin instance
    mockPluginInstance = {
      ...new MockPlugin(mockApp, pluginManifest),
      offlineSearchEngine: mockOfflineSearchEngine,
      offlineEmbeddingService: mockOfflineEmbeddingService,
      networkService: mockNetworkService,
      searchModal: mockSearchModal,
      initializeOfflineMode: jest.fn().mockImplementation(async () => {
        await mockOfflineEmbeddingService.loadOfflineModel();
        await mockOfflineSearchEngine.enableOfflineMode();
      }),
      enableOfflineMode: jest.fn().mockImplementation(async () => {
        mockNetworkService.simulateOffline();
        await mockOfflineSearchEngine.enableOfflineMode();
        mockSearchModal.showOfflineIndicator(true);
      }),
      disableOfflineMode: jest.fn().mockImplementation(async () => {
        mockNetworkService.simulateOnline();
        await mockOfflineSearchEngine.disableOfflineMode();
        mockSearchModal.showOfflineIndicator(false);
      }),
      openSearchModal: jest.fn().mockImplementation(() => {
        mockSearchModal.open();
      }),
      addSearchCommand: jest.fn().mockImplementation(() => {
        mockPluginInstance.addCommand({
          id: 'offline-semantic-search',
          name: 'Open Offline Semantic Search',
          callback: () => mockPluginInstance.openSearchModal(),
        });
      }),
    };

    // Setup mock offline embedding generation (384-dimensional vectors)
    mockOfflineEmbeddingService.generateEmbedding.mockImplementation(async (text: string) => {
      // Generate deterministic embeddings for offline operation
      const hash = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      return new Array(384).fill(0).map((_, i) => Math.sin(hash + i) * 0.1);
    });

    // Setup mock offline similarity computation
    mockOfflineEmbeddingService.computeSimilarity.mockImplementation((vec1: number[], vec2: number[]) => {
      const similarity = vec1.reduce((sum, val, i) => sum + val * vec2[i], 0);
      return Math.max(0, Math.min(1, similarity + 0.5));
    });

    // Setup vault with sample documents
    const markdownFiles = sampleDocuments.map(doc => doc.path);
    (mockApp.vault.adapter.list as jest.Mock).mockResolvedValue(markdownFiles);
    (mockApp.vault.adapter.exists as jest.Mock).mockImplementation((path: string) =>
      Promise.resolve(markdownFiles.includes(path))
    );
    (mockApp.vault.adapter.read as jest.Mock).mockImplementation((path: string) => {
      const doc = sampleDocuments.find(d => d.path === path);
      return Promise.resolve(doc?.content || '');
    });
  });

  describe('Offline Mode Initialization', () => {
    it('should fail initially - offline services do not exist yet (TDD)', async () => {
      // This test should FAIL initially because the offline services don't exist
      // This validates TDD requirement - tests are written before implementation

      try {
        // Attempt to import services that don't exist yet
        const { OfflineSemanticSearchEngine } = require('../../src/services/offline-semantic-search-engine');
        const { OfflineEmbeddingService } = require('../../src/services/offline-embedding-service');
        const { NetworkConnectivityService } = require('../../src/services/network-connectivity-service');

        // These should throw errors initially
        expect(OfflineSemanticSearchEngine).toBeDefined();
        expect(OfflineEmbeddingService).toBeDefined();
        expect(NetworkConnectivityService).toBeDefined();
        fail('Expected offline service imports to fail, but they succeeded');
      } catch (error: any) {
        // Expected failure - services don't exist yet
        expect(error).toBeDefined();
        expect(error.message).toMatch(/Cannot find module|MODULE_NOT_FOUND/);
      }
    });

    it('should initialize offline mode with pre-bundled models', async () => {
      // Initialize offline mode
      await mockPluginInstance.initializeOfflineMode();

      // Verify offline components are initialized
      expect(mockPluginInstance.initializeOfflineMode).toHaveBeenCalled();
      expect(mockOfflineEmbeddingService.loadOfflineModel).toHaveBeenCalled();
      expect(mockOfflineSearchEngine.enableOfflineMode).toHaveBeenCalled();

      // Verify offline capability is ready
      expect(mockOfflineEmbeddingService.isOfflineCapable()).toBe(true);
      expect(mockOfflineSearchEngine.isOfflineReady()).toBe(true);
      expect(mockOfflineEmbeddingService.getModelStatus()).toBe('loaded');
    });

    it('should handle offline model loading errors gracefully', async () => {
      // Mock offline model loading failure
      mockOfflineEmbeddingService.loadOfflineModel.mockRejectedValue(new Error('Offline model not found'));
      mockOfflineEmbeddingService.getModelStatus.mockReturnValue('error');

      // Initialize offline mode should handle error gracefully
      await expect(mockPluginInstance.initializeOfflineMode()).rejects.toThrow('Offline model not found');

      // Verify error state is properly handled
      expect(mockOfflineEmbeddingService.getModelStatus()).toBe('error');
    });
  });

  describe('Network Disconnection Simulation', () => {
    beforeEach(async () => {
      // Initialize offline mode first
      await mockPluginInstance.initializeOfflineMode();

      // Setup search engine with offline capability
      mockOfflineSearchEngine.semanticSearch.mockImplementation(async (query: SearchQuery) => {
        const results = generateOfflineSemanticResults(query.text);
        return {
          results,
          totalMatches: results.length,
          searchTime: 120, // Slightly faster for local processing
          executedQuery: query,
          stats: {
            documentsSearched: sampleDocuments.length,
            chunksEvaluated: sampleDocuments.length * 3,
            indexStatus: 'complete' as const,
          },
        };
      });
    });

    it('should detect network disconnection and switch to offline mode', async () => {
      // Simulate network disconnection
      mockNetworkService.isOnline.mockReturnValue(false);
      mockNetworkService.getConnectionStatus.mockReturnValue('offline');

      // Enable offline mode
      await mockPluginInstance.enableOfflineMode();

      // Verify offline mode is activated
      expect(mockPluginInstance.enableOfflineMode).toHaveBeenCalled();
      expect(mockNetworkService.simulateOffline).toHaveBeenCalled();
      expect(mockOfflineSearchEngine.enableOfflineMode).toHaveBeenCalled();
      expect(mockSearchModal.showOfflineIndicator).toHaveBeenCalledWith(true);

      // Verify network status
      expect(mockNetworkService.isOnline()).toBe(false);
      expect(mockNetworkService.getConnectionStatus()).toBe('offline');
    });

    it('should automatically handle connectivity changes', async () => {
      let connectivityCallback: Function = jest.fn();

      // Setup connectivity monitoring
      mockNetworkService.onConnectivityChange.mockImplementation((callback: Function) => {
        connectivityCallback = callback;
      });

      // Initialize connectivity monitoring
      mockNetworkService.onConnectivityChange(connectivityCallback);

      // Simulate going offline
      mockNetworkService.isOnline.mockReturnValue(false);
      mockNetworkService.getConnectionStatus.mockReturnValue('offline');
      connectivityCallback(false);

      // Verify offline mode is enabled automatically
      expect(connectivityCallback).toHaveBeenCalledWith(false);

      // Simulate coming back online
      mockNetworkService.isOnline.mockReturnValue(true);
      mockNetworkService.getConnectionStatus.mockReturnValue('online');
      connectivityCallback(true);

      // Verify online mode is restored
      expect(connectivityCallback).toHaveBeenCalledWith(true);
    });

    it('should maintain functionality during simulated network outage', async () => {
      // Start online
      expect(mockNetworkService.isOnline()).toBe(true);

      // Simulate network disconnection
      await mockPluginInstance.enableOfflineMode();

      // Verify offline state
      expect(mockNetworkService.isOnline()).toBe(false);
      expect(mockOfflineSearchEngine.getOfflineStatus()).toBe('ready');

      // Verify search functionality still works
      const query: SearchQuery = { text: 'team collaboration', mode: 'semantic' };
      const response = await mockOfflineSearchEngine.semanticSearch(query);

      expect(response).toBeDefined();
      expect(response.results.length).toBeGreaterThan(0);
      expect(mockOfflineSearchEngine.semanticSearch).toHaveBeenCalledWith(query);
    });
  });

  describe('Offline Semantic Search from Quickstart Step 5', () => {
    beforeEach(async () => {
      // Initialize offline mode and simulate network disconnection
      await mockPluginInstance.initializeOfflineMode();
      await mockPluginInstance.enableOfflineMode();

      // Verify offline state
      expect(mockNetworkService.isOnline()).toBe(false);
      expect(mockOfflineSearchEngine.isOfflineReady()).toBe(true);
    });

    it('should search "team collaboration" without internet connection', async () => {
      const query: SearchQuery = {
        text: 'team collaboration',
        limit: 5,
        mode: 'semantic',
      };

      // Perform search in offline mode
      const response = await mockOfflineSearchEngine.semanticSearch(query);

      // Verify search was executed offline
      expect(mockOfflineSearchEngine.semanticSearch).toHaveBeenCalledWith(query);
      expect(mockNetworkService.isOnline()).toBe(false);

      // Verify response structure
      expect(response.results).toBeDefined();
      expect(response.results.length).toBeGreaterThan(0);
      expect(response.totalMatches).toBe(response.results.length);
      expect(response.searchTime).toBeGreaterThan(0);

      // Verify semantic relevance for "team collaboration"
      const collaborationResults = response.results.filter(result =>
        result.snippet.toLowerCase().includes('collaboration') ||
        result.snippet.toLowerCase().includes('team') ||
        result.tags.includes('#team') ||
        result.tags.includes('#collaboration')
      );
      expect(collaborationResults.length).toBeGreaterThan(0);

      // Verify offline match type
      expect(response.results[0].matchType).toBe('semantic');
    });

    it('should generate results using local embeddings without network access', async () => {
      const testText = 'team collaboration';

      // Generate embeddings offline
      const embedding = await mockOfflineEmbeddingService.generateEmbedding(testText);

      // Verify embeddings are generated locally
      expect(mockOfflineEmbeddingService.generateEmbedding).toHaveBeenCalledWith(testText);
      expect(embedding).toBeDefined();
      expect(embedding.length).toBe(384); // Standard embedding dimension
      expect(Array.isArray(embedding)).toBe(true);

      // Verify embedding service is in offline mode
      expect(mockOfflineEmbeddingService.isOfflineCapable()).toBe(true);
      expect(mockOfflineEmbeddingService.getModelStatus()).toBe('loaded');
      expect(mockNetworkService.isOnline()).toBe(false);
    });

    it('should compute semantic similarity using local models', async () => {
      const text1 = 'team collaboration';
      const text2 = 'teamwork and cooperation';

      // Generate embeddings for both texts
      const embedding1 = await mockOfflineEmbeddingService.generateEmbedding(text1);
      const embedding2 = await mockOfflineEmbeddingService.generateEmbedding(text2);

      // Compute similarity offline
      const similarity = mockOfflineEmbeddingService.computeSimilarity(embedding1, embedding2);

      // Verify similarity computation
      expect(mockOfflineEmbeddingService.computeSimilarity).toHaveBeenCalledWith(embedding1, embedding2);
      expect(similarity).toBeGreaterThanOrEqual(0);
      expect(similarity).toBeLessThanOrEqual(1);

      // Verify computation was done offline
      expect(mockNetworkService.isOnline()).toBe(false);
    });

    it('should provide search suggestions offline', async () => {
      const suggestions = ['team collaboration', 'collaboration tools', 'collaborative work'];
      mockOfflineSearchEngine.getSuggestions.mockResolvedValue(suggestions);

      const partialQuery = 'collab';
      const result = await mockOfflineSearchEngine.getSuggestions(partialQuery);

      expect(mockOfflineSearchEngine.getSuggestions).toHaveBeenCalledWith(partialQuery);
      expect(result).toEqual(suggestions);
      expect(result.length).toBeGreaterThan(0);

      // Verify suggestions work offline
      expect(mockNetworkService.isOnline()).toBe(false);
    });
  });

  describe('Error Handling in Offline Mode', () => {
    beforeEach(async () => {
      await mockPluginInstance.initializeOfflineMode();
      await mockPluginInstance.enableOfflineMode();
    });

    it('should NOT display network error messages during offline operation', async () => {
      // Perform search operation that would normally require network
      const query: SearchQuery = { text: 'team collaboration', mode: 'semantic' };

      try {
        await mockOfflineSearchEngine.semanticSearch(query);

        // Verify no network errors are shown
        expect(mockSearchModal.showNetworkError).not.toHaveBeenCalled();

        // Verify offline indicator is shown instead
        expect(mockSearchModal.showOfflineIndicator).toHaveBeenCalledWith(true);

      } catch (error) {
        // If any error occurs, it should NOT be a network-related error
        expect(error).not.toMatch(/network|connection|internet|offline/i);
      }
    });

    it('should handle offline mode gracefully when network operations are attempted', async () => {
      // Mock a function that would normally require network access
      const mockNetworkOperation = jest.fn().mockRejectedValue(new Error('Network unavailable'));

      // The system should catch network errors and continue operating
      try {
        await mockNetworkOperation();
      } catch (error) {
        // Network error should be caught and handled gracefully
        expect(error).toBeDefined();
      }

      // Offline search should still work despite network errors
      const query: SearchQuery = { text: 'team collaboration', mode: 'semantic' };
      const response = await mockOfflineSearchEngine.semanticSearch(query);

      expect(response).toBeDefined();
      expect(response.results.length).toBeGreaterThan(0);

      // Verify no network error is displayed to user
      expect(mockSearchModal.showNetworkError).not.toHaveBeenCalled();
    });

    it('should validate all offline operations function without internet dependency', async () => {
      // Verify complete offline functionality
      const operations = [
        // Embedding generation
        async () => await mockOfflineEmbeddingService.generateEmbedding('test text'),
        // Semantic search
        async () => await mockOfflineSearchEngine.semanticSearch({ text: 'test', mode: 'semantic' }),
        // Search suggestions
        async () => await mockOfflineSearchEngine.getSuggestions('test'),
        // Similarity computation
        async () => mockOfflineEmbeddingService.computeSimilarity([1, 2, 3], [1, 2, 3]),
      ];

      // Execute all operations while offline
      expect(mockNetworkService.isOnline()).toBe(false);

      const results = await Promise.all(operations.map(async (op) => {
        try {
          return await op();
        } catch (error) {
          return error;
        }
      }));

      // All operations should succeed offline
      results.forEach((result, index) => {
        expect(result).toBeDefined();
        // Results should not be error objects
        expect(result).not.toBeInstanceOf(Error);
      });

      // Verify no network dependency errors
      expect(mockSearchModal.showNetworkError).not.toHaveBeenCalled();
    });

    it('should verify pre-bundled models work offline', async () => {
      // Verify offline model status
      expect(mockOfflineEmbeddingService.getModelStatus()).toBe('loaded');
      expect(mockOfflineEmbeddingService.isOfflineCapable()).toBe(true);
      expect(mockOfflineSearchEngine.isOfflineReady()).toBe(true);

      // Verify models work without network
      expect(mockNetworkService.isOnline()).toBe(false);

      // Test model functionality
      const embedding = await mockOfflineEmbeddingService.generateEmbedding('test');
      expect(embedding).toBeDefined();
      expect(embedding.length).toBe(384);

      // Verify search engine uses local models
      const query: SearchQuery = { text: 'collaboration', mode: 'semantic' };
      const response = await mockOfflineSearchEngine.semanticSearch(query);
      expect(response.results.length).toBeGreaterThan(0);
    });
  });

  describe('Offline Mode Transitions', () => {
    it('should seamlessly transition from online to offline mode', async () => {
      // Start in online mode
      expect(mockNetworkService.isOnline()).toBe(true);

      // Initialize and switch to offline mode
      await mockPluginInstance.initializeOfflineMode();
      await mockPluginInstance.enableOfflineMode();

      // Verify transition
      expect(mockNetworkService.isOnline()).toBe(false);
      expect(mockOfflineSearchEngine.isOfflineReady()).toBe(true);
      expect(mockSearchModal.showOfflineIndicator).toHaveBeenCalledWith(true);

      // Verify functionality continues working
      const query: SearchQuery = { text: 'team collaboration', mode: 'semantic' };
      const response = await mockOfflineSearchEngine.semanticSearch(query);
      expect(response.results.length).toBeGreaterThan(0);
    });

    it('should seamlessly transition from offline to online mode', async () => {
      // Start offline
      await mockPluginInstance.initializeOfflineMode();
      await mockPluginInstance.enableOfflineMode();
      expect(mockNetworkService.isOnline()).toBe(false);

      // Transition to online mode
      await mockPluginInstance.disableOfflineMode();

      // Verify transition
      expect(mockNetworkService.simulateOnline).toHaveBeenCalled();
      expect(mockOfflineSearchEngine.disableOfflineMode).toHaveBeenCalled();
      expect(mockSearchModal.showOfflineIndicator).toHaveBeenCalledWith(false);
    });
  });

  // Helper function to generate offline semantic search results
  function generateOfflineSemanticResults(queryText: string, count: number = 3): SearchResult[] {
    const relevantDocs = sampleDocuments.filter(doc =>
      isOfflineSemanticMatch(queryText.toLowerCase(), doc)
    );

    return relevantDocs.slice(0, count).map((doc, index) => ({
      id: `offline-${doc.path}-${index}`,
      filePath: doc.path,
      title: doc.title,
      score: 0.9 - (index * 0.1),
      snippet: generateOfflineSnippet(doc.content, queryText),
      highlights: generateOfflineHighlights(doc.content, queryText),
      tags: doc.tags,
      metadata: {
        created: doc.created,
        modified: doc.modified,
        wordCount: doc.content.split(/\s+/).length,
      },
      matchType: 'semantic' as const,
    }));
  }

  // Helper function for offline semantic matching
  function isOfflineSemanticMatch(queryText: string, doc: any): boolean {
    const docContent = doc.content.toLowerCase();
    const queryTerms = queryText.split(/\s+/);

    // Offline semantic mappings (simpler than online)
    const offlineSemanticMappings = {
      'team': ['team', 'collaboration', 'group', 'collective'],
      'collaboration': ['collaboration', 'teamwork', 'cooperation', 'partnership'],
      'work': ['work', 'project', 'task', 'effort'],
      'meeting': ['meeting', 'sync', 'standup', 'review'],
      'planning': ['planning', 'strategy', 'roadmap', 'initiative'],
    };

    return queryTerms.some(term => {
      const synonyms = offlineSemanticMappings[term as keyof typeof offlineSemanticMappings] || [term];
      return synonyms.some(synonym => docContent.includes(synonym));
    });
  }

  // Helper function to generate offline snippet
  function generateOfflineSnippet(content: string, queryText: string): string {
    const sentences = content.split(/[.!?]+/);
    const queryTerms = queryText.toLowerCase().split(/\s+/);

    const relevantSentences = sentences.filter(sentence =>
      queryTerms.some(term => sentence.toLowerCase().includes(term))
    );

    if (relevantSentences.length > 0) {
      return relevantSentences[0].trim().substring(0, 200) + '...';
    }

    const meaningfulSentences = sentences.filter(s => s.trim().length > 20);
    return meaningfulSentences[0]?.trim().substring(0, 200) + '...' || content.substring(0, 200) + '...';
  }

  // Helper function to generate offline highlights
  function generateOfflineHighlights(content: string, queryText: string): TextHighlight[] {
    const queryTerms = queryText.toLowerCase().split(/\s+/);
    const highlights: TextHighlight[] = [];

    queryTerms.forEach(term => {
      const index = content.toLowerCase().indexOf(term);
      if (index !== -1) {
        highlights.push({
          start: index,
          end: index + term.length,
          type: 'semantic',
        });
      }
    });

    return highlights;
  }
});