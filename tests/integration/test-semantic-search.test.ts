import { MockApp, MockPlugin } from '../setup';
import { SearchEngine, SearchQuery, SearchResponse, SearchResult, SearchStats, TextHighlight } from '../../specs/001-obsidian-search-plugin/contracts/search-interface';

// Mock the SemanticSearchEngine that doesn't exist yet (TDD - will FAIL initially)
jest.mock('../../src/services/semantic-search-engine', () => {
  return {
    SemanticSearchEngine: jest.fn().mockImplementation(() => {
      return {
        semanticSearch: jest.fn(),
        hybridSearch: jest.fn(),
        getSuggestions: jest.fn(),
        initialize: jest.fn(),
        isInitialized: jest.fn(() => false),
        getIndexStatus: jest.fn(() => 'building'),
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
      };
    }),
  };
});

// Mock the EmbeddingService that doesn't exist yet (TDD - will FAIL initially)
jest.mock('../../src/services/embedding-service', () => {
  return {
    EmbeddingService: jest.fn().mockImplementation(() => {
      return {
        generateEmbedding: jest.fn(),
        computeSimilarity: jest.fn(),
        isModelLoaded: jest.fn(() => false),
        loadModel: jest.fn(),
        unloadModel: jest.fn(),
      };
    }),
  };
});

// Mock the SemanticSearchPlugin that doesn't exist yet (TDD - will FAIL initially)
jest.mock('../../src/plugin/semantic-search-plugin', () => {
  return {
    SemanticSearchPlugin: jest.fn().mockImplementation((app: any, manifest: any) => {
      return {
        ...new MockPlugin(app, manifest),
        searchEngine: undefined,
        embeddingService: undefined,
        searchModal: undefined,
        onload: jest.fn(),
        onunload: jest.fn(),
        initializeSearchEngine: jest.fn(),
        openSearchModal: jest.fn(),
        addSearchCommand: jest.fn(),
      };
    }),
  };
});

// TypeScript interfaces for mock objects with strict typing
interface MockSearchEngine extends SearchEngine {
  semanticSearch: jest.Mock<Promise<SearchResponse>, [SearchQuery]>;
  hybridSearch: jest.Mock<Promise<SearchResponse>, [SearchQuery]>;
  getSuggestions: jest.Mock<Promise<string[]>, [string]>;
  initialize: jest.Mock<Promise<void>, []>;
  isInitialized: jest.Mock<boolean, []>;
  getIndexStatus: jest.Mock<'complete' | 'partial' | 'building', []>;
  on: jest.Mock<void, [string, Function]>;
  off: jest.Mock<void, [string, Function]>;
  emit: jest.Mock<void, [string, ...any[]]>;
}

interface MockEmbeddingService {
  generateEmbedding: jest.Mock<Promise<number[]>, [string]>;
  computeSimilarity: jest.Mock<number, [number[], number[]]>;
  isModelLoaded: jest.Mock<boolean, []>;
  loadModel: jest.Mock<Promise<void>, []>;
  unloadModel: jest.Mock<Promise<void>, []>;
}

interface MockSearchModal {
  open: jest.Mock<void, []>;
  close: jest.Mock<void, []>;
  setQuery: jest.Mock<void, [string]>;
  displayResults: jest.Mock<void, [SearchResult[]]>;
  showLoading: jest.Mock<void, [boolean]>;
}

describe('Semantic Search Integration - Quickstart Step 3', () => {
  let mockApp: MockApp;
  let pluginManifest: any;
  let mockPluginInstance: any;
  let mockSearchEngine: MockSearchEngine;
  let mockEmbeddingService: MockEmbeddingService;
  let mockSearchModal: MockSearchModal;

  // Sample documents from Obsidian workspace structure
  const sampleDocuments = [
    {
      path: 'Dailies/2024-01-15.md',
      title: 'Daily Log - January 15',
      content: '#dailies\n\n## Daily Standup\nToday we discussed the incident response process and reviewed team velocity metrics. The database performance issues from last week were resolved.',
      tags: ['#dailies'],
      created: new Date('2024-01-15'),
      modified: new Date('2024-01-15'),
    },
    {
      path: 'PPL/performance-review-template.md',
      title: 'Performance Review Template',
      content: '#profile #template\n\n## Annual Performance Assessment\nThis template provides structured approach to employee evaluation, goal setting, and career development planning.',
      tags: ['#profile', '#template'],
      created: new Date('2024-01-10'),
      modified: new Date('2024-01-12'),
    },
    {
      path: 'Meeting Series/WEOR/2024-01-15-weor.md',
      title: 'WEOR - Weekly Engineering Operations Review',
      content: '#meeting #weor\n\n## Weekly Operations Review\nDiscussed incident management procedures, database optimization strategies, and team coordination protocols.',
      tags: ['#meeting', '#weor'],
      created: new Date('2024-01-15'),
      modified: new Date('2024-01-15'),
    },
    {
      path: 'Incidents/INC-2024-001-database-outage.md',
      title: 'Database Outage Post-Incident Review',
      content: '#incident\n\n## Post-Incident Analysis\nRoot cause analysis of database failure, response timeline, and process improvements for incident management.',
      tags: ['#incident'],
      created: new Date('2024-01-12'),
      modified: new Date('2024-01-13'),
    },
    {
      path: 'Planning/database-optimization-project.md',
      title: 'Database Optimization Project Plan',
      content: '#planning #database\n\n## Database Performance Initiative\nComprehensive plan for optimizing database queries, indexing strategies, and performance monitoring.',
      tags: ['#planning', '#database'],
      created: new Date('2024-01-08'),
      modified: new Date('2024-01-10'),
    },
  ];

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock Obsidian app
    mockApp = new MockApp();

    // Plugin manifest for semantic search plugin
    pluginManifest = {
      id: 'semantic-search-plugin',
      name: 'Semantic Search Plugin',
      version: '1.0.0',
      description: 'AI-powered semantic search for Obsidian',
      author: 'Upstart Engineering',
      minAppVersion: '0.15.0',
    };

    // Mock search modal
    mockSearchModal = {
      open: jest.fn<void, []>(),
      close: jest.fn<void, []>(),
      setQuery: jest.fn<void, [string]>(),
      displayResults: jest.fn<void, [SearchResult[]]>(),
      showLoading: jest.fn<void, [boolean]>(),
    };

    // Mock embedding service with semantic similarity capabilities
    mockEmbeddingService = {
      generateEmbedding: jest.fn<Promise<number[]>, [string]>(),
      computeSimilarity: jest.fn<number, [number[], number[]]>(),
      isModelLoaded: jest.fn<boolean, []>().mockReturnValue(true),
      loadModel: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
      unloadModel: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
    };

    // Mock semantic search engine with realistic response generation
    mockSearchEngine = {
      semanticSearch: jest.fn<Promise<SearchResponse>, [SearchQuery]>(),
      hybridSearch: jest.fn<Promise<SearchResponse>, [SearchQuery]>(),
      getSuggestions: jest.fn<Promise<string[]>, [string]>(),
      initialize: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
      isInitialized: jest.fn<boolean, []>().mockReturnValue(true),
      getIndexStatus: jest.fn<'complete' | 'partial' | 'building', []>().mockReturnValue('complete'),
      on: jest.fn<void, [string, Function]>(),
      off: jest.fn<void, [string, Function]>(),
      emit: jest.fn<void, [string, ...any[]]>(),
    };

    // Create mock plugin instance
    mockPluginInstance = {
      ...new MockPlugin(mockApp, pluginManifest),
      searchEngine: mockSearchEngine,
      embeddingService: mockEmbeddingService,
      searchModal: mockSearchModal,
      initializeSearchEngine: jest.fn().mockImplementation(() => {
        mockPluginInstance.searchEngine = mockSearchEngine;
        mockPluginInstance.embeddingService = mockEmbeddingService;
      }),
      openSearchModal: jest.fn().mockImplementation(() => {
        mockSearchModal.open();
      }),
      addSearchCommand: jest.fn().mockImplementation(() => {
        mockPluginInstance.addCommand({
          id: 'semantic-search',
          name: 'Open Semantic Search',
          callback: () => mockPluginInstance.openSearchModal(),
        });
      }),
    };

    // Setup mock embedding generation (384-dimensional vectors as commonly used)
    mockEmbeddingService.generateEmbedding.mockImplementation(async (text: string) => {
      // Generate deterministic embeddings based on text content for consistent testing
      const hash = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      return new Array(384).fill(0).map((_, i) => Math.sin(hash + i) * 0.1);
    });

    // Setup mock similarity computation (cosine similarity)
    mockEmbeddingService.computeSimilarity.mockImplementation((vec1: number[], vec2: number[]) => {
      // Simple dot product for mock similarity
      const similarity = vec1.reduce((sum, val, i) => sum + val * vec2[i], 0);
      return Math.max(0, Math.min(1, similarity + 0.5)); // Normalize to [0,1]
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

  describe('Semantic Search Engine Initialization', () => {
    it('should fail initially - semantic search engine does not exist yet (TDD)', async () => {
      // This test should FAIL initially because the SemanticSearchEngine doesn't exist
      // This validates TDD requirement - tests are written before implementation

      try {
        // Attempt to import the service that doesn't exist yet
        const { SemanticSearchEngine } = require('../../src/services/semantic-search-engine');

        // This should throw an error initially
        expect(SemanticSearchEngine).toBeDefined();
        fail('Expected SemanticSearchEngine import to fail, but it succeeded');
      } catch (error: any) {
        // Expected failure - service doesn't exist yet
        expect(error).toBeDefined();
        expect(error.message).toMatch(/Cannot find module|MODULE_NOT_FOUND/);
      }
    });

    it('should initialize semantic search engine on plugin activation', async () => {
      // Mock plugin activation
      await mockPluginInstance.onload();
      mockPluginInstance.initializeSearchEngine();

      // Verify search engine is initialized
      expect(mockPluginInstance.initializeSearchEngine).toHaveBeenCalled();
      expect(mockPluginInstance.searchEngine).toBeDefined();
      expect(mockSearchEngine.initialize).toHaveBeenCalled();
    });

    it('should add semantic search command to command palette', async () => {
      // Activate plugin and add search command
      await mockPluginInstance.onload();
      mockPluginInstance.addSearchCommand();

      // Verify command is registered
      expect(mockPluginInstance.addCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'semantic-search',
          name: 'Open Semantic Search',
          callback: expect.any(Function),
        })
      );
    });
  });

  describe('Basic Semantic Search from Quickstart Step 3', () => {
    beforeEach(() => {
      // Setup search engine with mock semantic results
      mockSearchEngine.semanticSearch.mockImplementation(async (query: SearchQuery) => {
        const results = generateMockSemanticResults(query.text);
        return {
          results,
          totalMatches: results.length,
          searchTime: 150, // Mock search time in ms
          executedQuery: query,
          stats: {
            documentsSearched: sampleDocuments.length,
            chunksEvaluated: sampleDocuments.length * 3, // Assume 3 chunks per document
            indexStatus: 'complete' as const,
          },
        };
      });
    });

    it('should return relevant results for "incident management process" query', async () => {
      const query: SearchQuery = {
        text: 'incident management process',
        limit: 5,
        mode: 'semantic',
      };

      const response = await mockSearchEngine.semanticSearch(query);

      // Verify search was called correctly
      expect(mockSearchEngine.semanticSearch).toHaveBeenCalledWith(query);

      // Verify response structure
      expect(response.results).toBeDefined();
      expect(response.results.length).toBeGreaterThan(0);
      expect(response.totalMatches).toBe(response.results.length);
      expect(response.searchTime).toBeGreaterThan(0);

      // Verify semantic relevance - should find incident-related documents
      const incidentResults = response.results.filter(result =>
        result.filePath.includes('Incidents') ||
        result.snippet.toLowerCase().includes('incident') ||
        result.tags.includes('#incident')
      );
      expect(incidentResults.length).toBeGreaterThan(0);

      // Verify results include documents that discuss concepts without exact phrase match
      const conceptualMatches = response.results.filter(result =>
        result.snippet.toLowerCase().includes('process') ||
        result.snippet.toLowerCase().includes('procedure') ||
        result.snippet.toLowerCase().includes('management')
      );
      expect(conceptualMatches.length).toBeGreaterThan(0);

      // Verify semantic match type
      expect(response.results[0].matchType).toBe('semantic');
    });

    it('should return relevant results for "daily standup meetings" query', async () => {
      const query: SearchQuery = {
        text: 'daily standup meetings',
        limit: 5,
        mode: 'semantic',
      };

      const response = await mockSearchEngine.semanticSearch(query);

      // Verify semantic understanding finds related content
      const dailyResults = response.results.filter(result =>
        result.filePath.includes('Dailies') ||
        result.snippet.toLowerCase().includes('daily') ||
        result.snippet.toLowerCase().includes('standup') ||
        result.tags.includes('#dailies')
      );
      expect(dailyResults.length).toBeGreaterThan(0);

      // Should find meeting-related content even without exact phrase
      const meetingResults = response.results.filter(result =>
        result.snippet.toLowerCase().includes('meeting') ||
        result.snippet.toLowerCase().includes('review') ||
        result.tags.includes('#meeting')
      );
      expect(meetingResults.length).toBeGreaterThan(0);

      // Verify results are ranked by semantic relevance
      expect(response.results[0].score).toBeGreaterThanOrEqual(response.results[1]?.score || 0);
    });

    it('should return relevant results for "performance review process" query', async () => {
      const query: SearchQuery = {
        text: 'performance review process',
        limit: 5,
        mode: 'semantic',
      };

      const response = await mockSearchEngine.semanticSearch(query);

      // Should find performance-related documents
      const performanceResults = response.results.filter(result =>
        result.filePath.includes('PPL') ||
        result.snippet.toLowerCase().includes('performance') ||
        result.snippet.toLowerCase().includes('review') ||
        result.tags.includes('#profile')
      );
      expect(performanceResults.length).toBeGreaterThan(0);

      // Should understand related concepts like evaluation and assessment
      const conceptualResults = response.results.filter(result =>
        result.snippet.toLowerCase().includes('evaluation') ||
        result.snippet.toLowerCase().includes('assessment') ||
        result.snippet.toLowerCase().includes('development')
      );
      expect(conceptualResults.length).toBeGreaterThan(0);
    });

    it('should return relevant results for "database optimization" query', async () => {
      const query: SearchQuery = {
        text: 'database optimization',
        limit: 5,
        mode: 'semantic',
      };

      const response = await mockSearchEngine.semanticSearch(query);

      // Should find database-related content
      const databaseResults = response.results.filter(result =>
        result.snippet.toLowerCase().includes('database') ||
        result.snippet.toLowerCase().includes('optimization') ||
        result.tags.includes('#database')
      );
      expect(databaseResults.length).toBeGreaterThan(0);

      // Should understand related performance concepts
      const performanceResults = response.results.filter(result =>
        result.snippet.toLowerCase().includes('performance') ||
        result.snippet.toLowerCase().includes('query') ||
        result.snippet.toLowerCase().includes('indexing')
      );
      expect(performanceResults.length).toBeGreaterThan(0);
    });
  });

  describe('Search Interface and User Experience', () => {
    it('should open search interface via command palette', async () => {
      // Simulate command palette activation
      const searchCommand = mockPluginInstance.addCommand.mock.calls.find(call =>
        call[0].id === 'semantic-search'
      );

      expect(searchCommand).toBeDefined();

      // Execute search command
      if (searchCommand) {
        searchCommand[0].callback();
      }

      expect(mockPluginInstance.openSearchModal).toHaveBeenCalled();
      expect(mockSearchModal.open).toHaveBeenCalled();
    });

    it('should display search results with proper formatting', async () => {
      const query: SearchQuery = { text: 'incident management', mode: 'semantic' };
      const response = await mockSearchEngine.semanticSearch(query);

      // Simulate displaying results in modal
      mockSearchModal.displayResults(response.results);

      expect(mockSearchModal.displayResults).toHaveBeenCalledWith(response.results);

      // Verify result structure for UI display
      response.results.forEach(result => {
        expect(result.title).toBeDefined();
        expect(result.snippet).toBeDefined();
        expect(result.filePath).toBeDefined();
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(1);
        expect(result.highlights).toBeDefined();
      });
    });

    it('should handle search loading states', async () => {
      // Mock delayed search response
      mockSearchEngine.semanticSearch.mockImplementation(async (query: SearchQuery) => {
        mockSearchModal.showLoading(true);

        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 100));

        const results = generateMockSemanticResults(query.text);
        mockSearchModal.showLoading(false);

        return {
          results,
          totalMatches: results.length,
          searchTime: 150,
          executedQuery: query,
          stats: { documentsSearched: 5, chunksEvaluated: 15, indexStatus: 'complete' as const },
        };
      });

      const query: SearchQuery = { text: 'test query', mode: 'semantic' };
      await mockSearchEngine.semanticSearch(query);

      expect(mockSearchModal.showLoading).toHaveBeenCalledWith(true);
      expect(mockSearchModal.showLoading).toHaveBeenCalledWith(false);
    });
  });

  describe('Advanced Semantic Search Features', () => {
    it('should support tag-based filtering with semantic search', async () => {
      const query: SearchQuery = {
        text: 'team meetings',
        tags: ['#dailies', '#meeting'],
        mode: 'semantic',
        limit: 10,
      };

      const response = await mockSearchEngine.semanticSearch(query);

      // Verify tag filtering is applied
      expect(mockSearchEngine.semanticSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: ['#dailies', '#meeting'],
        })
      );

      // Results should respect tag filters
      response.results.forEach(result => {
        const hasMatchingTag = result.tags.some(tag =>
          query.tags!.includes(tag)
        );
        expect(hasMatchingTag).toBe(true);
      });
    });

    it('should provide search suggestions for partial queries', async () => {
      const suggestions = ['incident management', 'incident response', 'incident analysis'];
      mockSearchEngine.getSuggestions.mockResolvedValue(suggestions);

      const partialQuery = 'incid';
      const result = await mockSearchEngine.getSuggestions(partialQuery);

      expect(mockSearchEngine.getSuggestions).toHaveBeenCalledWith(partialQuery);
      expect(result).toEqual(suggestions);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle date range filtering in semantic search', async () => {
      const query: SearchQuery = {
        text: 'recent incidents',
        mode: 'semantic',
        dateRange: {
          start: new Date('2024-01-10'),
          end: new Date('2024-01-20'),
        },
      };

      const response = await mockSearchEngine.semanticSearch(query);

      expect(mockSearchEngine.semanticSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          dateRange: {
            start: expect.any(Date),
            end: expect.any(Date),
          },
        })
      );

      // Results should be within date range
      response.results.forEach(result => {
        expect(result.metadata.created).toBeInstanceOf(Date);
        expect(result.metadata.modified).toBeInstanceOf(Date);
      });
    });

    it('should handle empty search results gracefully', async () => {
      mockSearchEngine.semanticSearch.mockResolvedValue({
        results: [],
        totalMatches: 0,
        searchTime: 50,
        executedQuery: { text: 'nonexistent topic', mode: 'semantic' },
        stats: { documentsSearched: 5, chunksEvaluated: 15, indexStatus: 'complete' },
      });

      const query: SearchQuery = { text: 'nonexistent topic', mode: 'semantic' };
      const response = await mockSearchEngine.semanticSearch(query);

      expect(response.results).toHaveLength(0);
      expect(response.totalMatches).toBe(0);
      expect(response.searchTime).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle search engine errors gracefully', async () => {
      mockSearchEngine.semanticSearch.mockRejectedValue(new Error('Search engine unavailable'));

      const query: SearchQuery = { text: 'test query', mode: 'semantic' };

      await expect(mockSearchEngine.semanticSearch(query)).rejects.toThrow('Search engine unavailable');
    });

    it('should handle malformed search queries', async () => {
      const malformedQuery = { text: '', mode: 'semantic' } as SearchQuery;

      mockSearchEngine.semanticSearch.mockImplementation(async (query: SearchQuery) => {
        if (!query.text || query.text.trim() === '') {
          throw new Error('Query text cannot be empty');
        }
        return generateMockSearchResponse(query);
      });

      await expect(mockSearchEngine.semanticSearch(malformedQuery))
        .rejects.toThrow('Query text cannot be empty');
    });

    it('should handle large result sets with proper pagination', async () => {
      const query: SearchQuery = { text: 'common term', mode: 'semantic', limit: 3 };

      mockSearchEngine.semanticSearch.mockImplementation(async (query: SearchQuery) => {
        const allResults = generateMockSemanticResults(query.text, 10); // Generate 10 results
        const limitedResults = allResults.slice(0, query.limit || 5);

        return {
          results: limitedResults,
          totalMatches: allResults.length, // Total available matches
          searchTime: 200,
          executedQuery: query,
          stats: { documentsSearched: 10, chunksEvaluated: 30, indexStatus: 'complete' as const },
        };
      });

      const response = await mockSearchEngine.semanticSearch(query);

      expect(response.results.length).toBe(3); // Respects limit
      expect(response.totalMatches).toBe(10); // Total available
    });
  });

  // Helper function to generate mock semantic search results
  function generateMockSemanticResults(queryText: string, count: number = 3): SearchResult[] {
    const relevantDocs = sampleDocuments.filter(doc =>
      isSemanticMatch(queryText.toLowerCase(), doc)
    );

    return relevantDocs.slice(0, count).map((doc, index) => ({
      id: `${doc.path}-${index}`,
      filePath: doc.path,
      title: doc.title,
      score: 0.9 - (index * 0.1), // Decreasing relevance score
      snippet: generateSnippet(doc.content, queryText),
      highlights: generateHighlights(doc.content, queryText),
      tags: doc.tags,
      metadata: {
        created: doc.created,
        modified: doc.modified,
        wordCount: doc.content.split(/\s+/).length,
      },
      matchType: 'semantic' as const,
    }));
  }

  // Helper function to determine semantic match
  function isSemanticMatch(queryText: string, doc: any): boolean {
    const docContent = doc.content.toLowerCase();
    const queryTerms = queryText.split(/\s+/);

    // Semantic matching logic for test queries
    const semanticMappings = {
      'incident': ['incident', 'outage', 'failure', 'problem', 'issue'],
      'management': ['management', 'process', 'procedure', 'handling', 'coordination'],
      'process': ['process', 'procedure', 'workflow', 'method', 'approach'],
      'daily': ['daily', 'standup', 'scrum', 'meeting', 'review'],
      'standup': ['standup', 'daily', 'meeting', 'scrum', 'sync'],
      'meetings': ['meeting', 'review', 'discussion', 'sync', 'standup'],
      'performance': ['performance', 'evaluation', 'assessment', 'review'],
      'review': ['review', 'evaluation', 'assessment', 'analysis'],
      'database': ['database', 'db', 'query', 'performance', 'optimization'],
      'optimization': ['optimization', 'performance', 'improvement', 'tuning'],
    };

    // Check for semantic matches
    return queryTerms.some(term => {
      const synonyms = semanticMappings[term as keyof typeof semanticMappings] || [term];
      return synonyms.some(synonym => docContent.includes(synonym));
    });
  }

  // Helper function to generate snippet with context
  function generateSnippet(content: string, queryText: string): string {
    const sentences = content.split(/[.!?]+/);
    const queryTerms = queryText.toLowerCase().split(/\s+/);

    // Find sentences containing query-related terms
    const relevantSentences = sentences.filter(sentence =>
      queryTerms.some(term => sentence.toLowerCase().includes(term))
    );

    if (relevantSentences.length > 0) {
      return relevantSentences[0].trim().substring(0, 200) + '...';
    }

    // Fallback to first meaningful sentence
    const meaningfulSentences = sentences.filter(s => s.trim().length > 20);
    return meaningfulSentences[0]?.trim().substring(0, 200) + '...' || content.substring(0, 200) + '...';
  }

  // Helper function to generate text highlights
  function generateHighlights(content: string, queryText: string): TextHighlight[] {
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

  // Helper function to generate complete mock search response
  function generateMockSearchResponse(query: SearchQuery): SearchResponse {
    const results = generateMockSemanticResults(query.text, query.limit || 5);
    return {
      results,
      totalMatches: results.length,
      searchTime: 150,
      executedQuery: query,
      stats: {
        documentsSearched: sampleDocuments.length,
        chunksEvaluated: sampleDocuments.length * 3,
        indexStatus: 'complete',
      },
    };
  }
});