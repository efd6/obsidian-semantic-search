import { createHash } from '../utils/crypto';

export enum DocumentState {
  NEW = 'NEW',
  INDEXED = 'INDEXED',
  MODIFIED = 'MODIFIED'
}

export class DocumentValidationError extends Error {
  constructor(field: string, message: string) {
    super(`Document validation failed for ${field}: ${message}`);
    this.name = 'DocumentValidationError';
  }
}

export interface IDocument {
  id: string;
  filePath: string;
  title: string;
  tags: string[];
  content: string;
  wordCount: number;
  createdDate: Date;
  modifiedDate: Date;
  lastIndexed: Date | null;
  checksum: string;
  state: DocumentState;
}

export class Document implements IDocument {
  public readonly id: string;
  public readonly filePath: string;
  public title: string;
  public tags: string[];
  public content: string;
  public wordCount: number;
  public readonly createdDate: Date;
  public modifiedDate: Date;
  public lastIndexed: Date | null;
  public checksum: string;
  public state: DocumentState;

  constructor(data: Omit<IDocument, 'id' | 'checksum' | 'state' | 'lastIndexed'>) {
    this.filePath = data.filePath;
    this.title = data.title;
    this.tags = data.tags;
    this.content = data.content;
    this.wordCount = data.wordCount;
    this.createdDate = data.createdDate;
    this.modifiedDate = data.modifiedDate;
    this.lastIndexed = null;
    this.state = DocumentState.NEW;

    this.id = this.generateId();
    this.checksum = this.calculateChecksum();

    this.validate();
  }

  private generateId(): string {
    return createHash('sha256').update(this.filePath).digest('hex');
  }

  private calculateChecksum(): string {
    const data = `${this.content}${this.modifiedDate.getTime()}`;
    return createHash('md5').update(data).digest('hex');
  }

  public static extractTags(content: string): string[] {
    const tagRegex = /#[\w-]+/g;
    const matches = content.match(tagRegex);
    return matches ? [...new Set(matches.map(tag => tag.slice(1)))] : [];
  }

  public static extractTitle(content: string, filePath: string): string {
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('#') && !trimmed.startsWith('##')) {
        return trimmed.replace(/^#+\s*/, '').trim();
      }
    }
    return filePath.split('/').pop()?.replace('.md', '') ?? 'Untitled';
  }

  public static countWords(content: string): number {
    return content.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  public updateContent(newContent: string, modifiedDate: Date): void {
    this.content = newContent;
    this.modifiedDate = modifiedDate;
    this.wordCount = Document.countWords(newContent);
    this.tags = Document.extractTags(newContent);
    this.title = Document.extractTitle(newContent, this.filePath);
    this.checksum = this.calculateChecksum();

    if (this.state === DocumentState.INDEXED) {
      this.state = DocumentState.MODIFIED;
    }

    this.validate();
  }

  public markAsIndexed(): void {
    this.lastIndexed = new Date();
    this.state = DocumentState.INDEXED;
  }

  public hasChanged(otherChecksum: string): boolean {
    return this.checksum !== otherChecksum;
  }

  private validate(): void {
    if (!this.filePath?.endsWith('.md')) {
      throw new DocumentValidationError('filePath', 'must be absolute path ending with .md');
    }

    if (!this.title || this.title.trim().length === 0) {
      throw new DocumentValidationError('title', 'must not be empty');
    }

    if (this.wordCount < 0) {
      throw new DocumentValidationError('wordCount', 'must be >= 0');
    }

    if (this.modifiedDate < this.createdDate) {
      throw new DocumentValidationError('modifiedDate', 'must be >= createdDate');
    }

    for (const tag of this.tags) {
      if (!/^[\w-]+$/.test(tag)) {
        throw new DocumentValidationError('tags', `invalid tag format: ${tag}`);
      }
    }
  }

  public toJSON(): IDocument {
    return {
      id: this.id,
      filePath: this.filePath,
      title: this.title,
      tags: this.tags,
      content: this.content,
      wordCount: this.wordCount,
      createdDate: this.createdDate,
      modifiedDate: this.modifiedDate,
      lastIndexed: this.lastIndexed,
      checksum: this.checksum,
      state: this.state
    };
  }
}