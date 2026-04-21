import { App, Modal, debounce, setIcon } from 'obsidian';
import { SearchResponse, SearchResult, SearchQuery, TextHighlight } from '../../specs/001-obsidian-search-plugin/contracts/search-interface';
import { SearchModal as ISearchModal } from '../../specs/001-obsidian-search-plugin/contracts/ui-interface';
import { SemanticSearchEngine } from '../services/SemanticSearchEngine';

export class SearchModal extends Modal implements ISearchModal {
    private searchEngine: SemanticSearchEngine;
    private searchInput: HTMLInputElement;
    private resultsContainer: HTMLElement;
    private selectedIndex: number = 0;
    private results: SearchResult[] = [];
    private searchHistory: string[] = [];
    private showExcerpts: boolean = true;
    private debouncedSearch: () => void;

    constructor(app: App, searchEngine: SemanticSearchEngine) {
        super(app);
        this.searchEngine = searchEngine;
        this.debouncedSearch = debounce(() => this.performSearch(), 200);
    }

    onOpen(): void {
        const { contentEl, modalEl } = this;
        modalEl.addClass('semantic-search-modal');
        contentEl.empty();

        this.createSearchInput();
        this.createResultsContainer();
        this.searchInput.focus();
    }

    onClose(): void {
        this.contentEl.empty();
        this.results = [];
        this.selectedIndex = 0;
    }

    setQuery(query: string): void {
        if (this.searchInput) {
            this.searchInput.value = query;
            void this.performSearch();
        }
    }

    private createSearchInput(): void {
        const inputContainer = this.contentEl.createEl('div', { cls: 'search-input-container' });

        this.searchInput = inputContainer.createEl('input', {
            type: 'text',
            placeholder: 'Search your notes...',
            cls: 'search-modal-input'
        });

        this.searchInput.addEventListener('input', this.debouncedSearch);
        this.searchInput.addEventListener('keydown', (event: KeyboardEvent) => this.handleKeydown(event));
    }

    private createResultsContainer(): void {
        this.resultsContainer = this.contentEl.createEl('div', { cls: 'search-modal-results' });
    }

    private handleKeydown(event: KeyboardEvent): void {
        if (event.key === 'g' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            this.toggleExcerpts();
            return;
        }

        switch (event.key) {
            case 'ArrowDown': {
                event.preventDefault();
                this.navigateResults(1);
                break;
            }
            case 'ArrowUp': {
                event.preventDefault();
                this.navigateResults(-1);
                break;
            }
            case 'Enter': {
                event.preventDefault();
                this.selectResult();
                break;
            }
            case 'Escape': {
                this.close();
                break;
            }
        }
    }

    private toggleExcerpts(): void {
        this.showExcerpts = !this.showExcerpts;
        const excerpts = this.resultsContainer.querySelectorAll('.result-body');
        for (const el of excerpts) {
            (el as HTMLElement).toggle(this.showExcerpts);
        }
    }

    private navigateResults(direction: number): void {
        if (this.results.length === 0) return;

        this.selectedIndex = Math.max(0, Math.min(this.results.length - 1, this.selectedIndex + direction));
        this.updateSelection();
    }

    private updateSelection(): void {
        const resultElements = this.resultsContainer.querySelectorAll('.search-result');
        for (const [index, el] of resultElements.entries()) {
            el.toggleClass('selected', index === this.selectedIndex);
        }

        const selected = resultElements[this.selectedIndex] as HTMLElement | undefined;
        selected?.scrollIntoView({ behavior: 'auto', block: 'nearest' });
    }

    private selectResult(): void {
        if (this.results[this.selectedIndex]) {
            this.openFile(this.results[this.selectedIndex]);
        }
    }

    private openFile(result: SearchResult): void {
        void this.app.workspace.openLinkText(result.filePath, '', false);
        this.addToHistory(this.searchInput.value);
        this.close();
    }

    private addToHistory(query: string): void {
        if (query && !this.searchHistory.includes(query)) {
            this.searchHistory.unshift(query);
            this.searchHistory = this.searchHistory.slice(0, 10);
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

    private createHighlightedSnippet(
        originalSnippet: string,
        highlights: TextHighlight[],
        maxLength: number = 200
    ): HTMLElement {
        const snippetEl = document.createElement('div');
        snippetEl.className = 'result-body';
        if (!this.showExcerpts) {
            snippetEl.style.display = 'none';
        }

        let snippet = originalSnippet;
        let adjustedHighlights = [...highlights];
        let prefixLength = 0;

        if (snippet.length > maxLength) {
            if (highlights.length > 0) {
                const firstHighlight = highlights[0];
                const contextRadius = Math.floor((maxLength - (firstHighlight.end - firstHighlight.start)) / 2);

                const start = Math.max(0, firstHighlight.start - contextRadius);
                let end = Math.min(snippet.length, firstHighlight.end + contextRadius);

                if (end - start > maxLength) {
                    end = start + maxLength;
                }

                snippet = snippet.slice(start, end);
                prefixLength = start;

                if (start > 0) {
                    snippet = '...' + snippet;
                    prefixLength -= 3;
                }
                if (end < originalSnippet.length) {
                    snippet = snippet + '...';
                }

                adjustedHighlights = highlights
                    .filter(h => h.start < end && h.end > start)
                    .map(h => ({
                        ...h,
                        start: Math.max(0, h.start - prefixLength),
                        end: Math.min(snippet.length, h.end - prefixLength)
                    }));
            } else {
                snippet = snippet.slice(0, maxLength) + '...';
            }
        }

        if (adjustedHighlights.length === 0) {
            snippetEl.textContent = snippet;
            return snippetEl;
        }

        let lastIndex = 0;
        const sortedHighlights = adjustedHighlights.sort((a, b) => a.start - b.start);

        for (const highlight of sortedHighlights) {
            if (highlight.start > lastIndex) {
                snippetEl.append(document.createTextNode(snippet.slice(lastIndex, highlight.start)));
            }

            const mark = document.createElement('span');
            mark.className = `search-highlight search-highlight-${highlight.type}`;
            mark.textContent = snippet.slice(highlight.start, highlight.end);
            snippetEl.append(mark);

            lastIndex = highlight.end;
        }

        if (lastIndex < snippet.length) {
            snippetEl.append(document.createTextNode(snippet.slice(lastIndex)));
        }

        return snippetEl;
    }

    private async performSearch(): Promise<void> {
        const query = this.searchInput.value.trim();

        if (!query) {
            this.clearResults();
            return;
        }

        try {
            const searchQuery: SearchQuery = {
                text: query,
                limit: 20,
                mode: 'hybrid'
            };

            const response: SearchResponse = await this.searchEngine.hybridSearch(searchQuery);
            this.displayResults(response);
        } catch (error) {
            console.error('Modal search failed:', error);
            this.clearResults();
        }
    }

    private displayResults(response: SearchResponse): void {
        this.resultsContainer.empty();
        this.results = response.results;
        this.selectedIndex = 0;

        if (this.results.length === 0) {
            this.resultsContainer.createEl('div', { cls: 'no-results', text: 'No results found' });
            return;
        }

        for (const [index, result] of this.results.entries()) {
            const resultEl = this.resultsContainer.createEl('div', {
                cls: 'search-result',
                attr: { 'data-result-id': result.filePath },
            });

            const titleRow = resultEl.createEl('div', { cls: 'result-title-container' });

            const titleLeft = titleRow.createEl('div', { cls: 'result-title' });

            const iconEl = titleLeft.createEl('span', { cls: 'result-icon' });
            setIcon(iconEl, SearchModal.fileIcon(result.filePath));

            titleLeft.createEl('span', { text: result.title });

            const ext = SearchModal.fileExtension(result.filePath);
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

            const folder = SearchModal.folderPath(result.filePath);
            if (folder) {
                const folderEl = resultEl.createEl('div', { cls: 'result-folder-path' });
                const folderIconEl = folderEl.createEl('span', { cls: 'result-icon' });
                setIcon(folderIconEl, 'folder-open');
                folderEl.createEl('span', { text: folder });
            }

            const snippetEl = this.createHighlightedSnippet(result.snippet, result.highlights);
            resultEl.append(snippetEl);

            resultEl.addEventListener('click', () => this.openFile(result));
            resultEl.addEventListener('mouseenter', () => {
                this.selectedIndex = index;
                this.updateSelection();
            });
        }

        this.updateSelection();
    }

    private clearResults(): void {
        this.resultsContainer.empty();
        this.results = [];
        this.selectedIndex = 0;
    }
}