/* eslint-disable -- RxDB typing complexity requires relaxed rules for database operations */
import { DataClearOperation } from '../types/data-management';
import { RxDatabase } from 'rxdb';
import { Modal, App, Notice } from 'obsidian';

// searchIndex is the in-memory index that search reads from. clear empties it
// and returns the number of documents removed.
interface searchIndex {
	clear(): number;
}

export class DataManager {
	private app: App;
	private database: RxDatabase<any> | null = null;
	private index: searchIndex | null = null;
	private clearOperation: DataClearOperation = {
		status: 'idle',
		progress: 0,
		itemsCleared: 0
	};

	constructor(app: App, database?: RxDatabase<any>, index?: searchIndex) {
		this.app = app;
		this.database = database ?? null;
		this.index = index ?? null;
	}

	async clearAllData(): Promise<void> {
		if (this.clearOperation.status === 'clearing') {
			throw new Error('Clear operation already in progress');
		}

		this.clearOperation = {
			status: 'clearing',
			progress: 0,
			itemsCleared: 0,
			startTime: new Date()
		};

		try {
			if (!this.database && !this.index) {
				throw new Error('Database not initialized');
			}

			let totalItemsCleared = 0;

			// The in-memory index is what search uses, so clear it first.
			if (this.index) {
				totalItemsCleared += this.index.clear();
			}

			// Clear documents collection
			const documentsCollection = this.database?.collections.documents;
			if (documentsCollection) {
				const documentCount = await documentsCollection.count().exec();
				await documentsCollection.remove();
				totalItemsCleared += documentCount;
				this.clearOperation = {
					...this.clearOperation,
					progress: 33,
					itemsCleared: totalItemsCleared
				};
			}

			// Clear chunks collection
			const chunksCollection = this.database?.collections.chunks;
			if (chunksCollection) {
				const chunkCount = await chunksCollection.count().exec();
				await chunksCollection.remove();
				totalItemsCleared += chunkCount;
				this.clearOperation = {
					...this.clearOperation,
					progress: 66,
					itemsCleared: totalItemsCleared
				};
			}

			// Clear embeddings collection
			const embeddingsCollection = this.database?.collections.embeddings;
			if (embeddingsCollection) {
				const embeddingCount = await embeddingsCollection.count().exec();
				await embeddingsCollection.remove();
				totalItemsCleared += embeddingCount;
				this.clearOperation = {
					...this.clearOperation,
					progress: 100,
					itemsCleared: totalItemsCleared
				};
			}

			this.clearOperation = {
				...this.clearOperation,
				status: 'complete',
				progress: 100,
				itemsCleared: totalItemsCleared
			};

			new Notice(`Successfully cleared ${this.clearOperation.itemsCleared} items from search index`);

		} catch (error) {
			this.clearOperation = {
				...this.clearOperation,
				status: 'failed',
				error: error instanceof Error ? error.message : 'Unknown error occurred'
			};

			new Notice(`Failed to clear search data: ${this.clearOperation.error}`);
			throw error;
		}
	}

	getClearStatus(): DataClearOperation {
		return { ...this.clearOperation };
	}

	async showClearConfirmation(): Promise<boolean> {
		return new Promise((resolve) => {
			new ClearDataConfirmationModal(this.app, (confirmed) => {
				if (confirmed) {
					this.clearOperation = {
						...this.clearOperation,
						status: 'confirming'
					};
				}
				resolve(confirmed);
			}).open();
		});
	}

	resetClearStatus(): void {
		this.clearOperation = {
			status: 'idle',
			progress: 0,
			itemsCleared: 0
		};
	}
}

class ClearDataConfirmationModal extends Modal {
	private onSubmit: (confirmed: boolean) => void;

	constructor(app: App, onSubmit: (confirmed: boolean) => void) {
		super(app);
		this.onSubmit = onSubmit;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Clear Search Index Data' });

		const warningEl = contentEl.createDiv('modal-warning');
		warningEl.createEl('p', {
			text: 'This will permanently delete all stored search data including:'
		});

		const listEl = warningEl.createEl('ul');
		listEl.createEl('li', { text: 'Document embeddings' });
		listEl.createEl('li', { text: 'Text chunks' });
		listEl.createEl('li', { text: 'Search index metadata' });

		warningEl.createEl('p', {
			text: 'Your files will not be affected, but the search index will need to be rebuilt.'
		});

		const buttonContainer = contentEl.createDiv('modal-button-container');

		const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelButton.addEventListener('click', (): void => {
			this.onSubmit(false);
			this.close();
		});

		const confirmButton = buttonContainer.createEl('button', {
			text: 'Clear Data',
			cls: 'mod-warning'
		});
		confirmButton.addEventListener('click', (): void => {
			this.onSubmit(true);
			this.close();
		});

		// Focus the cancel button by default
		cancelButton.focus();
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
/* eslint-enable */