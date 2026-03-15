// Base configuration shared by all projects
const baseConfig = {
	preset: 'ts-jest',
	testEnvironment: 'jsdom',
	roots: ['<rootDir>/tests'],
	transform: {
		'^.+\\.ts$': ['ts-jest', { useESM: true }],
		'^.+\\.js$': ['ts-jest', { useESM: true }]
	},
	collectCoverageFrom: [
		'src/**/*.{ts,js}',
		'!src/**/*.d.ts'
	],
	moduleNameMapper: {
		'^@/(.*)$': '<rootDir>/src/$1',
		'^obsidian$': '<rootDir>/tests/setup/ObsidianMocks.js',
		'^onnxruntime-web$': '<rootDir>/node_modules/onnxruntime-web/dist/ort.wasm-core.min.js'
	},
	setupFilesAfterEnv: [
		'<rootDir>/tests/setup/jest-setup.js'
	],
	moduleFileExtensions: ['ts', 'js', 'json'],
	extensionsToTreatAsEsm: ['.ts'],
	maxWorkers: 4
};

export default {
	// Use projects for separate unit, contract, and integration test configurations
	projects: [
		{
			...baseConfig,
			displayName: 'unit',
			testMatch: ['<rootDir>/tests/unit/**/*.test.(ts|js)']
		},
		{
			...baseConfig,
			displayName: 'contract',
			testMatch: ['<rootDir>/tests/contract/**/*.test.(ts|js)']
		},
		{
			...baseConfig,
			displayName: 'integration',
			testMatch: ['<rootDir>/tests/integration/**/*.test.(ts|js)']
		}
	]
};
