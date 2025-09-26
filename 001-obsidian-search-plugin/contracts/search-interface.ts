/**
 * Search Interface Contract
 * Defines the search API for semantic and hybrid search functionality
 * Derived from FR-003, FR-004, FR-005, FR-008, FR-009, FR-012
 */

export interface SearchEngine {
  /**
   * Perform semantic search across indexed documents
   * Implements: FR-003 (semantic search), FR-005 (offline operation)
   */
  semanticSearch(query: SearchQuery): Promise<SearchResponse>;

  /**
   * Perform hybrid search combining semantic and keyword matching
   * Implements: FR-012 (hybrid search support)
   */
  hybridSearch(query: SearchQuery): Promise<SearchResponse>;

  /**
   * Get search suggestions based on partial query
   */
  getSuggestions(partialQuery: string): Promise<string[]>;
}

export interface SearchQuery {
  /** The search query text */
  text: string;

  /** Maximum number of results to return */
  limit?: number;

  /** Tag filters - only return documents with these tags */
  tags?: string[]; // Implements FR-004 (tag-based filtering)

  /** Search mode preference */
  mode?: 'semantic' | 'keyword' | 'hybrid';

  /** Date range filter */
  dateRange?: {
    start?: Date;
    end?: Date;
  };

  /** File path filters (regex patterns) */
  pathFilters?: string[];
}

export interface SearchResponse {
  /** Search results ordered by relevance */
  results: SearchResult[];

  /** Total number of potential matches (before limit) */
  totalMatches: number;

  /** Time taken to execute search in milliseconds */
  searchTime: number;

  /** Query that was executed (for debugging) */
  executedQuery: SearchQuery;

  /** Search statistics */
  stats: SearchStats;
}

export interface SearchResult {
  /** Unique result identifier */
  id: string;

  /** Document file path */
  filePath: string; // Implements FR-009 (clickable links)

  /** Document title */
  title: string;

  /** Relevance score (0.0 to 1.0) */
  score: number;

  /** Text snippet showing match context */
  snippet: string; // Implements FR-009 (content snippets)

  /** Highlighted query matches within snippet */
  highlights: TextHighlight[];

  /** Document tags */
  tags: string[];

  /** Document metadata */
  metadata: {
    created: Date;
    modified: Date;
    wordCount: number;
  };

  /** Type of match found */
  matchType: 'semantic' | 'keyword' | 'hybrid';
}

export interface TextHighlight {
  /** Start position in snippet */
  start: number;

  /** End position in snippet */
  end: number;

  /** Type of highlight */
  type: 'exact' | 'semantic' | 'fuzzy';
}

export interface SearchStats {
  /** Number of documents searched */
  documentsSearched: number;

  /** Number of chunks evaluated */
  chunksEvaluated: number;

  /** Index status at search time */
  indexStatus: 'complete' | 'partial' | 'building';
}