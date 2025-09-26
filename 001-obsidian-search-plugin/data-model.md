# Data Model: Obsidian Semantic Search Plugin

## Core Entities

### Document
**Purpose**: Represents a markdown file in the Obsidian vault with associated metadata

**Fields**:
- `id`: string (unique identifier, likely file path hash)
- `filePath`: string (absolute path to markdown file)
- `title`: string (extracted from first heading or filename)
- `tags`: string[] (hashtags extracted from content, e.g., ["dailies", "meeting"])
- `content`: string (full markdown content)
- `wordCount`: number (total words in document)
- `createdDate`: Date (file creation timestamp)
- `modifiedDate`: Date (last modification timestamp)
- `lastIndexed`: Date (when document was last processed for search index)
- `checksum`: string (for change detection optimization)

**Validation Rules**:
- `filePath` must be absolute and end with `.md`
- `title` must not be empty (fallback to filename without extension)
- `tags` array elements must start with `#` and contain valid tag characters
- `wordCount` must be >= 0
- `modifiedDate` >= `createdDate`
- `lastIndexed` should be updated whenever content changes

**State Transitions**:
- NEW → INDEXED (when first processed)
- INDEXED → MODIFIED (when file changes detected)
- MODIFIED → INDEXED (when re-processing complete)

### Chunk
**Purpose**: Represents a segment of a document for granular search and memory management

**Fields**:
- `id`: string (composite: documentId + chunkIndex)
- `documentId`: string (references parent Document.id)
- `chunkIndex`: number (position within document, 0-based)
- `content`: string (text segment, typically 512 tokens max)
- `startOffset`: number (character position in original document)
- `endOffset`: number (character position in original document)
- `embedding`: Float32Array (semantic vector representation)
- `embeddingVersion`: string (model version used for embedding)

**Validation Rules**:
- `chunkIndex` must be >= 0 and sequential within document
- `content` length should be <= 2048 characters (reasonable chunk size)
- `endOffset` > `startOffset`
- `embedding` dimensions must match model output (384 for all-MiniLM-L6-v2)
- `documentId` must reference valid Document

**Relationships**:
- Belongs to one Document (parent)
- One Document can have many Chunks (children)

### Tag
**Purpose**: Represents hashtag metadata extracted from markdown files for search filtering

**Fields**:
- `name`: string (tag without # prefix, e.g., "dailies")
- `displayName`: string (formatted version, e.g., "#dailies")
- `documentCount`: number (how many documents contain this tag)
- `firstSeen`: Date (when tag was first encountered)
- `lastSeen`: Date (most recent document with this tag)
- `category`: string (optional grouping, e.g., "meeting", "project")

**Validation Rules**:
- `name` must be valid tag format (alphanumeric, hyphens, underscores)
- `documentCount` must be >= 1 (tags with 0 documents should be deleted)
- `lastSeen` >= `firstSeen`
- `displayName` should always start with "#"

### SearchIndex
**Purpose**: Represents the searchable collection of document embeddings and metadata

**Fields**:
- `version`: string (index schema version)
- `modelName`: string (embedding model identifier)
- `modelVersion`: string (specific version of embedding model)
- `dimensions`: number (embedding vector size)
- `documentCount`: number (total indexed documents)
- `chunkCount`: number (total indexed chunks)
- `totalTokens`: number (approximate total content processed)
- `createdDate`: Date (index creation)
- `lastUpdated`: Date (most recent update)
- `isRebuilding`: boolean (index rebuild in progress)

**Validation Rules**:
- `documentCount` and `chunkCount` must be >= 0
- `lastUpdated` >= `createdDate`
- `dimensions` must match model specifications
- Only one index should exist per vault (singleton pattern)

### SearchResult
**Purpose**: Represents a search query response with matched documents and relevance scoring

**Fields**:
- `id`: string (unique result identifier)
- `query`: string (original search query)
- `documentId`: string (matched document reference)
- `chunkId`: string (specific chunk that matched)
- `score`: number (relevance score, 0.0-1.0)
- `snippet`: string (highlighted text excerpt)
- `context`: string (surrounding text for context)
- `matchType`: enum ("semantic" | "keyword" | "hybrid")
- `tags`: string[] (document tags for filtering)
- `filePath`: string (for quick access)
- `timestamp`: Date (when search was performed)

**Validation Rules**:
- `score` must be between 0.0 and 1.0
- `documentId` and `chunkId` must reference valid entities
- `snippet` length should be <= 200 characters
- `matchType` must be one of the defined enum values

**Relationships**:
- References one Document (matched document)
- References one Chunk (specific match location)
- Multiple SearchResults can reference the same Document/Chunk

## Storage Schema

### IndexedDB Structure
```typescript
interface DatabaseSchema {
  documents: {
    key: string; // document.id
    value: Document;
    indexes: {
      filePath: string;
      modifiedDate: Date;
      tags: string[];
    };
  };

  chunks: {
    key: string; // chunk.id
    value: Chunk;
    indexes: {
      documentId: string;
      chunkIndex: number;
    };
  };

  tags: {
    key: string; // tag.name
    value: Tag;
    indexes: {
      documentCount: number;
      lastSeen: Date;
    };
  };

  searchIndex: {
    key: string; // singleton "main"
    value: SearchIndex;
  };
}
```

### Horizontal Partitioning Strategy
- **Documents**: Partition by first letter of filename (26 stores)
- **Chunks**: Partition by document hash modulo 10 (10 stores)
- **Embeddings**: Separate store for vector data to optimize memory usage

## Data Flow Relationships

### Indexing Flow
1. Document detected/changed → Document entity created/updated
2. Document chunked → Chunk entities created
3. Chunks processed → Embeddings generated
4. Tags extracted → Tag entities updated
5. SearchIndex metadata updated

### Search Flow
1. Query input → SearchResult entities generated
2. Embedding similarity → Chunk matches found
3. Chunk matches → Document references resolved
4. Results ranked → Final SearchResult set returned

### Update Flow
1. File change detected → Document.modifiedDate updated
2. Document re-chunked → Old chunks deleted, new ones created
3. Re-embedding → New embeddings generated
4. Tag reconciliation → Tag.documentCount updated
5. SearchIndex.lastUpdated → Timestamp refreshed

This data model provides a robust foundation for semantic search while maintaining efficient storage and query patterns suitable for Obsidian's local storage constraints.