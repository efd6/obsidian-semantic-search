export class TagValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TagValidationError';
  }
}

export interface ITag {
  name: string;
  displayName: string;
  documentCount: number;
  firstSeen: Date;
  lastSeen: Date;
  category?: string;
}

export class Tag implements ITag {
  public readonly name: string;
  public readonly displayName: string;
  public documentCount: number;
  public firstSeen: Date;
  public lastSeen: Date;
  public category?: string;

  private static readonly TAG_FORMAT_REGEX = /^[\w-]+$/;

  constructor(data: ITag) {
    if (!Tag.isValidTagFormat(data.name)) {
      throw new TagValidationError(`Invalid tag format: ${data.name}`);
    }
    if (data.documentCount < 1) {
      throw new TagValidationError(`Document count must be >= 1, got: ${data.documentCount}`);
    }
    if (!data.displayName.startsWith('#')) {
      throw new TagValidationError(`Display name must start with '#', got: ${data.displayName}`);
    }
    if (new Date(data.lastSeen) < new Date(data.firstSeen)) {
      throw new TagValidationError('lastSeen must be >= firstSeen');
    }

    this.name = data.name;
    this.displayName = data.displayName;
    this.documentCount = data.documentCount;
    this.firstSeen = new Date(data.firstSeen);
    this.lastSeen = new Date(data.lastSeen);
    this.category = data.category;
  }

  public static isValidTagFormat(tagName: string): boolean {
    return typeof tagName === 'string' && tagName.length > 0 && Tag.TAG_FORMAT_REGEX.test(tagName);
  }

  public static fromRawTag(rawTag: string, firstSeen: Date = new Date()): Tag {
    const name = rawTag.startsWith('#') ? rawTag.slice(1) : rawTag;
    return new Tag({
      name,
      displayName: `#${name}`,
      documentCount: 1,
      firstSeen,
      lastSeen: firstSeen,
    });
  }

  public incrementDocumentCount(): void {
    this.documentCount++;
    this.lastSeen = new Date();
  }

  public decrementDocumentCount(): void {
    if (this.documentCount <= 1) {
      throw new TagValidationError('Cannot decrement document count below 1');
    }
    this.documentCount--;
  }

  public updateLastSeen(date: Date = new Date()): void {
    if (date < this.firstSeen) {
      throw new TagValidationError('Cannot set lastSeen before firstSeen');
    }
    this.lastSeen = date;
  }

  public isActive(daysThreshold: number = 30): boolean {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - daysThreshold);
    return this.lastSeen >= threshold;
  }

  public getDaysSinceLastSeen(): number {
    const diffTime = Date.now() - this.lastSeen.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  public getUsageFrequency(): 'high' | 'medium' | 'low' {
    return this.documentCount >= 50 ? 'high' : (this.documentCount >= 10 ? 'medium' : 'low');
  }

  public toJSON(): ITag {
    return {
      name: this.name,
      displayName: this.displayName,
      documentCount: this.documentCount,
      firstSeen: this.firstSeen,
      lastSeen: this.lastSeen,
      category: this.category
    };
  }

  public static filterByCategory(tags: Tag[], category?: string): Tag[] {
    return category ? tags.filter(tag => tag.category === category) : tags.filter(tag => !tag.category);
  }

  public static sortByUsage(tags: Tag[], descending: boolean = true): Tag[] {
    return [...tags].sort((a, b) =>
      descending ? b.documentCount - a.documentCount : a.documentCount - b.documentCount
    );
  }

  public static sortByLastSeen(tags: Tag[], descending: boolean = true): Tag[] {
    return [...tags].sort((a, b) =>
      descending
        ? b.lastSeen.getTime() - a.lastSeen.getTime()
        : a.lastSeen.getTime() - b.lastSeen.getTime()
    );
  }

  public static getTagStatistics(tags: Tag[]): {
    totalTags: number;
    totalDocuments: number;
    averageUsage: number;
    categories: string[];
  } {
    const totalTags = tags.length;
    const totalDocuments = tags.reduce((sum, tag) => sum + tag.documentCount, 0);
    return {
      totalTags,
      totalDocuments,
      averageUsage: totalTags > 0 ? totalDocuments / totalTags : 0,
      categories: [...new Set(tags.map(tag => tag.category).filter((cat): cat is string => cat != null))]
    };
  }
}