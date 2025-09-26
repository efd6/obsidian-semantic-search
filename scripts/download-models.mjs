#!/usr/bin/env node

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MODEL_NAME = 'all-MiniLM-L6-v2';
const HF_MODEL_ID = 'sentence-transformers/all-MiniLM-L6-v2';
const MODELS_DIR = join(__dirname, '..', 'models');

// Hugging Face model files to download for offline operation
const MODEL_FILES = [
    'config.json',
    'tokenizer.json',
    'tokenizer_config.json',
    'pytorch_model.bin',
    'vocab.txt',
    'onnx/model.onnx',
    'onnx/model_quantized.onnx'
];

const downloadFile = async (url, filePath) => {
    console.log(`Downloading ${url}...`);

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const buffer = await response.arrayBuffer();
        const uint8Array = new Uint8Array(buffer);

        // Ensure directory exists
        mkdirSync(dirname(filePath), { recursive: true });

        writeFileSync(filePath, uint8Array);
        console.log(`✓ Downloaded: ${filePath}`);
    } catch (error) {
        console.error(`✗ Failed to download ${url}:`, error.message);
        throw error;
    }
};

const downloadModel = async () => {
    console.log(`\n🤖 Downloading AI model: ${MODEL_NAME}`);
    console.log(`📁 Target directory: ${MODELS_DIR}\n`);

    // Ensure models directory exists
    if (!existsSync(MODELS_DIR)) {
        mkdirSync(MODELS_DIR, { recursive: true });
    }

    let successCount = 0;
    let failCount = 0;

    for (const file of MODEL_FILES) {
        const url = `https://huggingface.co/${HF_MODEL_ID}/resolve/main/${file}`;
        const filePath = join(MODELS_DIR, MODEL_NAME, file);

        try {
            await downloadFile(url, filePath);
            successCount++;
        } catch (error) {
            failCount++;
            console.warn(`⚠ Skipping ${file} (may not be required for this model)`);
        }
    }

    // Download model metadata
    try {
        const metadataUrl = `https://huggingface.co/api/models/${HF_MODEL_ID}`;
        const metadataPath = join(MODELS_DIR, MODEL_NAME, 'model_info.json');
        await downloadFile(metadataUrl, metadataPath);
        successCount++;
    } catch (error) {
        console.warn('⚠ Could not download model metadata');
        failCount++;
    }

    console.log(`\n📊 Download Summary:`);
    console.log(`   ✓ Success: ${successCount} files`);
    console.log(`   ✗ Failed: ${failCount} files`);

    if (successCount > 0) {
        console.log(`\n🎉 Model download completed!`);
        console.log(`   Location: ${join(MODELS_DIR, MODEL_NAME)}`);
        console.log(`   Ready for offline operation\n`);

        // Create index file for easier imports
        const indexContent = `// AI Model Index
export const MODEL_PATH = '${MODEL_NAME}';
export const MODEL_CONFIG = {
    name: '${MODEL_NAME}',
    huggingface_id: '${HF_MODEL_ID}',
    dimensions: 384,
    max_seq_length: 512,
    downloaded: '${new Date().toISOString()}'
};
`;
        writeFileSync(join(MODELS_DIR, 'index.js'), indexContent);
        console.log(`📋 Created model index at models/index.js`);
    } else {
        console.error(`\n❌ Model download failed!`);
        console.error(`   No files were successfully downloaded`);
        process.exit(1);
    }
};

// Validate environment
const validateEnvironment = () => {
    if (typeof fetch === 'undefined') {
        console.error('❌ Error: fetch is not available');
        console.error('   Please use Node.js 18+ or install a fetch polyfill');
        process.exit(1);
    }
};

// Main execution
const main = async () => {
    console.log('🚀 Obsidian Semantic Search - Model Downloader');
    console.log('===============================================');

    validateEnvironment();

    try {
        await downloadModel();
    } catch (error) {
        console.error('\n💥 Unexpected error:', error.message);
        process.exit(1);
    }
};

// Handle command line execution
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}