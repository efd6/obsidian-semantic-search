/**
 * Integration tests for what ends up in, and what is removed from, the search
 * index. Uses the real DocumentIndexer, Document, Chunk, SemanticSearchEngine
 * and IgnorePatternProcessor; only the embedding model is replaced.
 */

import { App, Vault } from 'obsidian';
import { DocumentIndexer } from '../../src/services/DocumentIndexer';
import { SemanticSearchEngine } from '../../src/services/SemanticSearchEngine';
import { IgnorePatternProcessor } from '../../src/services/IgnorePatternProcessor';
import { FileWatcher } from '../../src/services/FileWatcher';
import { DataManager } from '../../src/services/DataManager';
import { EmbeddingEngine } from '../../src/services/EmbeddingEngine';

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
    // on returns an EventRef, as in Obsidian, so offref can be checked.
    on: jest.fn((name: string, fn: unknown) => ({ e: vault, name, fn })),
    off: jest.fn(),
    offref: jest.fn(),
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

  describe('re-indexing', () => {
    it('drops text that was removed from a note', async () => {
      // Long enough to span several chunks, so the secret is in a chunk that
      // the shortened note no longer has.
      const filler = 'filler text. '.repeat(300);
      const tv = newTestVault({ 'note.md': `${filler}SECRET-AT-THE-END` });
      const { indexer, engine } = newIndexer(tv);

      await indexer.indexDocument('note.md');
      expect(engine.getChunkCount()).toBeGreaterThan(1);
      expect(indexedText(engine)).toContain('SECRET-AT-THE-END');

      tv.files['note.md'] = 'short note';
      await indexer.indexDocument('note.md');

      expect(indexedText(engine)).not.toContain('SECRET-AT-THE-END');
      expect(engine.getChunkCount()).toBe(1);
    });
  });

  describe('incremental indexing', () => {
    function countingEmbedder(): { generateEmbedding: jest.Mock } {
      return { generateEmbedding: jest.fn(() => Promise.resolve(new Float32Array(512).fill(0.1))) };
    }

    it('does not re-embed notes whose content has not changed', async () => {
      const tv = newTestVault({ 'a.md': 'alpha content', 'b.md': 'bravo content' });
      const { indexer } = newIndexer(tv);
      const embedder = countingEmbedder();
      indexer.embeddingEngine = embedder;

      await indexer.indexVault();
      expect(embedder.generateEmbedding).toHaveBeenCalledTimes(2);

      embedder.generateEmbedding.mockClear();
      await indexer.indexVault();
      expect(embedder.generateEmbedding).not.toHaveBeenCalled();

      tv.files['b.md'] = 'bravo content, edited';
      await indexer.indexVault();
      expect(embedder.generateEmbedding.mock.calls).toEqual([['bravo content, edited']]);
    });

    it('indexVault removes notes whose files no longer exist', async () => {
      const tv = newTestVault({ 'a.md': 'alpha content', 'b.md': 'bravo content' });
      const { indexer, engine } = newIndexer(tv);

      await indexer.indexVault();
      delete tv.files['b.md'];
      await indexer.indexVault();

      expect(indexedPaths(engine)).toEqual(['a.md']);
      expect(indexedText(engine)).not.toContain('bravo');
    });
  });

    describe('chunking', () => {
    it('a chunk size no larger than the overlap still moves through the note', async () => {
      const tv = newTestVault({ 'a.md': 'x'.repeat(1000) });
      const { indexer, engine } = newIndexer(tv);
      indexer.chunkSize = 200;

      const result = await indexer.indexDocument('a.md');

      expect(result.success).toBe(true);
      // Steps of 100 characters over 1,000 characters.
      expect(engine.getChunkCount()).toBe(10);
    });
  });

  describe('embedding failures', () => {
    it('a note whose embedding fails is not indexed with made-up embeddings', async () => {
      const tv = newTestVault({ 'a.md': 'alpha content' });
      const { indexer, engine } = newIndexer(tv);
      indexer.embeddingEngine = { generateEmbedding: () => Promise.reject(new Error('model unavailable')) };

      const result = await indexer.indexDocument('a.md');

      expect(result.success).toBe(false);
      expect(result.error).toContain('model unavailable');
      expect(indexedPaths(engine)).toEqual([]);
    });
  });

  describe('logging', () => {
    it('keeps note paths out of the console unless debug logging is on', async () => {
      const tv = newTestVault(
        { 'health/diagnosis.md': 'private content', 'hidden/plans.md': 'more content' },
        { '.obsidian-search-ignore': 'hidden/' },
      );
      const { indexer } = newIndexer(tv);
      const spies = [
        console.log as jest.Mock,
        jest.spyOn(console, 'warn').mockImplementation(() => {}),
        jest.spyOn(console, 'error').mockImplementation(() => {}),
      ];
      const logged = (): string => spies.flatMap(spy => spy.mock.calls.flat()).map(String).join('\n');

      await indexer.indexVault();
      expect(logged()).not.toMatch(/diagnosis|plans/);

      for (const spy of spies) spy.mockClear();
      indexer.debug = true;
      await indexer.indexVault();
      expect(logged()).toMatch(/health\/diagnosis\.md/);
      expect(logged()).toMatch(/hidden\/plans\.md/);
    });
  });

  describe('vault event handlers', () => {
    it('FileWatcher.stop unregisters every handler that start registered', () => {
      const tv = newTestVault({});
      const watcher = new FileWatcher(tv.vault, newIndexer(tv).indexer);

      watcher.start();
      const refs = (tv.vault.on as jest.Mock).mock.results.map(r => r.value as unknown);
      watcher.stop();

      expect(refs).toHaveLength(4);
      expect((tv.vault.offref as jest.Mock).mock.calls.map(c => c[0] as unknown)).toEqual(refs);
    });

    it('DocumentIndexer.stopFileWatching unregisters every handler that startFileWatching registered', () => {
      const tv = newTestVault({});
      const { indexer } = newIndexer(tv);

      indexer.startFileWatching();
      const refs = (tv.vault.on as jest.Mock).mock.results.map(r => r.value as unknown);
      indexer.stopFileWatching();

      expect(refs).toHaveLength(3);
      expect((tv.vault.offref as jest.Mock).mock.calls.map(c => c[0] as unknown)).toEqual(refs);
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

  describe('clearing', () => {
    it('Clear Search Index Data empties the index that search uses', async () => {
      const tv = newTestVault({ 'a.md': 'alpha content', 'b.md': 'bravo content' });
      const { indexer, engine } = newIndexer(tv);
      await indexer.indexVault();
      expect(engine.getDocumentCount()).toBe(2);

      const dm = new DataManager({} as App, engine);
      await dm.clearAllData();

      expect(engine.getDocumentCount()).toBe(0);
      expect(engine.getChunkCount()).toBe(0);
      const response = await engine.hybridSearch({ text: 'alpha', limit: 10, keywordMatch: 'any' });
      expect(response.results).toEqual([]);
      expect(dm.getClearStatus().itemsCleared).toBe(2);
    });

    it('clearing the index also drops cached embeddings, whose keys are note text', () => {
      const engine = new SemanticSearchEngine();

      engine.clear();

      expect(EmbeddingEngine.getInstance().clearCache).toHaveBeenCalled();
    });
  });
});
