import { IgnorePattern } from '../types/ignore-patterns';
import { TFile, Vault } from 'obsidian';
import * as micromatch from 'micromatch';

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

			// Skip empty lines and comments
			if (!trimmedLine || trimmedLine.startsWith('#')) {
				continue;
			}

			try {
				// Test if the pattern is valid by trying to compile it
				micromatch.makeRe(trimmedLine);

				patterns.push({
					pattern: trimmedLine,
					sourceFile,
					isValid: true
				});
			} catch (error) {
				patterns.push({
					pattern: trimmedLine,
					sourceFile,
					isValid: false,
					parseError: error instanceof Error ? error.message : 'Invalid pattern'
				});
			}
		}

		return patterns;
	}

	async shouldIndexFile(filePath: string): Promise<boolean> {
		await this.loadIgnorePatterns();

		// Add default ignore patterns if no patterns are loaded
		let patterns = this.patterns.filter(p => p.isValid);
		if (patterns.length === 0) {
			patterns = this.getDefaultIgnorePatterns();
		}

		const validPatterns = patterns.map(p => p.pattern);

		if (validPatterns.length === 0) {
			return true;
		}

		// Convert gitignore-style patterns to micromatch-compatible patterns
		const expandedPatterns: string[] = [];
		for (const pattern of validPatterns) {
			if (pattern.endsWith('/')) {
				// For directory patterns like 'node_modules/', create comprehensive patterns
				const dir = pattern.slice(0, -1);
				expandedPatterns.push(
					`${dir}/**`,     // Match everything under the directory at root
					`**/${dir}/**`,  // Match directory anywhere in the path
					dir              // Match the directory itself
				);
			} else if (pattern.includes('/')) {
				// Path patterns
				expandedPatterns.push(pattern);
				if (!pattern.includes('*')) {
					expandedPatterns.push(`${pattern}/**`);
				}
			} else {
				// Filename patterns
				expandedPatterns.push(
					pattern,
					`**/${pattern}`
				);
			}
		}

		// Use micromatch with dot file support
		const isIgnored = micromatch.isMatch(filePath, expandedPatterns, {
			dot: true  // Enable matching of dot files like .bin, .hidden, etc.
		});

		return !isIgnored;
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