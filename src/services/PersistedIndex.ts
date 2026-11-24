import { DataAdapter } from 'obsidian';
import { Chunk } from '../models/Chunk';
import { Document } from '../models/Document';

// The saved index is tied to the file layout below, to the model that made the
// embeddings and to the chunk size. A file that differs in any of these is
// discarded and the index rebuilt.
const FORMAT = 1;
const MODEL = 'universal-sentence-encoder-lite/1';

// saveDelay is how long the index must go unchanged before it is saved, so
// that indexing many notes leads to one write rather than one per note.
const saveDelay = 10_000;

interface savedChunk {
    content: string;
    start: number;
    end: number;
    embedding: string; // Little-endian float32 values, base64-encoded.
}

interface savedDocument {
    path: string;
    title: string;
    tags: string[];
    created: number;
    modified: number;
    wordCount: number;
    contentHash: string;
    chunks: savedChunk[];
}

interface savedIndex {
    format: number;
    model: string;
    chunkSize: number;
    documents: savedDocument[];
}

// searchIndex is the in-memory index that is saved from and restored into.
export interface searchIndex {
    getDocuments(): Document[];
    getChunks(): Chunk[];
    addDocument(document: Document): void;
    addChunk(chunk: Chunk): void;
}

// PersistedIndex keeps a copy of the search index in a file, so notes don't
// have to be embedded again each time Obsidian starts. The file holds the text
// of every indexed note, so it is only written while enabled, and is deleted
// when persistence is turned off.
export class PersistedIndex {
    private enabled = false;
    // started is set once start has run. Until then the saved index has not
    // been loaded, so saving would overwrite it.
    private started = false;
    private dirty = false;
    private timer: ReturnType<typeof setTimeout> | null = null;

    constructor(
        private adapter: DataAdapter,
        private path: string,
        private index: searchIndex,
        private chunkSize: () => number,
    ) {}

    // start is called once at startup. When enabled, it restores the saved
    // index and returns the number of documents restored. When not, it
    // deletes any saved index left behind.
    async start(enabled: boolean): Promise<number> {
        this.started = true;
        if (!enabled) {
            this.enabled = false;
            await this.remove();
            return 0;
        }
        const restored = await this.load();
        this.enabled = true;
        return restored;
    }

    // setEnabled turns persistence on, saving the index now, or off, deleting
    // the saved copy. It can be called with the current state; turning it off
    // always makes sure no saved copy is left.
    async setEnabled(enabled: boolean): Promise<void> {
        if (!enabled) {
            this.enabled = false;
            await this.remove();
            return;
        }
        if (this.enabled || !this.started) return;
        this.enabled = true;
        this.dirty = true;
        await this.flush();
    }

    // changed records that the index has changed and schedules a save.
    changed(): void {
        if (!this.enabled) return;
        this.dirty = true;
        if (this.timer) clearTimeout(this.timer);
        this.timer = setTimeout(() => void this.flush(), saveDelay);
    }

    // flush saves the index now if it has changed since the last save.
    async flush(): Promise<void> {
        this.cancelTimer();
        if (!this.enabled || !this.dirty) return;
        this.dirty = false;
        await this.save();
    }

    // remove deletes the saved index and drops any pending save.
    async remove(): Promise<void> {
        this.cancelTimer();
        this.dirty = false;
        for (const p of [this.path, this.tmpPath()]) {
            if (await this.adapter.exists(p)) {
                await this.adapter.remove(p);
            }
        }
    }

    private async load(): Promise<number> {
        if (!await this.adapter.exists(this.path)) return 0;

        let entries: { document: Document; chunks: Chunk[] }[];
        try {
            entries = this.decode(JSON.parse(await this.adapter.read(this.path)) as unknown);
        } catch (error) {
            console.warn('Semantic Search: discarding unreadable saved index:', error instanceof Error ? error.message : error);
            await this.remove();
            return 0;
        }

        // Only add to the index once the whole file has been read, so a bad
        // file leaves the index untouched.
        for (const { document, chunks } of entries) {
            this.index.addDocument(document);
            for (const chunk of chunks) {
                this.index.addChunk(chunk);
            }
        }
        return entries.length;
    }

    private decode(data: unknown): { document: Document; chunks: Chunk[] }[] {
        const saved = data as Partial<savedIndex> | null;
        if (saved?.format !== FORMAT || saved.model !== MODEL || saved.chunkSize !== this.chunkSize()) {
            throw new Error('saved index was made with a different format, model or chunk size');
        }
        if (!Array.isArray(saved.documents)) {
            throw new TypeError('saved index has no document list');
        }

        // The Document and Chunk constructors check what they are given, so a
        // damaged or altered file fails here rather than in a search.
        return saved.documents.map(d => {
            const document = new Document({
                filePath: d.path,
                title: d.title,
                tags: d.tags,
                content: '',
                wordCount: d.wordCount,
                createdDate: new Date(d.created),
                modifiedDate: new Date(d.modified),
            });
            if (typeof d.contentHash !== 'string' || !Array.isArray(d.chunks)) {
                throw new TypeError(`saved document ${d.path} is incomplete`);
            }
            document.contentHash = d.contentHash;
            const chunks = d.chunks.map((c, i) =>
                Chunk.create(document.id, i, c.content, c.start, c.end, decodeEmbedding(c.embedding)));
            return { document, chunks };
        });
    }

    private async save(): Promise<void> {
        const chunksByDocument = new Map<string, Chunk[]>();
        for (const chunk of this.index.getChunks()) {
            const list = chunksByDocument.get(chunk.documentId) ?? [];
            list.push(chunk);
            chunksByDocument.set(chunk.documentId, list);
        }

        const saved: savedIndex = {
            format: FORMAT,
            model: MODEL,
            chunkSize: this.chunkSize(),
            documents: this.index.getDocuments().map(d => ({
                path: d.filePath,
                title: d.title,
                tags: d.tags,
                created: d.createdDate.getTime(),
                modified: d.modifiedDate.getTime(),
                wordCount: d.wordCount,
                contentHash: d.contentHash,
                chunks: (chunksByDocument.get(d.id) ?? [])
                    .sort((a, b) => a.chunkIndex - b.chunkIndex)
                    .map(c => ({
                        content: c.content,
                        start: c.startOffset,
                        end: c.endOffset,
                        embedding: encodeEmbedding(c.embedding),
                    })),
            })),
        };

        // Write a new file and then swap it in, so an interrupted save leaves
        // the previous copy or none, never half of one.
        const tmp = this.tmpPath();
        await this.adapter.write(tmp, JSON.stringify(saved));
        if (await this.adapter.exists(this.path)) {
            await this.adapter.remove(this.path);
        }
        await this.adapter.rename(tmp, this.path);
    }

    private tmpPath(): string {
        return `${this.path}.tmp`;
    }

    private cancelTimer(): void {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }
}

function encodeEmbedding(embedding: Float32Array): string {
    const bytes = new Uint8Array(embedding.buffer, embedding.byteOffset, embedding.byteLength);
    let binary = '';
    for (const b of bytes) {
        binary += String.fromCodePoint(b);
    }
    return btoa(binary);
}

function decodeEmbedding(encoded: string): Float32Array {
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.codePointAt(i) ?? 0;
    }
    if (bytes.length % 4 !== 0) {
        throw new Error('saved embedding has a partial value');
    }
    return new Float32Array(bytes.buffer);
}
