/**
 * Integration tests for what ends up in, and what is removed from, the search
 * index. Uses the real DocumentIndexer, Document, Chunk, SemanticSearchEngine
 * and IgnorePatternProcessor; only the embedding model is replaced.
 */

import { Vault } from 'obsidian';
import { DocumentIndexer } from '../../src/services/DocumentIndexer';
import { SemanticSearchEngine } from '../../src/services/SemanticSearchEngine';
import { IgnorePatternProcessor } from '../../src/services/IgnorePatternProcessor';

jest.mock('../../src/services/EmbeddingEngine', () => {
  const engine = {
    initialize: jest.fn(() => Promise.resolve()),
    generateEmbedding: jest.fn(() => Promise.resolve(new Float32Array(512).fill(0.1))),
    clearCache: jest.fn(),
  };
  return { EmbeddingEngine: { getInstance: (): typeof engine => engine } };
});

// testVault holds markdown notes in files and dot-path files (such as the
// ignore files) in dotfiles, which, as in Obsidian, are only reachable through
// the adapter.
interface testVault {
  files: Record<string, string>;
  dotfiles: Record<string, string>;
  vault: Vault;
}

function newTestVault(files: Record<string, string>, dotfiles: Record<string, string> = {}): testVault {
  const file = (path: string): object => ({
    path,
    name: path.split('/').pop(),
    extension: 'md',
    stat: { ctime: 0, mtime: 0 },
  });
  const vault = {
    getMarkdownFiles: (): object[] => Object.keys(files).map(file),
    getAbstractFileByPath: (path: string): object | null => (path in files ? file(path) : null),
    read: (f: { path: string }): Promise<string> => Promise.resolve(files[f.path]),
    adapter: {
      exists: (path: string): Promise<boolean> => Promise.resolve(path in dotfiles),
      read: (path: string): Promise<string> => Promise.resolve(dotfiles[path]),
    },
    on: jest.fn(),
    off: jest.fn(),
  } as unknown as Vault;
  return { files, dotfiles, vault };
}

function newIndexer(tv: testVault): { indexer: DocumentIndexer; engine: SemanticSearchEngine; ignore: IgnorePatternProcessor } {
  const engine = new SemanticSearchEngine();
  const ignore = new IgnorePatternProcessor(tv.vault);
  const indexer = new DocumentIndexer(tv.vault);
  indexer.searchEngine = engine;
  indexer.ignorePatternProcessor = ignore;
  return { indexer, engine, ignore };
}

function indexedPaths(engine: SemanticSearchEngine): string[] {
  const docs = (engine as unknown as { documents: Map<string, { filePath: string }> }).documents;
  return [...docs.values()].map(d => d.filePath).sort();
}

function indexedText(engine: SemanticSearchEngine): string {
  const chunks = (engine as unknown as { chunks: Map<string, { content: string }> }).chunks;
  return [...chunks.values()].map(c => c.content).join('\n');
}

describe('index hygiene', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('ignore rules', () => {
    it('indexDocument does not index an ignored note', async () => {
      const tv = newTestVault(
        { 'private/secret.md': 'secret content', 'notes/public.md': 'public content' },
        { '.obsidian-search-ignore': 'private/' },
      );
      const { indexer, engine } = newIndexer(tv);

      // FileWatcher calls indexDocument directly for created, modified and
      // renamed notes, so the rules must hold here, not only in indexVault.
      await indexer.indexDocument('private/secret.md');
      await indexer.indexDocument('notes/public.md');

      expect(indexedPaths(engine)).toEqual(['notes/public.md']);
    });

    it('re-indexing a note that has become ignored removes it', async () => {
      const tv = newTestVault({ 'notes/a.md': 'some content' });
      const { indexer, engine, ignore } = newIndexer(tv);

      await indexer.indexDocument('notes/a.md');
      expect(indexedPaths(engine)).toEqual(['notes/a.md']);

      tv.dotfiles['.obsidian-search-ignore'] = 'notes/';
      ignore.clearCache();
      await indexer.indexDocument('notes/a.md');

      expect(indexedPaths(engine)).toEqual([]);
      expect(engine.getChunkCount()).toBe(0);
    });

    it('indexVault removes notes that have become ignored', async () => {
      const tv = newTestVault({ 'notes/a.md': 'aaa', 'private/b.md': 'bbb' });
      const { indexer, engine, ignore } = newIndexer(tv);

      await indexer.indexVault();
      expect(indexedPaths(engine)).toEqual(['notes/a.md', 'private/b.md']);

      tv.dotfiles['.obsidian-search-ignore'] = 'private/';
      ignore.clearCache();
      await indexer.indexVault();

      expect(indexedPaths(engine)).toEqual(['notes/a.md']);
      expect(indexedText(engine)).not.toContain('bbb');
    });
  });

  describe('document IDs', () => {
    it('keeps notes whose paths collided under the old 32-bit hash apart', async () => {
      // "Aa" and "BB" have the same String.hashCode-style hash.
      const tv = newTestVault({ 'Aa.md': 'alpha content', 'BB.md': 'bravo content' });
      const { indexer, engine } = newIndexer(tv);

      await indexer.indexVault();

      expect(indexedPaths(engine)).toEqual(['Aa.md', 'BB.md']);
      expect(indexedText(engine)).toContain('alpha content');
      expect(indexedText(engine)).toContain('bravo content');
    });

    it('removeDocument removes the note it is given and no other', async () => {
      const tv = newTestVault({ 'Aa.md': 'alpha content', 'BB.md': 'bravo content' });
      const { indexer, engine } = newIndexer(tv);

      await indexer.indexVault();
      await indexer.removeDocument('Aa.md');

      expect(indexedPaths(engine)).toEqual(['BB.md']);
    });
  });

});
