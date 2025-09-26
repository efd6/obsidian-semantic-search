#!/usr/bin/env node

import { statSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getDirectorySize = (dirPath) => {
    if (!existsSync(dirPath)) return 0;

    let totalSize = 0;
    const files = readdirSync(dirPath, { withFileTypes: true });

    for (const file of files) {
        const filePath = join(dirPath, file.name);
        if (file.isDirectory()) {
            totalSize += getDirectorySize(filePath);
        } else {
            totalSize += statSync(filePath).size;
        }
    }

    return totalSize;
};

const checkFile = (filePath, name, maxSize = null) => {
    if (!existsSync(filePath)) {
        console.log(`❌ Missing: ${name}`);
        return { exists: false, size: 0 };
    }

    const size = statSync(filePath).size;
    const sizeFormatted = formatBytes(size);

    let status = '✅';
    let warning = '';

    if (maxSize && size > maxSize) {
        status = '⚠️';
        warning = ` (exceeds ${formatBytes(maxSize)})`;
    }

    console.log(`${status} ${name}: ${sizeFormatted}${warning}`);
    return { exists: true, size };
};

const checkDirectory = (dirPath, name, maxSize = null) => {
    if (!existsSync(dirPath)) {
        console.log(`❌ Missing: ${name}`);
        return { exists: false, size: 0 };
    }

    const size = getDirectorySize(dirPath);
    const sizeFormatted = formatBytes(size);

    let status = '✅';
    let warning = '';

    if (maxSize && size > maxSize) {
        status = '⚠️';
        warning = ` (exceeds ${formatBytes(maxSize)})`;
    }

    console.log(`${status} ${name}: ${sizeFormatted}${warning}`);
    return { exists: true, size };
};

const analyzeBundleSize = () => {
    console.log('📊 Bundle Size Analysis');
    console.log('======================\n');

    let totalSize = 0;
    const issues = [];

    // Core bundle files
    const mainJs = checkFile(join(PROJECT_ROOT, 'main.js'), 'Main Bundle', 2 * 1024 * 1024); // 2MB limit
    totalSize += mainJs.size;

    if (mainJs.size > 2 * 1024 * 1024) {
        issues.push('Main bundle exceeds 2MB - consider code splitting');
    }

    // Manifest and styles
    checkFile(join(PROJECT_ROOT, 'manifest.json'), 'Plugin Manifest');
    checkFile(join(PROJECT_ROOT, 'styles.css'), 'Plugin Styles (optional)');

    // AI Models directory
    const modelsDir = checkDirectory(join(PROJECT_ROOT, 'models'), 'AI Models', 50 * 1024 * 1024); // 50MB limit
    totalSize += modelsDir.size;

    if (modelsDir.exists) {
        console.log('\n📁 Model Details:');
        const modelFiles = [
            'all-MiniLM-L6-v2/config.json',
            'all-MiniLM-L6-v2/tokenizer.json',
            'all-MiniLM-L6-v2/onnx/model_quantized.onnx'
        ];

        for (const file of modelFiles) {
            checkFile(join(PROJECT_ROOT, 'models', file), `  ${file}`);
        }
    }

    // Distribution directory (if exists)
    if (existsSync(join(PROJECT_ROOT, 'dist'))) {
        const distSize = checkDirectory(join(PROJECT_ROOT, 'dist'), 'Distribution Files');
        totalSize += distSize.size;
    }

    console.log(`\n📈 Total Plugin Size: ${formatBytes(totalSize)}\n`);

    return { totalSize, issues };
};

const checkOfflineCapability = () => {
    console.log('🔌 Offline Capability Check');
    console.log('===========================\n');

    const checks = [];

    // Check for AI models
    const modelPath = join(PROJECT_ROOT, 'models', 'all-MiniLM-L6-v2');
    if (existsSync(modelPath)) {
        console.log('✅ AI models present for offline operation');

        // Check critical model files
        const criticalFiles = [
            'config.json',
            'tokenizer.json',
            'onnx/model_quantized.onnx'
        ];

        let modelComplete = true;
        for (const file of criticalFiles) {
            const filePath = join(modelPath, file);
            if (existsSync(filePath)) {
                console.log(`   ✅ ${file}`);
            } else {
                console.log(`   ❌ Missing: ${file}`);
                modelComplete = false;
            }
        }

        checks.push({
            name: 'AI Model Completeness',
            passed: modelComplete,
            message: modelComplete ? 'All required model files present' : 'Missing critical model files'
        });
    } else {
        console.log('❌ AI models missing - run "npm run download-models"');
        checks.push({
            name: 'AI Models',
            passed: false,
            message: 'Models not downloaded'
        });
    }

    // Check bundle includes dependencies
    const mainJsPath = join(PROJECT_ROOT, 'main.js');
    if (existsSync(mainJsPath)) {
        const bundleContent = require('fs').readFileSync(mainJsPath, 'utf8');

        // Check for critical dependencies
        const dependencies = [
            { name: 'Transformers.js', pattern: /transformers|@xenova/ },
            { name: 'RxDB', pattern: /rxdb|RxDB/ },
            { name: 'IndexedDB', pattern: /indexedDB|idb/ }
        ];

        for (const dep of dependencies) {
            const found = dep.pattern.test(bundleContent);
            console.log(`${found ? '✅' : '❌'} ${dep.name} bundled`);
            checks.push({
                name: dep.name,
                passed: found,
                message: found ? 'Properly bundled' : 'Missing from bundle'
            });
        }
    } else {
        console.log('❌ Main bundle not found');
        checks.push({
            name: 'Main Bundle',
            passed: false,
            message: 'Bundle file not found'
        });
    }

    console.log('');
    return checks;
};

const generateReport = (bundleAnalysis, offlineChecks) => {
    console.log('📋 Summary Report');
    console.log('=================\n');

    // Bundle size assessment
    if (bundleAnalysis.totalSize < 10 * 1024 * 1024) { // 10MB
        console.log('✅ Bundle size is reasonable for Obsidian plugin');
    } else if (bundleAnalysis.totalSize < 50 * 1024 * 1024) { // 50MB
        console.log('⚠️  Bundle size is large but acceptable');
    } else {
        console.log('❌ Bundle size is too large - optimization needed');
    }

    // Offline capability assessment
    const offlineReady = offlineChecks.every(check => check.passed);
    console.log(`${offlineReady ? '✅' : '❌'} Offline operation: ${offlineReady ? 'Ready' : 'Not ready'}`);

    // Issues summary
    if (bundleAnalysis.issues.length > 0) {
        console.log('\n⚠️  Issues found:');
        bundleAnalysis.issues.forEach((issue, i) => {
            console.log(`   ${i + 1}. ${issue}`);
        });
    }

    const failedChecks = offlineChecks.filter(check => !check.passed);
    if (failedChecks.length > 0) {
        console.log('\n❌ Failed checks:');
        failedChecks.forEach((check, i) => {
            console.log(`   ${i + 1}. ${check.name}: ${check.message}`);
        });
    }

    if (bundleAnalysis.issues.length === 0 && failedChecks.length === 0) {
        console.log('\n🎉 All checks passed! Plugin is ready for offline operation.');
        return true;
    } else {
        console.log('\n🔧 Action required to complete offline preparation.');
        return false;
    }
};

const main = () => {
    console.log('🔍 Obsidian Semantic Search - Bundle Analyzer');
    console.log('===============================================\n');

    const bundleAnalysis = analyzeBundleSize();
    console.log('');
    const offlineChecks = checkOfflineCapability();
    console.log('');
    const success = generateReport(bundleAnalysis, offlineChecks);

    process.exit(success ? 0 : 1);
};

// Handle command line execution
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}