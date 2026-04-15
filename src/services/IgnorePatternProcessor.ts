import { IgnorePattern } from '../types/ignore-patterns';
import { TFile, Vault } from 'obsidian';
import ignore from 'ignore';

export class IgnorePatternProcessor {
	private vault: Vault;
	private patterns: IgnorePattern[] = [];
	private lastLoadTime: number = 0;
	private readonly CACHE_TTL = 5000; // 5 seconds

	constructor(vault: Vault) {
		this.vault = vault;
	}

	async loadIgnorePatterns(): Promise<IgnorePattern[]> {
		const now = Date.now();
		if (now - this.lastLoadTime < this.CACHE_TTL && this.patterns.length > 0) {
			return this.patterns;
		}

		this.patterns = [];

		// Load .obsidianignore
		await this.loadPatternsFromFile('.obsidianignore');

		// Load .obsidian-search-ignore
		await this.loadPatternsFromFile('.obsidian-search-ignore');

		this.lastLoadTime = now;
		return this.patterns;
	}

	private async loadPatternsFromFile(filename: '.obsidianignore' | '.obsidian-search-ignore'): Promise<void> {
		try {
			const file = this.vault.getAbstractFileByPath(filename);

			// Check if it's a TFile or mock TFile (for testing)
			const isValidFile = file && (
				(file instanceof TFile) ||
				(file.constructor?.name === 'TFile') ||
				(file.path && file.name)
			);

			if (!isValidFile) {
				return;
			}

			const content = await this.vault.read(file as TFile);
			const patterns = this.parseIgnoreFile(content, filename);
			this.patterns.push(...patterns);
		} catch (error) {
			console.warn(`Failed to load ${filename}:`, error);
		}
	}

	parseIgnoreFile(content: string, sourceFile: '.obsidianignore' | '.obsidian-search-ignore'): IgnorePattern[] {
		const patterns: IgnorePattern[] = [];
		const lines = content.split('\n');

		for (const line of lines) {
			const trimmedLine = line.trim();

			if (!trimmedLine || trimmedLine.startsWith('#')) {
				continue;
			}

			patterns.push({
				pattern: trimmedLine,
				sourceFile,
				isValid: true
			});
		}

		return patterns;
	}

	async shouldIndexFile(filePath: string): Promise<boolean> {
		await this.loadIgnorePatterns();

		let patterns = this.patterns.filter(p => p.isValid);
		if (patterns.length === 0) {
			patterns = this.getDefaultIgnorePatterns();
		}

		const validPatterns = patterns.map(p => p.pattern);

		if (validPatterns.length === 0) {
			return true;
		}

		const ig = ignore().add(validPatterns);
		const relativePath = filePath.replace(/^\/+/, '');
		return !ig.ignores(relativePath);
	}

	private getDefaultIgnorePatterns(): IgnorePattern[] {
		const defaultPatterns = [
			'node_modules/',
			'.git/',
			'.obsidian/',
			'dist/',
			'build/',
			'*.js.map',
			'*.min.js',
			'*.bundle.js'
		];

		return defaultPatterns.map(pattern => ({
			pattern,
			sourceFile: '.obsidianignore',
			isValid: true
		}));
	}

	getLoadedPatterns(): IgnorePattern[] {
		return [...this.patterns];
	}

	clearCache(): void {
		this.patterns = [];
		this.lastLoadTime = 0;
	}
}
