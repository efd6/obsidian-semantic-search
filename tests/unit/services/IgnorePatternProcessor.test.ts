import { IgnorePatternProcessor } from '../../../src/services/IgnorePatternProcessor';
import { Vault, TFile } from 'obsidian';

class MockVault implements Partial<Vault> {
  private ignoreFiles: { [key: string]: string } = {};

  setIgnoreFile(filename: '.obsidianignore' | '.obsidian-search-ignore', content: string): void {
    this.ignoreFiles[filename] = content;
  }

  // Like Obsidian, paths starting with a dot are not in the vault's file
  // tree, so the ignore files are only reachable through the adapter.
  getAbstractFileByPath(): TFile | null {
    return null;
  }

  adapter = {
    exists: async (path: string): Promise<boolean> => path in this.ignoreFiles,
    read: async (path: string): Promise<string> => {
      const content = this.ignoreFiles[path];
      if (content === undefined) throw new Error(`File not found: ${path}`);
      return content;
    },
  } as unknown as Vault['adapter'];
}

describe('IgnorePatternProcessor', (): void => {
  let mockVault: MockVault;
  let processor: IgnorePatternProcessor;

  beforeEach((): void => {
    mockVault = new MockVault();
    processor = new IgnorePatternProcessor(mockVault as unknown as Vault);
  });

  describe('node_modules directory ignore pattern', (): void => {
    beforeEach((): void => {
      // Set up .obsidianignore with node_modules pattern
      mockVault.setIgnoreFile('.obsidianignore', `# Ignore common build and dependency files
*.js.map
*.min.js
*.bundle.js
node_modules/
.git/
dist/
build/`);
    });

    it('should ignore files in node_modules directory', async (): Promise<void> => {
      const testCases = [
        // Files that should be ignored (return false from shouldIndexFile)
        { path: 'node_modules/argparse/README.md', shouldIndex: false, description: 'nested file in node_modules' },
        { path: 'node_modules/which-boxed-primitive/README.md', shouldIndex: false, description: 'deeply nested file' },
        { path: 'node_modules/.bin/jest', shouldIndex: false, description: 'hidden file in node_modules' },
        { path: 'node_modules/package.json', shouldIndex: false, description: 'root file in node_modules' },
        { path: 'node_modules/lodash/lib/core.js', shouldIndex: false, description: 'deeply nested JS file' },

        // Files that should NOT be ignored (return true from shouldIndexFile)
        { path: 'my-file.md', shouldIndex: true, description: 'regular markdown file' },
        { path: 'src/node_modules.md', shouldIndex: true, description: 'file with node_modules in name' },
        { path: 'docs/about-node-modules.md', shouldIndex: true, description: 'file about node_modules' },
        { path: 'node-modules-info.md', shouldIndex: true, description: 'file starting with node' }
      ];

      for (const testCase of testCases) {
        const result = await processor.shouldIndexFile(testCase.path);
        expect(result).toBe(testCase.shouldIndex);

        if (result !== testCase.shouldIndex) {
          console.error(`Failed for ${testCase.description}: ${testCase.path}`);
          console.error(`Expected shouldIndex: ${testCase.shouldIndex}, got: ${result}`);
        }
      }
    });

    it('should ignore files with different node_modules patterns', async (): Promise<void> => {
      // Test various ways node_modules might appear in paths
      const nodeModulesPaths = [
        'node_modules/react/index.js',
        'node_modules/@types/node/index.d.ts',
        'node_modules/some-package/node_modules/nested-dep/file.js',
        'project/node_modules/dep/file.js'
      ];

      for (const path of nodeModulesPaths) {
        const shouldIndex = await processor.shouldIndexFile(path);
        expect(shouldIndex).toBe(false);
      }
    });

    it('should use default patterns when no ignore files exist', async (): Promise<void> => {
      // Create processor without ignore files
      const emptyVault = new MockVault();
      const processorWithDefaults = new IgnorePatternProcessor(emptyVault as unknown as Vault);

      const shouldIndex = await processorWithDefaults.shouldIndexFile('node_modules/test/file.js');
      expect(shouldIndex).toBe(false);
    });
  });

  describe('pattern parsing edge cases', (): void => {
    it('should handle mixed patterns correctly', async (): Promise<void> => {
      // Create a new processor instance for this test to avoid cache issues
      const testVault = new MockVault();
      testVault.setIgnoreFile('.obsidianignore', `# Mixed patterns
*.tmp
temp/
docs/private/
node_modules/`);
      const testProcessor = new IgnorePatternProcessor(testVault as unknown as Vault);

      const testCases = [
        { path: 'file.tmp', shouldIndex: false },
        { path: 'temp/file.md', shouldIndex: false },
        { path: 'docs/private/secret.md', shouldIndex: false },
        { path: 'node_modules/pkg/file.js', shouldIndex: false },
        { path: 'regular.md', shouldIndex: true }
      ];

      for (const testCase of testCases) {
        const result = await testProcessor.shouldIndexFile(testCase.path);
        expect(result).toBe(testCase.shouldIndex);

        if (result !== testCase.shouldIndex) {
          console.error(`FAILED: ${testCase.path} - expected shouldIndex: ${testCase.shouldIndex}, got: ${result}`);
        }
      }
    });
  });

});