// Transformers.js Mocks
// Provides fast mock implementations of transformers.js for unit testing

// Mock environment configuration
const mockEnv = {
    allowLocalModels: true,
    allowRemoteModels: false,
    useBrowserCache: true,
    backends: {
        onnx: false,
        tfjs: false
    }
};

// Mock pipeline function
const mockPipeline = jest.fn().mockImplementation(async (task, model, options = {}) => {
    console.log(`[Mock] Creating ${task} pipeline for model ${model}`);

    // Return a mock pipeline function
    return jest.fn().mockImplementation(async (text, pipelineOptions = {}) => {
        // Simulate embedding generation with deterministic fake data
        if (task === 'feature-extraction') {
            // Create a deterministic "embedding" based on input text
            const mockEmbedding = new Float32Array(384); // MiniLM-L6-v2 has 384 dimensions

            // Fill with deterministic values based on text content
            const hash = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
            for (let i = 0; i < 384; i++) {
                mockEmbedding[i] = Math.sin((hash + i) / 100) * 0.1; // Small normalized values
            }

            return {
                data: mockEmbedding,
                dims: [1, 384]
            };
        }

        // Default mock response
        return {
            data: new Float32Array([0.1, 0.2, 0.3]),
            dims: [1, 3]
        };
    });
});

// Mock AutoTokenizer
class MockAutoTokenizer {
    static async from_pretrained(model, options = {}) {
        console.log(`[Mock] Loading tokenizer for ${model}`);
        return new MockAutoTokenizer();
    }

    encode(text) {
        // Simple mock tokenization - just return character codes
        return text.split('').map(char => char.charCodeAt(0));
    }

    decode(tokens) {
        // Simple mock detokenization
        return tokens.map(token => String.fromCharCode(token)).join('');
    }
}

// Mock AutoModel
class MockAutoModel {
    static async from_pretrained(model, options = {}) {
        console.log(`[Mock] Loading model for ${model}`);
        return new MockAutoModel();
    }

    async forward(inputs) {
        // Mock model forward pass
        const batchSize = inputs.input_ids.dims[0];
        const sequenceLength = inputs.input_ids.dims[1];
        const hiddenSize = 384; // MiniLM-L6-v2 hidden size

        return {
            last_hidden_state: {
                data: new Float32Array(batchSize * sequenceLength * hiddenSize),
                dims: [batchSize, sequenceLength, hiddenSize]
            }
        };
    }
}

// Mock configuration classes
class MockAutoConfig {
    static async from_pretrained(model, options = {}) {
        console.log(`[Mock] Loading config for ${model}`);
        return {
            model_type: 'bert',
            hidden_size: 384,
            num_attention_heads: 12,
            num_hidden_layers: 6,
            max_position_embeddings: 512,
            vocab_size: 30522
        };
    }
}

// Test utilities
const createMockEmbedding = (text, dimensions = 384) => {
    const embedding = new Float32Array(dimensions);
    const hash = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

    for (let i = 0; i < dimensions; i++) {
        embedding[i] = Math.sin((hash + i) / 100) * 0.1;
    }

    return embedding;
};

const createMockPipeline = (task = 'feature-extraction') => {
    return jest.fn().mockImplementation(async (text, options = {}) => {
        if (task === 'feature-extraction') {
            return {
                data: createMockEmbedding(text),
                dims: [1, 384]
            };
        }
        return { data: new Float32Array([0, 1, 2]), dims: [1, 3] };
    });
};

// Export mock implementations
module.exports = {
    // Main functions
    pipeline: mockPipeline,
    env: mockEnv,

    // Classes
    AutoTokenizer: MockAutoTokenizer,
    AutoModel: MockAutoModel,
    AutoConfig: MockAutoConfig,

    // Test utilities
    createMockEmbedding,
    createMockPipeline,

    // Reset mocks utility for tests
    resetMocks: () => {
        jest.clearAllMocks();
        mockPipeline.mockClear();
    }
};