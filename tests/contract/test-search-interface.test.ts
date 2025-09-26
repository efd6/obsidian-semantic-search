/**
 * Contract Tests for SearchEngine Interface
 * Tests the interface contracts without implementation details
 * Following TDD approach - tests should initially FAIL
 */

import {
  SearchEngine,
  SearchQuery,
  SearchResponse,
  SearchResult,
  TextHighlight,
  SearchStats
} from '../../specs/001-obsidian-search-plugin/contracts/search-interface';
import { MockApp, MockPlugin } from '../setup';

// Mock SearchEngine implementation that satisfies the interface
class MockSearchEngine implements SearchEngine {
  async semanticSearch(query: SearchQuery): Promise<SearchResponse> {
    // Intentionally incomplete implementation to make tests fail initially
    throw new Error('semanticSearch not implemented - TDD failure');
  }

  async hybridSearch(query: SearchQuery): Promise<SearchResponse> {
    throw new Error('hybridSearch not implemented - TDD failure');
  }

  async getSuggestions(partialQuery: string): Promise<string[]> {
    throw new Error('getSuggestions not implemented - TDD failure');
  }
}

// Helper function to create valid SearchQuery
const createValidSearchQuery = (overrides?: Partial<SearchQuery>): SearchQuery => ({
  text: 'test query',
  limit: 10,
  tags: ['test'],
  mode: 'semantic',
  dateRange: {
    start: new Date('2024-01-01'),
    end: new Date('2024-12-31')
  },
  pathFilters: ['*.md'],
  ...overrides
});

// Helper function to create valid SearchResult
const createValidSearchResult = (overrides?: Partial<SearchResult>): SearchResult => ({
  id: 'test-result-1',
  filePath: '/test/file.md',
  title: 'Test Document',
  score: 0.95,
  snippet: 'This is a test snippet with highlighted text',
  highlights: [{
    start: 10,
    end: 14,
    type: 'exact'
  }],
  tags: ['test', 'sample'],
  metadata: {
    created: new Date('2024-01-01'),
    modified: new Date('2024-01-15'),
    wordCount: 150
  },
  matchType: 'semantic',
  ...overrides
});

// Helper function to create valid SearchResponse
const createValidSearchResponse = (overrides?: Partial<SearchResponse>): SearchResponse => ({
  results: [createValidSearchResult()],
  totalMatches: 1,
  searchTime: 125.5,
  executedQuery: createValidSearchQuery(),
  stats: {
    documentsSearched: 100,
    chunksEvaluated: 500,
    indexStatus: 'complete'
  },
  ...overrides
});

describe('SearchEngine Interface Contract Tests', () => {
  let mockApp: MockApp;
  let mockPlugin: MockPlugin;
  let mockSearchEngine: MockSearchEngine;

  beforeEach(() => {
    mockApp = new MockApp();
    mockPlugin = new MockPlugin(mockApp, { id: 'search-test' });
    mockSearchEngine = new MockSearchEngine();
  });

  describe('SearchEngine Interface', () => {
    it('should have semanticSearch method with correct signature', () => {
      expect(typeof mockSearchEngine.semanticSearch).toBe('function');
      expect(mockSearchEngine.semanticSearch).toHaveLength(1);
    });

    it('should have hybridSearch method with correct signature', () => {
      expect(typeof mockSearchEngine.hybridSearch).toBe('function');
      expect(mockSearchEngine.hybridSearch).toHaveLength(1);
    });

    it('should have getSuggestions method with correct signature', () => {
      expect(typeof mockSearchEngine.getSuggestions).toBe('function');
      expect(mockSearchEngine.getSuggestions).toHaveLength(1);
    });

    it('should throw error on semanticSearch call (TDD failure)', async () => {
      const query = createValidSearchQuery();
      await expect(mockSearchEngine.semanticSearch(query))
        .rejects.toThrow('semanticSearch not implemented - TDD failure');
    });

    it('should throw error on hybridSearch call (TDD failure)', async () => {
      const query = createValidSearchQuery();
      await expect(mockSearchEngine.hybridSearch(query))
        .rejects.toThrow('hybridSearch not implemented - TDD failure');
    });

    it('should throw error on getSuggestions call (TDD failure)', async () => {
      await expect(mockSearchEngine.getSuggestions('partial'))
        .rejects.toThrow('getSuggestions not implemented - TDD failure');
    });
  });

  describe('SearchQuery Type Contract', () => {
    it('should accept required text property', () => {
      const query: SearchQuery = { text: 'test' };
      expect(query.text).toBe('test');
      expect(typeof query.text).toBe('string');
    });

    it('should accept optional limit property', () => {
      const query: SearchQuery = { text: 'test', limit: 5 };
      expect(query.limit).toBe(5);
      expect(typeof query.limit).toBe('number');
    });

    it('should accept optional tags array property', () => {
      const tags = ['tag1', 'tag2'];
      const query: SearchQuery = { text: 'test', tags };
      expect(query.tags).toEqual(tags);
      expect(Array.isArray(query.tags)).toBe(true);
    });

    it('should accept optional mode property with valid values', () => {
      const modes: Array<'semantic' | 'keyword' | 'hybrid'> = ['semantic', 'keyword', 'hybrid'];

      modes.forEach(mode => {
        const query: SearchQuery = { text: 'test', mode };
        expect(query.mode).toBe(mode);
      });
    });

    it('should accept optional dateRange property', () => {
      const dateRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-12-31')
      };
      const query: SearchQuery = { text: 'test', dateRange };
      expect(query.dateRange).toEqual(dateRange);
      expect(query.dateRange?.start).toBeInstanceOf(Date);
      expect(query.dateRange?.end).toBeInstanceOf(Date);
    });

    it('should accept optional pathFilters array property', () => {
      const pathFilters = ['*.md', '**/*.txt'];
      const query: SearchQuery = { text: 'test', pathFilters };
      expect(query.pathFilters).toEqual(pathFilters);
      expect(Array.isArray(query.pathFilters)).toBe(true);
    });
  });

  describe('SearchResponse Type Contract', () => {
    it('should have required results array property', () => {
      const response = createValidSearchResponse();
      expect(Array.isArray(response.results)).toBe(true);
      expect(response.results.length).toBeGreaterThanOrEqual(0);
    });

    it('should have required totalMatches number property', () => {
      const response = createValidSearchResponse({ totalMatches: 42 });
      expect(typeof response.totalMatches).toBe('number');
      expect(response.totalMatches).toBe(42);
    });

    it('should have required searchTime number property', () => {
      const response = createValidSearchResponse({ searchTime: 150.5 });
      expect(typeof response.searchTime).toBe('number');
      expect(response.searchTime).toBe(150.5);
    });

    it('should have required executedQuery property', () => {
      const query = createValidSearchQuery();
      const response = createValidSearchResponse({ executedQuery: query });
      expect(response.executedQuery).toEqual(query);
    });

    it('should have required stats property', () => {
      const response = createValidSearchResponse();
      expect(response.stats).toBeDefined();
      expect(typeof response.stats.documentsSearched).toBe('number');
      expect(typeof response.stats.chunksEvaluated).toBe('number');
      expect(['complete', 'partial', 'building']).toContain(response.stats.indexStatus);
    });
  });

  describe('SearchResult Type Contract', () => {
    it('should have all required string properties', () => {
      const result = createValidSearchResult();
      expect(typeof result.id).toBe('string');
      expect(typeof result.filePath).toBe('string');
      expect(typeof result.title).toBe('string');
      expect(typeof result.snippet).toBe('string');
    });

    it('should have required score number property between 0 and 1', () => {
      const result = createValidSearchResult({ score: 0.85 });
      expect(typeof result.score).toBe('number');
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    });

    it('should have required highlights array property', () => {
      const result = createValidSearchResult();
      expect(Array.isArray(result.highlights)).toBe(true);
      result.highlights.forEach(highlight => {
        expect(typeof highlight.start).toBe('number');
        expect(typeof highlight.end).toBe('number');
        expect(['exact', 'semantic', 'fuzzy']).toContain(highlight.type);
      });
    });

    it('should have required tags array property', () => {
      const result = createValidSearchResult();
      expect(Array.isArray(result.tags)).toBe(true);
      result.tags.forEach(tag => {
        expect(typeof tag).toBe('string');
      });
    });

    it('should have required metadata property with correct structure', () => {
      const result = createValidSearchResult();
      expect(result.metadata).toBeDefined();
      expect(result.metadata.created).toBeInstanceOf(Date);
      expect(result.metadata.modified).toBeInstanceOf(Date);
      expect(typeof result.metadata.wordCount).toBe('number');
    });

    it('should have required matchType property with valid values', () => {
      const matchTypes: Array<'semantic' | 'keyword' | 'hybrid'> = ['semantic', 'keyword', 'hybrid'];

      matchTypes.forEach(matchType => {
        const result = createValidSearchResult({ matchType });
        expect(result.matchType).toBe(matchType);
      });
    });
  });

  describe('TextHighlight Type Contract', () => {
    it('should have required numeric position properties', () => {
      const highlight: TextHighlight = { start: 5, end: 10, type: 'exact' };
      expect(typeof highlight.start).toBe('number');
      expect(typeof highlight.end).toBe('number');
      expect(highlight.end).toBeGreaterThan(highlight.start);
    });

    it('should have required type property with valid values', () => {
      const types: Array<'exact' | 'semantic' | 'fuzzy'> = ['exact', 'semantic', 'fuzzy'];

      types.forEach(type => {
        const highlight: TextHighlight = { start: 0, end: 5, type };
        expect(highlight.type).toBe(type);
      });
    });
  });

  describe('SearchStats Type Contract', () => {
    it('should have required numeric properties', () => {
      const stats: SearchStats = {
        documentsSearched: 100,
        chunksEvaluated: 500,
        indexStatus: 'complete'
      };
      expect(typeof stats.documentsSearched).toBe('number');
      expect(typeof stats.chunksEvaluated).toBe('number');
      expect(stats.documentsSearched).toBeGreaterThanOrEqual(0);
      expect(stats.chunksEvaluated).toBeGreaterThanOrEqual(0);
    });

    it('should have required indexStatus property with valid values', () => {
      const statuses: Array<'complete' | 'partial' | 'building'> = ['complete', 'partial', 'building'];

      statuses.forEach(indexStatus => {
        const stats: SearchStats = {
          documentsSearched: 0,
          chunksEvaluated: 0,
          indexStatus
        };
        expect(stats.indexStatus).toBe(indexStatus);
      });
    });
  });

  describe('Interface Method Return Type Contracts', () => {
    it('should expect semanticSearch to return Promise<SearchResponse>', () => {
      const query = createValidSearchQuery();
      const result = mockSearchEngine.semanticSearch(query);
      expect(result).toBeInstanceOf(Promise);
    });

    it('should expect hybridSearch to return Promise<SearchResponse>', () => {
      const query = createValidSearchQuery();
      const result = mockSearchEngine.hybridSearch(query);
      expect(result).toBeInstanceOf(Promise);
    });

    it('should expect getSuggestions to return Promise<string[]>', () => {
      const result = mockSearchEngine.getSuggestions('partial');
      expect(result).toBeInstanceOf(Promise);
    });
  });

  describe('Optional Parameter Handling', () => {
    it('should accept SearchQuery with only required text property', () => {
      const minimalQuery: SearchQuery = { text: 'test' };
      expect(minimalQuery.text).toBe('test');
      expect(minimalQuery.limit).toBeUndefined();
      expect(minimalQuery.tags).toBeUndefined();
      expect(minimalQuery.mode).toBeUndefined();
      expect(minimalQuery.dateRange).toBeUndefined();
      expect(minimalQuery.pathFilters).toBeUndefined();
    });

    it('should accept partial dateRange with only start or end', () => {
      const queryWithStartOnly: SearchQuery = {
        text: 'test',
        dateRange: { start: new Date('2024-01-01') }
      };
      const queryWithEndOnly: SearchQuery = {
        text: 'test',
        dateRange: { end: new Date('2024-12-31') }
      };

      expect(queryWithStartOnly.dateRange?.start).toBeInstanceOf(Date);
      expect(queryWithStartOnly.dateRange?.end).toBeUndefined();
      expect(queryWithEndOnly.dateRange?.end).toBeInstanceOf(Date);
      expect(queryWithEndOnly.dateRange?.start).toBeUndefined();
    });
  });
});