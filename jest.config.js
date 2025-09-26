// Base configuration shared by all projects
const baseConfig = {
	preset: 'ts-jest',
	testEnvironment: 'jsdom',
	roots: ['<rootDir>/__tests__'],
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
		'^obsidian$': '<rootDir>/__tests__/setup/ObsidianMocks.js',
		'^onnxruntime-web$': '<rootDir>/node_modules/onnxruntime-web/dist/ort.wasm-core.min.js'
	},
	setupFilesAfterEnv: [
		'<rootDir>/__tests__/setup/jest-setup.js'
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
			testMatch: ['<rootDir>/__tests__/unit/**/*.test.(ts|js)']
		},
		{
			...baseConfig,
			displayName: 'contract',
			testMatch: ['<rootDir>/__tests__/contract/**/*.test.(ts|js)']
		},
		{
			...baseConfig,
			displayName: 'integration',
			testMatch: ['<rootDir>/__tests__/integration/**/*.test.(ts|js)']
		}
	]
};
