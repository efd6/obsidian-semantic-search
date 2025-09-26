import { Chunk } from '../../src/models/Chunk';
import { Tag } from '../../src/models/Tag';
import { SearchResult } from '../../src/models/SearchResult';

describe('Chunk Utility Functions', (): void => {
    describe('splitIntoChunks', (): void => {
        it('should split text into equal-sized chunks', (): void => {
            const text: string = 'a'.repeat(1000);
            const chunks: string[] = Chunk.splitIntoChunks(text, 200, 50);

            expect(chunks.length).toBeGreaterThan(1);
            chunks.forEach((chunk: string): void => {
                expect(chunk.length).toBeLessThanOrEqual(200);
            });
        });

        it('should handle overlap correctly', (): void => {
            const text: string = 'The quick brown fox jumps over the lazy dog.';
            const chunks: string[] = Chunk.splitIntoChunks(text, 20, 5);

            expect(chunks.length).toBeGreaterThan(1);
            expect(chunks[1]).toContain(chunks[0].slice(-5));
        });

        it('should return single chunk for small text', (): void => {
            const text: string = 'Short text.';
            const chunks: string[] = Chunk.splitIntoChunks(text, 200, 50);

            expect(chunks).toHaveLength(1);
            expect(chunks[0]).toBe(text);
        });
    });

    describe('calculateCosineSimilarity', (): void => {
        it('should return 1.0 for identical vectors', (): void => {
            const vector: number[] = [1, 2, 3, 4, 5];
            const similarity: number = Chunk.calculateCosineSimilarity(vector, vector);

            expect(similarity).toBeCloseTo(1.0, 5);
        });

        it('should return 0.0 for orthogonal vectors', (): void => {
            const vectorA: number[] = [1, 0, 0];
            const vectorB: number[] = [0, 1, 0];
            const similarity: number = Chunk.calculateCosineSimilarity(vectorA, vectorB);

            expect(similarity).toBeCloseTo(0.0, 5);
        });

        it('should handle zero vectors', (): void => {
            const zeroVector: number[] = [0, 0, 0];
            const normalVector: number[] = [1, 2, 3];
            const similarity: number = Chunk.calculateCosineSimilarity(zeroVector, normalVector);

            expect(similarity).toBe(0.0);
        });

        it('should handle negative values correctly', (): void => {
            const vectorA: number[] = [1, -1, 0];
            const vectorB: number[] = [-1, 1, 0];
            const similarity: number = Chunk.calculateCosineSimilarity(vectorA, vectorB);

            expect(similarity).toBeCloseTo(-1.0, 5);
        });
    });
});

describe('Tag Utility Functions', (): void => {
    describe('extractTagsFromContent', (): void => {
        it('should extract hashtags from text', (): void => {
            const content: string = 'This is #test content with #multiple #tags';
            const tags: string[] = Tag.extractTagsFromContent(content);

            expect(tags).toContain('test');
            expect(tags).toContain('multiple');
            expect(tags).toContain('tags');
            expect(tags).toHaveLength(3);
        });

        it('should handle duplicate tags', (): void => {
            const content: string = 'This has #duplicate and #duplicate tags';
            const tags: string[] = Tag.extractTagsFromContent(content);

            expect(tags).toContain('duplicate');
            expect(tags).toHaveLength(1);
        });

        it('should ignore malformed tags', (): void => {
            const content: string = 'Invalid #123tag and ##doubletag and #-invalid';
            const tags: string[] = Tag.extractTagsFromContent(content);

            expect(tags).toHaveLength(0);
        });

        it('should handle frontmatter tags', (): void => {
            const content: string = `---\ntags: [work, meeting, notes]\n---\nContent with #inline tag`;
            const tags: string[] = Tag.extractTagsFromContent(content);

            expect(tags).toContain('work');
            expect(tags).toContain('meeting');
            expect(tags).toContain('notes');
            expect(tags).toContain('inline');
            expect(tags).toHaveLength(4);
        });
    });

    describe('validateTagName', (): void => {
        it('should accept valid tag names', (): void => {
            expect(Tag.validateTagName('validtag')).toBe(true);
            expect(Tag.validateTagName('valid-tag')).toBe(true);
            expect(Tag.validateTagName('valid_tag')).toBe(true);
        });

        it('should reject invalid tag names', (): void => {
            expect(Tag.validateTagName('123invalid')).toBe(false);
            expect(Tag.validateTagName('#hashtag')).toBe(false);
            expect(Tag.validateTagName('invalid tag')).toBe(false);
            expect(Tag.validateTagName('')).toBe(false);
        });
    });
});

describe('SearchResult Utility Functions', (): void => {
    describe('generateSnippet', (): void => {
        it('should generate snippet with highlighted terms', (): void => {
            const content: string = 'The quick brown fox jumps over the lazy dog. This is test content.';
            const query: string = 'brown fox';
            const snippet: string = SearchResult.generateSnippet(content, query, 50, 10);

            expect(snippet).toContain('brown');
            expect(snippet).toContain('fox');
            expect(snippet.length).toBeLessThanOrEqual(50);
        });

        it('should handle query terms not found', (): void => {
            const content: string = 'This content does not contain the search terms.';
            const query: string = 'missing terms';
            const snippet: string = SearchResult.generateSnippet(content, query, 50, 10);

            expect(snippet.length).toBeLessThanOrEqual(50);
            expect(snippet).toContain('This content');
        });

        it('should handle empty content', (): void => {
            const content: string = '';
            const query: string = 'test';
            const snippet: string = SearchResult.generateSnippet(content, query, 50, 10);

            expect(snippet).toBe('');
        });
    });

    describe('calculateRelevanceScore', (): void => {
        it('should calculate score based on similarity and matches', (): void => {
            const similarity: number = 0.8;
            const termMatches: number = 3;
            const totalTerms: number = 5;
            const score: number = SearchResult.calculateRelevanceScore(similarity, termMatches, totalTerms);

            expect(score).toBeGreaterThan(0);
            expect(score).toBeLessThanOrEqual(1.0);
        });

        it('should handle perfect matches', (): void => {
            const similarity: number = 1.0;
            const termMatches: number = 5;
            const totalTerms: number = 5;
            const score: number = SearchResult.calculateRelevanceScore(similarity, termMatches, totalTerms);

            expect(score).toBe(1.0);
        });

        it('should handle no matches', (): void => {
            const similarity: number = 0.1;
            const termMatches: number = 0;
            const totalTerms: number = 5;
            const score: number = SearchResult.calculateRelevanceScore(similarity, termMatches, totalTerms);

            expect(score).toBeGreaterThanOrEqual(0);
            expect(score).toBeLessThan(0.5);
        });
    });
});

describe('File Path Utilities', (): void => {
    describe('normalizeFilePath', (): void => {
        it('should normalize file paths consistently', (): void => {
            const path1: string = './folder/file.md';
            const path2: string = 'folder\\file.md';
            const normalized1: string = normalizeFilePath(path1);
            const normalized2: string = normalizeFilePath(path2);

            expect(normalized1).toBe('folder/file.md');
            expect(normalized2).toBe('folder/file.md');
        });

        it('should handle absolute paths', (): void => {
            const absolutePath: string = '/home/user/vault/file.md';
            const normalized: string = normalizeFilePath(absolutePath);

            expect(normalized).toBe('/home/user/vault/file.md');
        });
    });

    describe('isMarkdownFile', (): void => {
        it('should identify markdown files', (): void => {
            expect(isMarkdownFile('test.md')).toBe(true);
            expect(isMarkdownFile('test.markdown')).toBe(true);
            expect(isMarkdownFile('folder/test.md')).toBe(true);
        });

        it('should reject non-markdown files', (): void => {
            expect(isMarkdownFile('test.txt')).toBe(false);
            expect(isMarkdownFile('test.pdf')).toBe(false);
            expect(isMarkdownFile('test')).toBe(false);
        });
    });
});

describe('Text Processing Utilities', (): void => {
    describe('cleanText', (): void => {
        it('should remove markdown formatting', (): void => {
            const markdown: string = '# Title\n\n**Bold** and *italic* text with [link](url)';
            const cleaned: string = cleanText(markdown);

            expect(cleaned).not.toContain('#');
            expect(cleaned).not.toContain('**');
            expect(cleaned).not.toContain('[');
            expect(cleaned).toContain('Title');
            expect(cleaned).toContain('Bold');
        });

        it('should normalize whitespace', (): void => {
            const text: string = 'Text  with\n\nextra   whitespace\t\t';
            const cleaned: string = cleanText(text);

            expect(cleaned).toBe('Text with extra whitespace');
        });
    });

    describe('extractWordCount', (): void => {
        it('should count words accurately', (): void => {
            const text: string = 'This is a test sentence with seven words.';
            const count: number = extractWordCount(text);

            expect(count).toBe(8);
        });

        it('should handle empty text', (): void => {
            const count: number = extractWordCount('');

            expect(count).toBe(0);
        });
    });
});

// Utility function implementations (would be imported from actual utility modules)
function normalizeFilePath(path: string): string {
    return path.replace(/\\/g, '/').replace(/^\.\//, '');
}

function isMarkdownFile(path: string): boolean {
    return /\.md$|\.markdown$/i.test(path);
}

function cleanText(text: string): string {
    return text
        .replace(/#{1,6}\s+/g, '')
        .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/\s+/g, ' ')
        .trim();
}

function extractWordCount(text: string): number {
    if (!text.trim()) return 0;
    return text.trim().split(/\s+/).length;
}