/**
 * Integration tests for saving the search index to a file and restoring it.
 * Uses the real PersistedIndex, DocumentIndexer, SemanticSearchEngine,
 * Document and Chunk; only the embedding model and the vault are replaced.
 */

import { DataAdapter, Vault } from 'obsidian';
import { PersistedIndex } from '../../src/services/PersistedIndex';
import { DocumentIndexer } from '../../src/services/DocumentIndexer';
import { SemanticSearchEngine } from '../../src/services/SemanticSearchEngine';

jest.mock('../../src/services/EmbeddingEngine', () => {
  const engine = {
    initialize: jest.fn(() => Promise.resolve()),
    generateEmbedding: jest.fn(() => Promise.resolve(new Float32Array(512))),
    clearCache: jest.fn(),
  };
  return { EmbeddingEngine: { getInstance: (): typeof engine => engine } };
});

const indexPath = '.obsidian/plugins/semantic-search-plugin/index.json';

// testAdapter is an in-memory DataAdapter holding the plugin's files.
function newTestAdapter(): { files: Map<string, string>; adapter: DataAdapter } {
  const files = new Map<string, string>();
  const adapter = {
    exists: jest.fn((p: string) => Promise.resolve(files.has(p))),
    read: jest.fn((p: string) => Promise.resolve(files.get(p) ?? '')),
    write: jest.fn((p: string, data: string) => {
      files.set(p, data);
      return Promise.resolve();
    }),
    remove: jest.fn((p: string) => {
      files.delete(p);
      return Promise.resolve();
    }),
    rename: jest.fn((from: string, to: string) => {
      if (files.has(to)) return Promise.reject(new Error('destination exists'));
      files.set(to, files.get(from) ?? '');
      files.delete(from);
      return Promise.resolve();
    }),
  } as unknown as DataAdapter;
  return { files, adapter };
}

function newTestVault(notes: Record<string, string>): Vault {
  const file = (path: string): object => ({ path, name: path, extension: 'md', stat: { ctime: 0, mtime: 0 } });
  return {
    getMarkdownFiles: (): object[] => Object.keys(notes).map(file),
    getAbstractFileByPath: (path: string): object | null => (path in notes ? file(path) : null),
    read: (f: { path: string }): Promise<string> => Promise.resolve(notes[f.path]),
    on: jest.fn(),
    off: jest.fn(),
  } as unknown as Vault;
}

// embedder returns an embedding that depends on the text, so a round trip can
// be checked value for value.
function newEmbedder(): { generateEmbedding: jest.Mock } {
  return {
    generateEmbedding: jest.fn((text: string) => {
      const e = new Float32Array(512);
      for (let i = 0; i < e.length; i++) e[i] = Math.sin(text.length + i);
      return Promise.resolve(e);
    }),
  };
}

function newSetup(notes: Record<string, string>, adapter: DataAdapter, chunkSize = 1800): {
  engine: SemanticSearchEngine;
  indexer: DocumentIndexer;
  persisted: PersistedIndex;
  embedder: { generateEmbedding: jest.Mock };
} {
  const engine = new SemanticSearchEngine();
  const indexer = new DocumentIndexer(newTestVault(notes));
  const embedder = newEmbedder();
  indexer.searchEngine = engine;
  indexer.embeddingEngine = embedder;
  indexer.chunkSize = chunkSize;
  const persisted = new PersistedIndex(adapter, indexPath, engine, () => indexer.chunkSize);
  engine.onChange = (): void => persisted.changed();
  return { engine, indexer, persisted, embedder };
}

function snapshot(engine: SemanticSearchEngine): object {
  return {
    documents: engine.getDocuments()
      .map(d => ({ path: d.filePath, title: d.title, tags: d.tags, hash: d.contentHash }))
      .sort((a, b) => a.path.localeCompare(b.path)),
    chunks: engine.getChunks()
      .map(c => ({ id: c.id, content: c.content, start: c.startOffset, end: c.endOffset, embedding: [...c.embedding] }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  };
}

describe('PersistedIndex', () => {
  const notes = {
    'a.md': '# Alpha\nalpha content #tag-one',
    'b.md': `bravo ${'long text. '.repeat(300)}`,
  };

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('restores exactly what was saved', async () => {
    const { files, adapter } = newTestAdapter();
    const first = newSetup(notes, adapter);
    await first.persisted.start(true);
    await first.indexer.indexVault();
    await first.persisted.flush();
    expect(files.has(indexPath)).toBe(true);
    expect(files.has(`${indexPath}.tmp`)).toBe(false);

    const second = newSetup(notes, adapter);
    const restored = await second.persisted.start(true);

    expect(restored).toBe(2);
    expect(second.engine.getChunkCount()).toBeGreaterThan(2);
    expect(snapshot(second.engine)).toEqual(snapshot(first.engine));
  });

  it('after a restore, only notes that changed are embedded again', async () => {
    const { adapter } = newTestAdapter();
    const first = newSetup(notes, adapter);
    await first.persisted.start(true);
    await first.indexer.indexVault();
    await first.persisted.flush();

    const changed = { ...notes, 'a.md': 'alpha content, edited' };
    const second = newSetup(changed, adapter);
    await second.persisted.start(true);
    await second.indexer.indexVault();

    expect(second.embedder.generateEmbedding.mock.calls).toEqual([['alpha content, edited']]);
  });

  it('saves on its own once the index stops changing', async () => {
    jest.useFakeTimers();
    const { files, adapter } = newTestAdapter();
    const { indexer, persisted } = newSetup(notes, adapter);
    await persisted.start(true);

    await indexer.indexDocument('a.md');
    expect(files.has(indexPath)).toBe(false);

    await jest.runOnlyPendingTimersAsync();
    expect(files.has(indexPath)).toBe(true);
  });

  it('writes nothing while disabled, and deletes a saved index left behind', async () => {
    const { files, adapter } = newTestAdapter();
    files.set(indexPath, '{"left":"behind"}');
    const { indexer, persisted } = newSetup(notes, adapter);

    await persisted.start(false);
    expect(files.has(indexPath)).toBe(false);

    await indexer.indexVault();
    await persisted.flush();
    expect(files.size).toBe(0);
  });

  it('turning persistence on saves at once, and turning it off deletes the file', async () => {
    const { files, adapter } = newTestAdapter();
    const { indexer, persisted } = newSetup(notes, adapter);
    await persisted.start(false);
    await indexer.indexVault();

    await persisted.setEnabled(true);
    expect(files.get(indexPath)).toContain('alpha content');

    await persisted.setEnabled(false);
    expect(files.size).toBe(0);
  });

  it('turning persistence on before start does not overwrite the saved index', async () => {
    const { files, adapter } = newTestAdapter();
    const first = newSetup(notes, adapter);
    await first.persisted.start(true);
    await first.indexer.indexVault();
    await first.persisted.flush();
    const saved = files.get(indexPath);

    // A settings change can arrive before Obsidian's layout is ready.
    const second = newSetup(notes, adapter);
    await second.persisted.setEnabled(true);
    expect(files.get(indexPath)).toBe(saved);

    expect(await second.persisted.start(true)).toBe(2);
  });

  it('turning persistence off deletes the saved index even before start', async () => {
    const { files, adapter } = newTestAdapter();
    files.set(indexPath, '{}');
    const { persisted } = newSetup(notes, adapter);

    await persisted.setEnabled(false);

    expect(files.size).toBe(0);
  });

  it('discards a saved index made with a different chunk size', async () => {
    const { files, adapter } = newTestAdapter();
    const first = newSetup(notes, adapter, 1800);
    await first.persisted.start(true);
    await first.indexer.indexVault();
    await first.persisted.flush();

    const second = newSetup(notes, adapter, 900);
    expect(await second.persisted.start(true)).toBe(0);
    expect(second.engine.getDocumentCount()).toBe(0);
    expect(files.has(indexPath)).toBe(false);
  });

  it.each([
    ['is not JSON', (): string => '{not json'],
    ['has a document that fails validation', (saved: string): string => saved.replace('"path":"b.md"', '"path":"b.txt"')],
    ['has an embedding of the wrong size', (saved: string): string => saved.replace(/"embedding":"[^"]+"/, '"embedding":"AAAAAA=="')],
  ])('discards a saved index that %s, adding nothing', async (_, damage) => {
    const { files, adapter } = newTestAdapter();
    const first = newSetup(notes, adapter);
    await first.persisted.start(true);
    await first.indexer.indexVault();
    await first.persisted.flush();
    files.set(indexPath, damage(files.get(indexPath) ?? ''));

    const second = newSetup(notes, adapter);
    expect(await second.persisted.start(true)).toBe(0);
    expect(second.engine.getDocumentCount()).toBe(0);
    expect(second.engine.getChunkCount()).toBe(0);
    expect(files.has(indexPath)).toBe(false);
  });

  it('remove deletes the saved index and cancels a pending save', async () => {
    jest.useFakeTimers();
    const { files, adapter } = newTestAdapter();
    const { indexer, persisted } = newSetup(notes, adapter);
    await persisted.start(true);
    await indexer.indexVault();
    await persisted.flush();

    await indexer.indexDocument('a.md'); // Unchanged, so no save is scheduled...
    persisted.changed(); // ...so schedule one.
    await persisted.remove();
    await jest.runOnlyPendingTimersAsync();

    expect(files.size).toBe(0);
  });
});
