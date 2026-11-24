// TensorFlow.js Universal Sentence Encoder - no additional imports needed
import {
  SearchEngine,
  SearchQuery,
  SearchResponse,
  SearchResult,
  TextHighlight,
  SearchStats
} from '../types/search-interface';
import { Chunk } from '../models/Chunk';
import { Document } from '../models/Document';
import { SearchResult as ModelSearchResult, MatchType } from '../models/SearchResult';
import { EmbeddingEngine } from './EmbeddingEngine';


export class SemanticSearchEngine implements SearchEngine {
  private embeddingEngine: EmbeddingEngine;
  private documents: Map<string, Document> = new Map();
  private chunks: Map<string, Chunk> = new Map();
  private queryCache: Map<string, Float32Array> = new Map();
  private searchCount: number = 0;
  private totalSearchTime: number = 0;

  // Plugin compatibility properties
  maxResults: number = 10;

  // onChange, when set, is called whenever documents are added or removed,
  // so a saved copy of the index can be kept up to date.
  onChange?: () => void;

  // Minimum cosine similarity for a chunk to count as a semantic match. On the
  // test vault, unrelated queries peak near 0.23 and real topics start near 0.33.
  minSemanticScore: number = 0.3;

  // Whether a keyword match needs every query term ('all') or any one ('any').
  keywordMatch: 'all' | 'any' = 'all';

  constructor() {
    this.embeddingEngine = EmbeddingEngine.getInstance();
    void this.initializeEmbedder();
  }

  private async initializeEmbedder(): Promise<void> {
    await this.embeddingEngine.initialize();
    console.log('SemanticSearchEngine: Using EmbeddingEngine for TensorFlow.js Universal Sentence Encoder');
  }

  async semanticSearch(query: SearchQuery): Promise<SearchResponse> {
    const startTime = performance.now();
    const queryEmbedding = await this.generateEmbedding(query.text);

    const candidates = this.filterCandidates(query);
    const results = this.computeSimilarities(candidates, queryEmbedding, query);
    const limitedResults = this.limitAndFormat(results, query.limit ?? this.maxResults);

    const searchTime = Math.max(performance.now() - startTime, 0.1); // Ensure minimum 0.1ms

    // Track search performance
    this.searchCount++;
    this.totalSearchTime += searchTime;

    return {
      results: limitedResults,
      totalMatches: results.length,
      searchTime,
      executedQuery: query,
      stats: this.generateStats(candidates.length)
    };
  }

  async hybridSearch(query: SearchQuery): Promise<SearchResponse> {
    const semanticResults = await this.semanticSearch({ ...query, mode: 'semantic' });
    const keywordResults = this.keywordSearch(query);

    const combined = this.mergeResults(semanticResults.results, keywordResults, 0.6, 0.4);

    return {
      ...semanticResults,
      results: combined.slice(0, query.limit ?? 10),
      totalMatches: combined.length
    };
  }

  async getSuggestions(partialQuery: string): Promise<string[]> {
    await Promise.resolve(); // Satisfy require-await rule
    const terms = partialQuery.toLowerCase().split(/\s+/);
    const suggestions = new Set<string>();
    const lastTerm = terms.at(-1) ?? '';

    // Extract tag suggestions
    for (const doc of this.documents.values()) {
      for (const tag of doc.tags) {
        if (tag.toLowerCase().includes(lastTerm)) {
          suggestions.add(`#${tag}`);
        }
      }
    }

    // Extract common phrases from document titles
    for (const doc of this.documents.values()) {
      const words = doc.title.toLowerCase().split(/\s+/);
      if (words.some(word => word.startsWith(lastTerm))) {
        suggestions.add(doc.title);
      }
    }

    return [...suggestions].slice(0, 10);
  }

  private async generateEmbedding(text: string): Promise<Float32Array> {
    if (this.queryCache.has(text)) {
      return this.queryCache.get(text)!;
    }

    const embedding = await this.embeddingEngine.generateEmbedding(text);

    this.queryCache.set(text, embedding);
    return embedding;
  }

  private filterCandidates(query: SearchQuery): Chunk[] {
    let candidates = [...this.chunks.values()];

    if (query.tags?.length) {
      candidates = candidates.filter(chunk => {
        const doc = this.documents.get(chunk.documentId);
        return doc && query.tags!.some(tag => doc.tags.includes(tag));
      });
    }

    if (query.dateRange) {
      candidates = candidates.filter(chunk => {
        const doc = this.documents.get(chunk.documentId);
        if (!doc) return false;

        const { start, end } = query.dateRange!;
        return (!start || doc.modifiedDate >= start) &&
               (!end || doc.modifiedDate <= end);
      });
    }

    if (query.pathFilters?.length) {
      candidates = candidates.filter(chunk => {
        const doc = this.documents.get(chunk.documentId);
        return doc && query.pathFilters!.some(pattern =>
          new RegExp(pattern).test(doc.filePath)
        );
      });
    }

    return candidates;
  }

  private computeSimilarities(chunks: Chunk[], queryEmbedding: Float32Array, query: SearchQuery): SearchResult[] {
    const results = chunks.map(chunk => {
      const similarity = chunk.cosineSimilarity(queryEmbedding);
      const doc = this.documents.get(chunk.documentId)!;

      return {
        id: `${chunk.id}-${Date.now()}`,
        filePath: doc.filePath,
        title: doc.title,
        score: similarity,
        snippet: ModelSearchResult.generateSnippet(chunk.content, query.text),
        highlights: this.generateHighlights(chunk.content, query.text),
        tags: doc.tags,
        metadata: {
          created: doc.createdDate,
          modified: doc.modifiedDate,
          wordCount: doc.wordCount
        },
        matchType: (query.mode === 'semantic' ? MatchType.SEMANTIC : MatchType.HYBRID) as 'semantic' | 'keyword' | 'hybrid'
      };
    });

    return results.filter(result => result.score >= (query.minScore ?? this.minSemanticScore));
  }

  private keywordSearch(query: SearchQuery): SearchResult[] {
    const terms = query.text.toLowerCase().split(/\s+/);
    const keywordMatch = query.keywordMatch ?? this.keywordMatch;
    const results: SearchResult[] = [];

    for (const chunk of this.chunks.values()) {
      const content = chunk.content.toLowerCase();
      const matches = terms.filter(term => content.includes(term)).length;

      if (keywordMatch === 'all' ? matches === terms.length : matches > 0) {
        const doc = this.documents.get(chunk.documentId)!;
        const score = matches / terms.length;

        results.push({
          id: `${chunk.id}-kw-${Date.now()}`,
          filePath: doc.filePath,
          title: doc.title,
          score,
          snippet: ModelSearchResult.generateSnippet(chunk.content, query.text),
          highlights: this.generateHighlights(chunk.content, query.text),
          tags: doc.tags,
          metadata: {
            created: doc.createdDate,
            modified: doc.modifiedDate,
            wordCount: doc.wordCount
          },
          matchType: 'keyword'
        });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  private mergeResults(semantic: SearchResult[], keyword: SearchResult[],
                      semWeight: number, kwWeight: number): SearchResult[] {
    const merged = new Map<string, SearchResult>();

    for (const result of semantic) {
      merged.set(result.filePath, { ...result, score: result.score * semWeight });
    }

    for (const result of keyword) {
      const existing = merged.get(result.filePath);
      if (existing) {
        existing.score = Math.max(existing.score, result.score * kwWeight);
        existing.matchType = 'hybrid';
      } else {
        merged.set(result.filePath, { ...result, score: result.score * kwWeight });
      }
    }

    return [...merged.values()].sort((a, b) => b.score - a.score);
  }

  private generateHighlights(content: string, query: string): TextHighlight[] {
    const highlights: TextHighlight[] = [];
    const terms = query.toLowerCase().split(/\s+/);
    const contentLower = content.toLowerCase();

    for (const term of terms) {
      let index = contentLower.indexOf(term);
      while (index !== -1) {
        highlights.push({
          start: index,
          end: index + term.length,
          type: 'exact'
        });
        index = contentLower.indexOf(term, index + 1);
      }
    }

    return highlights.sort((a, b) => a.start - b.start);
  }

  private limitAndFormat(results: SearchResult[], limit: number): SearchResult[] {
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  private generateStats(documentsSearched: number): SearchStats {
    return {
      documentsSearched,
      chunksEvaluated: this.chunks.size,
      indexStatus: 'complete'
    };
  }

  // Public methods for index management
  addDocument(document: Document): void {
    this.documents.set(document.id, document);
    this.onChange?.();
  }

  addChunk(chunk: Chunk): void {
    this.chunks.set(chunk.id, chunk);
  }

  removeDocument(documentId: string): void {
    if (this.documents.delete(documentId)) {
      this.onChange?.();
    }
    // Remove associated chunks
    for (const [chunkId, chunk] of this.chunks.entries()) {
      if (chunk.documentId === documentId) {
        this.chunks.delete(chunkId);
      }
    }
  }

  clearCache(): void {
    this.queryCache.clear();
  }

  // clear removes everything from the index and the caches that hold note or
  // query text, and returns the number of documents removed.
  clear(): number {
    const removed = this.documents.size;
    this.documents.clear();
    this.chunks.clear();
    this.queryCache.clear();
    this.embeddingEngine.clearCache();
    this.onChange?.();
    return removed;
  }

  getSearchStats(): { totalSearches: number; averageSearchTime: number } {
    return {
      totalSearches: this.searchCount,
      averageSearchTime: this.searchCount > 0 ? this.totalSearchTime / this.searchCount : 0
    };
  }

  getDocument(documentId: string): Document | undefined {
    return this.documents.get(documentId);
  }

  getDocuments(): Document[] {
    return [...this.documents.values()];
  }

  getChunks(): Chunk[] {
    return [...this.chunks.values()];
  }

  getDocumentCount(): number {
    return this.documents.size;
  }

  getChunkCount(): number {
    return this.chunks.size;
  }
}