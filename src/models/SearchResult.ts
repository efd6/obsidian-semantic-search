export enum MatchType {
  SEMANTIC = 'semantic',
  KEYWORD = 'keyword',
  HYBRID = 'hybrid'
}

export interface ISearchResult {
  id: string;
  query: string;
  documentId: string;
  chunkId: string;
  score: number;
  snippet: string;
  context: string;
  matchType: MatchType;
  tags: string[];
  filePath: string;
  timestamp: Date;
}

export class SearchResultValidationError extends Error {
  constructor(field: string, value: unknown, constraint: string) {
    super(`Invalid ${field}: ${String(value)} (${constraint})`);
    this.name = 'SearchResultValidationError';
  }
}

export class SearchResult implements ISearchResult {
  id: string;
  query: string;
  documentId: string;
  chunkId: string;
  score: number;
  snippet: string;
  context: string;
  matchType: MatchType;
  tags: string[];
  filePath: string;
  timestamp: Date;

  constructor(data: ISearchResult) {
    this.validateAndAssign(data);
  }

  private validateAndAssign(data: ISearchResult): void {
    if (data.score < 0 || data.score > 1) throw new SearchResultValidationError('score', data.score, 'must be 0.0-1.0');
    if (!data.documentId?.trim()) throw new SearchResultValidationError('documentId', data.documentId, 'required');
    if (!data.chunkId?.trim()) throw new SearchResultValidationError('chunkId', data.chunkId, 'required');
    if (data.snippet.length > 200) throw new SearchResultValidationError('snippet', data.snippet.length, 'max 200 chars');
    if (!Object.values(MatchType).includes(data.matchType)) throw new SearchResultValidationError('matchType', data.matchType, 'invalid enum');
    Object.assign(this, data);
  }

  static compareByScore = (a: SearchResult, b: SearchResult): number => b.score - a.score;
  static compareByTimestamp = (a: SearchResult, b: SearchResult): number =>
    b.timestamp.getTime() - a.timestamp.getTime();
  static filterByScore = (results: SearchResult[], minScore: number): SearchResult[] =>
    results.filter(r => r.score >= minScore);
  static filterByTags = (results: SearchResult[], requiredTags: string[]): SearchResult[] =>
    results.filter(r => requiredTags.some(tag => r.tags.includes(tag)));
  static filterByMatchType = (results: SearchResult[], matchTypes: MatchType[]): SearchResult[] =>
    results.filter(r => matchTypes.includes(r.matchType));

  getDisplayTitle = (): string => this.filePath.split('/').pop()?.replace('.md', '') ?? 'Unknown';
  getRelativeScore = (): string => `${Math.round(this.score * 100)}%`;
  hasTag = (tag: string): boolean => this.tags.includes(tag);

  static generateSnippet(content: string, query: string, maxLength = 200): string {
    const queryWords = query.toLowerCase().split(/\s+/);
    const contentLower = content.toLowerCase();
    let bestStart = 0, maxMatches = 0;
    for (let i = 0; i < content.length - maxLength; i += 50) {
      const segment = new Set(contentLower.slice(i, i + maxLength));
      const matches = queryWords.filter(word => segment.has(word)).length;
      if (matches > maxMatches) { maxMatches = matches; bestStart = i; }
    }
    let snippet = content.slice(bestStart, bestStart + maxLength);
    if (bestStart > 0) snippet = '...' + snippet;
    if (bestStart + maxLength < content.length) snippet += '...';
    return snippet.trim();
  }

  static rankResults(
    results: SearchResult[],
    options?: {scoreWeight?: number; recencyWeight?: number; tagBoost?: string[]}
  ): SearchResult[] {
    const opts: {scoreWeight: number; recencyWeight: number; tagBoost: string[]} = {
      scoreWeight: 0.7,
      recencyWeight: 0.3,
      tagBoost: [],
      ...options
    };
    return results
      .map(result => {
        let score = result.score * opts.scoreWeight;
        const hoursSinceSearch = (Date.now() - result.timestamp.getTime()) / (1000 * 60 * 60);
        const recencyScore = Math.max(0, 1 - hoursSinceSearch / 24);
        score += recencyScore * opts.recencyWeight;
        if (opts.tagBoost.some(tag => result.hasTag(tag))) score += 0.1;
        return { result, adjustedScore: score };
      })
      .sort((a, b) => b.adjustedScore - a.adjustedScore)
      .map(item => item.result);
  }
}