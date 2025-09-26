// Test fixtures - sample documents for integration testing
// Provides consistent test data across different test suites

const sampleDocuments = {
    // Technical documentation
    machineLearning: {
        filePath: '/notes/machine-learning-basics.md',
        content: `# Machine Learning Fundamentals

        Machine learning is a subset of artificial intelligence that enables computers to learn and make decisions from data without being explicitly programmed.

        ## Core Concepts

        ### Supervised Learning
        - Uses labeled training data
        - Algorithms: Linear Regression, Decision Trees, Random Forest
        - Applications: Classification, Prediction

        ### Unsupervised Learning
        - Works with unlabeled data
        - Algorithms: K-Means Clustering, PCA
        - Applications: Pattern Recognition, Data Mining

        ### Deep Learning
        - Neural networks with multiple layers
        - Frameworks: TensorFlow, PyTorch
        - Applications: Computer Vision, NLP

        ## Python Libraries
        - **Scikit-learn**: General-purpose ML library
        - **Pandas**: Data manipulation and analysis
        - **NumPy**: Numerical computing
        - **Matplotlib**: Data visualization

        #machine-learning #ai #python #data-science #algorithms`,
        modifiedDate: '2023-01-15T10:00:00Z'
    },

    webDevelopment: {
        filePath: '/projects/web-development-guide.md',
        content: `# Modern Web Development

        ## Frontend Technologies

        ### React
        - Component-based architecture
        - Virtual DOM for performance
        - Extensive ecosystem with Redux, Router
        - JSX syntax for component definition

        ### Vue.js
        - Progressive framework
        - Template-based syntax
        - Vue CLI for project scaffolding

        ## Backend Technologies

        ### Node.js
        - JavaScript runtime for server-side development
        - Express.js for web applications
        - npm package ecosystem

        ### Databases
        - **MongoDB**: Document-based NoSQL
        - **PostgreSQL**: Relational database
        - **Redis**: In-memory key-value store

        ## DevOps and Deployment
        - Docker for containerization
        - AWS/Azure for cloud hosting
        - CI/CD with GitHub Actions

        #web-development #javascript #react #nodejs #frontend #backend`,
        modifiedDate: '2023-02-01T14:30:00Z'
    },

    dataScience: {
        filePath: '/research/data-science-workflow.md',
        content: `# Data Science Methodology

        ## Data Collection
        - Web scraping with BeautifulSoup
        - API data retrieval
        - Database extraction
        - Survey and experimental data

        ## Data Preprocessing
        - Cleaning missing values
        - Handling outliers
        - Feature engineering
        - Data normalization and scaling

        ## Exploratory Data Analysis
        - Statistical summaries
        - Data visualization
        - Correlation analysis
        - Distribution analysis

        ## Model Development
        1. Split data (train/validation/test)
        2. Select appropriate algorithms
        3. Hyperparameter tuning
        4. Cross-validation

        ## Model Evaluation
        - Accuracy, Precision, Recall
        - ROC curves and AUC
        - Confusion matrices
        - Feature importance analysis

        ## Tools and Technologies
        - **Jupyter Notebooks**: Interactive development
        - **Python**: Primary programming language
        - **R**: Statistical computing
        - **Tableau**: Business intelligence visualization

        #data-science #analytics #python #statistics #visualization`,
        modifiedDate: '2023-01-20T09:15:00Z'
    },

    dailyNotes: {
        filePath: '/daily/2023-01-10.md',
        content: `# Daily Note - January 10, 2023

        ## Work Progress
        - Finished implementing user authentication system
        - Reviewed machine learning model performance
        - Started working on data visualization dashboard
        - Met with team about upcoming sprint planning

        ## Learning
        Today I dove deeper into transformer architectures and their applications in natural language processing. The attention mechanism is fascinating.

        ## Ideas
        - Explore using GPT models for automated documentation
        - Consider implementing semantic search for project knowledge base
        - Research latest developments in computer vision

        ## Tomorrow's Goals
        - Complete API integration testing
        - Review pull requests from team members
        - Prepare presentation for stakeholder meeting

        #daily #work #progress #ml #nlp #planning`,
        modifiedDate: '2023-01-10T18:00:00Z'
    },

    researchPaper: {
        filePath: '/research/attention-is-all-you-need.md',
        content: `# Attention Is All You Need - Paper Summary

        **Authors**: Vaswani et al. (Google Brain/Google Research)
        **Year**: 2017
        **Conference**: NIPS

        ## Abstract
        This paper introduces the Transformer architecture, a novel neural network architecture based solely on attention mechanisms, dispensing with recurrence and convolutions entirely.

        ## Key Contributions

        ### 1. Self-Attention Mechanism
        - Allows model to attend to different positions in input sequence
        - Computes relationships between all pairs of positions
        - More efficient than RNN/CNN approaches

        ### 2. Multi-Head Attention
        - Multiple attention heads capture different types of relationships
        - Parallel processing improves computational efficiency
        - Different heads focus on different aspects of the input

        ### 3. Positional Encoding
        - Sine and cosine functions encode position information
        - No recurrence needed for sequence modeling
        - Enables parallel processing of sequences

        ## Architecture Details
        - Encoder-decoder structure
        - 6 layers in both encoder and decoder
        - 512-dimensional model
        - 8 attention heads per layer

        ## Results
        - State-of-the-art performance on machine translation
        - Significantly faster training than RNN models
        - Better parallelization capabilities

        ## Impact
        This paper revolutionized NLP and led to development of BERT, GPT, and other transformer-based models.

        #research #nlp #transformers #attention #deep-learning #paper-summary`,
        modifiedDate: '2023-01-25T16:45:00Z'
    },

    projectPlanning: {
        filePath: '/projects/ai-chatbot-planning.md',
        content: `# AI Chatbot Project Planning

        ## Project Overview
        Building an intelligent chatbot for customer service automation using natural language processing and machine learning.

        ## Technical Requirements

        ### Natural Language Understanding
        - Intent recognition and classification
        - Named entity recognition (NER)
        - Sentiment analysis capabilities
        - Multi-language support

        ### Knowledge Base
        - FAQ integration
        - Product information database
        - Real-time information retrieval
        - Context-aware responses

        ### Integration Requirements
        - RESTful API for web integration
        - Slack/Teams bot capabilities
        - CRM system integration
        - Analytics and reporting dashboard

        ## Development Timeline

        ### Phase 1: Foundation (4 weeks)
        - Set up development environment
        - Design system architecture
        - Implement basic NLP pipeline
        - Create initial training dataset

        ### Phase 2: Core Features (6 weeks)
        - Intent classification system
        - Entity extraction
        - Response generation
        - Basic conversation flow

        ### Phase 3: Advanced Features (4 weeks)
        - Context management
        - Multi-turn conversations
        - Integration with external APIs
        - Performance optimization

        ### Phase 4: Testing & Deployment (3 weeks)
        - User acceptance testing
        - Performance benchmarking
        - Production deployment
        - Monitoring and logging setup

        ## Technology Stack
        - **Backend**: Python, FastAPI, PostgreSQL
        - **ML/NLP**: spaCy, Transformers, scikit-learn
        - **Frontend**: React, TypeScript
        - **Deployment**: Docker, AWS ECS
        - **Monitoring**: Prometheus, Grafana

        #project #ai #chatbot #nlp #planning #development`,
        modifiedDate: '2023-02-05T11:20:00Z'
    }
};

// Utility functions for test fixtures
const createBatchDocuments = (count = 10) => {
    return Array.from({ length: count }, (_, i) => ({
        filePath: `/generated/document-${i}.md`,
        content: `# Generated Document ${i}

        This is automatically generated document number ${i} for testing batch processing capabilities.

        ## Content Sections
        ${Array.from({ length: 3 }, (_, j) =>
            `### Section ${j + 1}
            Content for section ${j + 1} with various keywords like ${i % 3 === 0 ? 'machine learning' : i % 3 === 1 ? 'web development' : 'data analysis'}.`
        ).join('\n\n        ')}

        ## Topics
        - Software engineering
        - Algorithm design
        - System architecture
        - Performance optimization

        #generated #doc${i} #${i % 3 === 0 ? 'ml' : i % 3 === 1 ? 'web' : 'data'} #testing`,
        modifiedDate: new Date(Date.now() - i * 86400000).toISOString() // Spread over days
    }));
};

const createLongDocument = (paragraphCount = 50) => ({
    filePath: '/test/long-document.md',
    content: `# Long Document for Chunking Tests

    This document is designed to test the chunking algorithm with extended content that will span multiple chunks.

    ${Array.from({ length: paragraphCount }, (_, i) =>
        `## Section ${i + 1}

        This is paragraph ${i + 1} of the long document. It contains detailed information about various technical topics including machine learning, web development, data science, and software engineering practices. The content is designed to be meaningful for semantic search testing while providing sufficient length to test chunking algorithms effectively.

        The paragraph discusses concepts like artificial intelligence, neural networks, deep learning, frontend development, backend systems, database management, and cloud computing. These topics are relevant for testing semantic search capabilities and ensuring that the chunking process maintains coherent meaning across chunk boundaries.`
    ).join('\n\n    ')}

    #long-document #chunking-test #comprehensive #technical-content`,
    modifiedDate: '2023-01-30T12:00:00Z'
});

const createDocumentsWithTags = () => ([
    {
        filePath: '/tagged/frontend-guide.md',
        content: `# Frontend Development Guide

        Complete guide to modern frontend development practices.

        #frontend #react #javascript #css #html #ui-ux`,
        modifiedDate: '2023-01-01T10:00:00Z'
    },
    {
        filePath: '/tagged/backend-api.md',
        content: `# Backend API Development

        REST API development with Node.js and Express.

        #backend #api #nodejs #express #database #server`,
        modifiedDate: '2023-01-02T10:00:00Z'
    },
    {
        filePath: '/tagged/mobile-dev.md',
        content: `# Mobile Application Development

        Cross-platform mobile development strategies.

        #mobile #react-native #ios #android #app-development`,
        modifiedDate: '2023-01-03T10:00:00Z'
    }
]);

module.exports = {
    sampleDocuments,
    createBatchDocuments,
    createLongDocument,
    createDocumentsWithTags
};