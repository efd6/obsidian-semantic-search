import { ItemView, WorkspaceLeaf, debounce, setIcon } from 'obsidian';
import { IndexingStatus } from '../../specs/001-obsidian-search-plugin/contracts/indexing-interface';
import { SearchResponse, SearchResult, SearchQuery } from '../../specs/001-obsidian-search-plugin/contracts/search-interface';
import { SearchUI, SearchView as ISearchView } from '../../specs/001-obsidian-search-plugin/contracts/ui-interface';
import { SemanticSearchEngine } from '../services/SemanticSearchEngine';

export const SEARCH_VIEW_TYPE = 'semantic-search';

export class SearchView extends ItemView implements SearchUI, ISearchView {
    private searchEngine: SemanticSearchEngine;
    private searchInput: HTMLInputElement;
    private resultsContainer: HTMLElement;
    private loadingIndicator: HTMLElement;
    private tagFilters: Set<string> = new Set();
    private suggestionsContainer: HTMLElement;
    private progressContainer: HTMLElement;

    constructor(leaf: WorkspaceLeaf, searchEngine: SemanticSearchEngine) {
        super(leaf);
        this.searchEngine = searchEngine;
    }

    getViewType(): string {
        return SEARCH_VIEW_TYPE;
    }

    getDisplayText(): string {
        return 'Semantic Search';
    }

    async onOpen(): Promise<void> {
        await Promise.resolve(); // Satisfy require-await rule
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('semantic-search-view');

        this.createSearchInput();
        this.createTagFilters();
        this.createProgressDisplay();
        this.createResultsContainer();
    }

    createSearchView(): ISearchView {
        return this;
    }

    show(): void {
        this.containerEl.show();
    }

    hide(): void {
        this.containerEl.hide();
    }

    displayResults(response: SearchResponse): void {
        this.resultsContainer.empty();

        if (response.results.length === 0) {
            this.resultsContainer.createEl('div', { cls: 'no-results', text: 'No results found' });
            return;
        }

        for (const result of response.results) {
            const resultEl = this.resultsContainer.createEl('div', {
                cls: 'search-result',
                attr: { 'data-result-id': result.filePath },
            });

            const titleRow = resultEl.createEl('div', { cls: 'result-title-container' });

            const titleLeft = titleRow.createEl('div', { cls: 'result-title' });

            const iconEl = titleLeft.createEl('span', { cls: 'result-icon' });
            setIcon(iconEl, SearchView.fileIcon(result.filePath));

            const link = titleLeft.createEl('a', {
                text: result.title,
                cls: 'result-link',
                attr: { href: '#' },
            });
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.onResultClick(result);
            });

            const ext = SearchView.fileExtension(result.filePath);
            if (ext) {
                titleLeft.createEl('span', { cls: 'result-extension', text: `.${ext}` });
            }

            if (result.highlights.length > 0) {
                const label = result.highlights.length === 1 ? 'match' : 'matches';
                titleRow.createEl('span', {
                    cls: 'result-counter',
                    text: `${result.highlights.length} ${label}`,
                });
            }

            const folder = SearchView.folderPath(result.filePath);
            if (folder) {
                const folderEl = resultEl.createEl('div', { cls: 'result-folder-path' });
                const folderIconEl = folderEl.createEl('span', { cls: 'result-icon' });
                setIcon(folderIconEl, 'folder-open');
                folderEl.createEl('span', { text: folder });
            }

            const snippetEl = resultEl.createEl('div', { cls: 'result-body' });
            this.renderSnippetWithHighlights(snippetEl, result);

            if (result.tags.length > 0) {
                const tagsEl = resultEl.createEl('div', { cls: 'result-tags' });
                for (const tag of result.tags) {
                    tagsEl.createEl('span', { cls: 'tag', text: `#${tag}` });
                }
            }
        }

        this.resultsContainer.createEl('div', {
            cls: 'search-stats',
            text: `${response.totalMatches} results (${response.searchTime}ms)`
        });
    }

    onResultClick(result: SearchResult): void {
        void this.app.workspace.openLinkText(result.filePath, '', false);
    }

    showSuggestions(suggestions: string[]): void {
        this.suggestionsContainer.empty();

        if (suggestions.length === 0) {
            this.suggestionsContainer.hide();
            return;
        }

        for (const suggestion of suggestions) {
            const suggestionEl = this.suggestionsContainer.createEl('div', {
                cls: 'suggestion',
                text: suggestion
            });
            suggestionEl.addEventListener('click', () => {
                this.searchInput.value = suggestion;
                void this.performSearch();
                this.suggestionsContainer.hide();
            });
        }

        this.suggestionsContainer.show();
    }

    updateIndexingProgress(status: IndexingStatus): void {
        if (status.isIndexing) {
            const percent = (status.progress.processedCount / status.progress.totalCount * 100).toFixed(0);
            this.progressContainer.setText(`Indexing: ${percent}% (${status.progress.currentDocument})`);
            this.progressContainer.show();
        } else {
            this.progressContainer.hide();
        }
    }

    focus(): void {
        this.searchInput.focus();
    }

    clearResults(): void {
        this.resultsContainer.empty();
    }

    setLoading(loading: boolean): void {
        if (loading) {
            this.loadingIndicator.show();
        } else {
            this.loadingIndicator.hide();
        }
    }

    private createSearchInput(): void {
        const searchContainer = this.contentEl.createEl('div', { cls: 'search-container' });

        this.searchInput = searchContainer.createEl('input', {
            type: 'text',
            placeholder: 'Search your notes...',
            cls: 'search-input'
        });

        this.suggestionsContainer = searchContainer.createEl('div', { cls: 'suggestions-container' });
        this.suggestionsContainer.hide();

        const debouncedSearch = debounce(() => this.performSearch(), 300);
        const debouncedSuggestions = debounce(() => this.getSuggestions(), 150);

        this.searchInput.addEventListener('input', () => {
            debouncedSuggestions();
            debouncedSearch();
        });

        this.searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                void this.performSearch();
                this.suggestionsContainer.hide();
            }
        });
    }

    private createTagFilters(): void {
        const filtersContainer = this.contentEl.createEl('div', { cls: 'filters-container' });
        filtersContainer.createEl('div', { cls: 'filter-label', text: 'Tags:' });

        // This would typically load available tags from the search engine
        // For now, showing basic filter interface
        const tagInput = filtersContainer.createEl('input', {
            type: 'text',
            placeholder: 'Add tag filter...',
            cls: 'tag-filter-input'
        });

        tagInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const tag = tagInput.value.trim();
                if (tag && !this.tagFilters.has(tag)) {
                    this.addTagFilter(tag);
                    tagInput.value = '';
                }
            }
        });
    }

    private createProgressDisplay(): void {
        this.progressContainer = this.contentEl.createEl('div', { cls: 'progress-container' });
        this.progressContainer.hide();
    }

    private createResultsContainer(): void {
        const resultsWrapper = this.contentEl.createEl('div', { cls: 'results-wrapper' });

        this.loadingIndicator = resultsWrapper.createEl('div', {
            cls: 'loading-indicator',
            text: 'Searching...'
        });
        this.loadingIndicator.hide();

        this.resultsContainer = resultsWrapper.createEl('div', { cls: 'results-container' });
    }

    private addTagFilter(tag: string): void {
        this.tagFilters.add(tag);
        void this.performSearch(); // Refresh results with new filter
    }

    private async performSearch(): Promise<void> {
        const query = this.searchInput.value.trim();
        if (!query) {
            this.clearResults();
            return;
        }

        this.setLoading(true);

        try {
            const searchQuery: SearchQuery = {
                text: query,
                tags: [...this.tagFilters],
                limit: 20,
                mode: 'hybrid'
            };

            const response = await this.searchEngine.hybridSearch(searchQuery);
            this.displayResults(response);
        } catch (error) {
            console.error('Search failed:', error);
            this.resultsContainer.empty();
            this.resultsContainer.createEl('div', {
                cls: 'error',
                text: 'Search failed. Please try again.'
            });
        } finally {
            this.setLoading(false);
        }
    }

    private async getSuggestions(): Promise<void> {
        const query = this.searchInput.value.trim();
        if (query.length < 2) {
            this.suggestionsContainer.hide();
            return;
        }

        try {
            const suggestions = await this.searchEngine.getSuggestions(query);
            this.showSuggestions(suggestions);
        } catch (error) {
            console.error('Failed to get suggestions:', error);
        }
    }

    private static fileIcon(filePath: string): string {
        const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
        switch (ext) {
            case 'pdf': return 'file-text';
            case 'png': case 'jpg': case 'jpeg': case 'gif': case 'webp': case 'svg': return 'image';
            case 'canvas': return 'layout-dashboard';
            default: return 'file';
        }
    }

    private static folderPath(filePath: string): string {
        const lastSlash = filePath.lastIndexOf('/');
        return lastSlash > 0 ? filePath.slice(0, lastSlash) : '';
    }

    private static fileExtension(filePath: string): string {
        const dot = filePath.lastIndexOf('.');
        return dot >= 0 ? filePath.slice(dot + 1) : '';
    }

    private renderSnippetWithHighlights(container: HTMLElement, result: SearchResult): void {
        const snippet = result.snippet;
        let offset = 0;

        for (const highlight of result.highlights) {
            const before = snippet.slice(offset, highlight.start);
            const highlighted = snippet.slice(highlight.start, highlight.end);

            if (before) container.appendText(before);

            container.createEl('span', {
                text: highlighted,
                cls: `search-highlight search-highlight-${highlight.type}`
            });

            offset = highlight.end;
        }

        if (offset < snippet.length) {
            container.appendText(snippet.slice(Math.max(0, offset)));
        }
    }
}