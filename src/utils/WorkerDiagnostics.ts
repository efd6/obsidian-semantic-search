/**
 * Worker Diagnostics Utilities
 * Provides debugging tools for Worker-related issues in Obsidian/Electron environments
 */

export interface WorkerDiagnosticInfo {
  workerAvailable: boolean;
  workerType: string;
  workerConstructorName: string;
  isNoopWorker: boolean;
  canInstantiate: boolean;
  instantiationError?: string;
  prototype: {
    hasPostMessage: boolean;
    hasTerminate: boolean;
    hasAddEventListener: boolean;
    hasRemoveEventListener: boolean;
    hasDispatchEvent: boolean;
  };
  environment: {
    isElectron: boolean;
    isObsidian: boolean;
    userAgent: string;
    nodeVersion?: string;
  };
  onnxRuntimeInfo?: {
    ortAvailable: boolean;
    wasmConfig?: {
      numThreads?: number;
      proxy?: boolean;
      worker?: unknown;
      disableWorker?: boolean;
      wasmPaths?: string;
    };
  };
  transformersInfo?: {
    envConfigured: boolean;
    allowLocalModels?: boolean;
    allowRemoteModels?: boolean;
    useFS?: boolean;
    useBrowserCache?: boolean;
    workers?: unknown;
    useWorkers?: unknown;
  };
}

/**
 * Comprehensive Worker diagnostics
 */
export function diagnoseWorkerEnvironment(): WorkerDiagnosticInfo {
  const globalWithWorker = globalThis as { Worker?: typeof Worker; ort?: unknown };

  // Basic Worker availability
  const workerAvailable = globalWithWorker.Worker !== undefined;
  const workerType = typeof globalWithWorker.Worker;
  const workerConstructorName = globalWithWorker.Worker?.name ?? 'undefined';
  const isNoopWorker = workerConstructorName === 'NoopWorker';

  // Test Worker instantiation
  let canInstantiate = false;
  let instantiationError: string | undefined;
  try {
    if (workerAvailable) {
      new globalWithWorker.Worker!('test-script.js');
      canInstantiate = true;
    }
  } catch (error) {
    instantiationError = error instanceof Error ? error.message : 'Unknown error';
  }

  // Check prototype methods
  const WorkerProto = globalWithWorker.Worker?.prototype;
  const prototype = {
    hasPostMessage: Boolean(WorkerProto && 'postMessage' in WorkerProto),
    hasTerminate: Boolean(WorkerProto && 'terminate' in WorkerProto),
    hasAddEventListener: Boolean(WorkerProto && 'addEventListener' in WorkerProto),
    hasRemoveEventListener: Boolean(WorkerProto && 'removeEventListener' in WorkerProto),
    hasDispatchEvent: Boolean(WorkerProto && 'dispatchEvent' in WorkerProto),
  };

  // Environment detection
  const userAgent = (globalThis as { navigator?: { userAgent?: string } }).navigator?.userAgent ?? '';
  const environment = {
    isElectron: userAgent.includes('Electron') || 'electron' in globalThis,
    isObsidian: userAgent.includes('Obsidian') || 'obsidian' in globalThis,
    userAgent,
    nodeVersion: (globalThis as { process?: { version?: string } }).process?.version,
  };

  // ONNX Runtime diagnostics
  let onnxRuntimeInfo: WorkerDiagnosticInfo['onnxRuntimeInfo'];
  if (globalWithWorker.ort) {
    const ort = globalWithWorker.ort as { env?: { wasm?: unknown } };
    const wasmConfig = ort.env?.wasm as {
      numThreads?: number;
      proxy?: boolean;
      worker?: unknown;
      disableWorker?: boolean;
      wasmPaths?: string;
    } | undefined;

    onnxRuntimeInfo = {
      ortAvailable: true,
      wasmConfig: wasmConfig ? {
        numThreads: wasmConfig.numThreads,
        proxy: wasmConfig.proxy,
        worker: wasmConfig.worker,
        disableWorker: wasmConfig.disableWorker,
        wasmPaths: wasmConfig.wasmPaths,
      } : undefined,
    };
  } else {
    onnxRuntimeInfo = { ortAvailable: false };
  }

  // Transformers.js diagnostics (if available)
  let transformersInfo: WorkerDiagnosticInfo['transformersInfo'];
  try {
    // Try to access transformers env if it's been loaded
    const transformersEnv = (globalThis as { __TRANSFORMERS_ENV__?: unknown }).__TRANSFORMERS_ENV__ as {
      allowLocalModels?: boolean;
      allowRemoteModels?: boolean;
      useFS?: boolean;
      useBrowserCache?: boolean;
      workers?: unknown;
      useWorkers?: unknown;
    } | undefined;

    transformersInfo = transformersEnv ? {
        envConfigured: true,
        allowLocalModels: transformersEnv.allowLocalModels,
        allowRemoteModels: transformersEnv.allowRemoteModels,
        useFS: transformersEnv.useFS,
        useBrowserCache: transformersEnv.useBrowserCache,
        workers: transformersEnv.workers,
        useWorkers: transformersEnv.useWorkers,
      } : { envConfigured: false };
  } catch {
    transformersInfo = { envConfigured: false };
  }

  return {
    workerAvailable,
    workerType,
    workerConstructorName,
    isNoopWorker,
    canInstantiate,
    instantiationError,
    prototype,
    environment,
    onnxRuntimeInfo,
    transformersInfo,
  };
}

/**
 * Log comprehensive Worker diagnostics to console
 */
export function logWorkerDiagnostics(): void {
  const diagnostics = diagnoseWorkerEnvironment();

  console.group('🔧 Worker Environment Diagnostics');
  console.log('Worker Available:', diagnostics.workerAvailable);
  console.log('Worker Type:', diagnostics.workerType);
  console.log('Constructor Name:', diagnostics.workerConstructorName);
  console.log('Is NoopWorker:', diagnostics.isNoopWorker);
  console.log('Can Instantiate:', diagnostics.canInstantiate);

  if (diagnostics.instantiationError) {
    console.error('Instantiation Error:', diagnostics.instantiationError);
  }

  console.group('Prototype Methods');
  for (const [method, available] of Object.entries(diagnostics.prototype)) {
    console.log(`${method}:`, available);
  }
  console.groupEnd();

  console.group('Environment');
  for (const [key, value] of Object.entries(diagnostics.environment)) {
    console.log(`${key}:`, value);
  }
  console.groupEnd();

  if (diagnostics.onnxRuntimeInfo?.ortAvailable) {
    console.group('ONNX Runtime');
    console.log('ORT Available:', diagnostics.onnxRuntimeInfo.ortAvailable);
    if (diagnostics.onnxRuntimeInfo.wasmConfig) {
      console.log('WASM Config:', diagnostics.onnxRuntimeInfo.wasmConfig);
    }
    console.groupEnd();
  }

  if (diagnostics.transformersInfo?.envConfigured) {
    console.group('Transformers.js');
    for (const [key, value] of Object.entries(diagnostics.transformersInfo)) {
      console.log(`${key}:`, value);
    }
    console.groupEnd();
  }

  console.groupEnd();
}

/**
 * Test Worker functionality with detailed logging
 */
export function testWorkerFunctionality(): {
  success: boolean;
  results: Record<string, boolean>;
  errors: Record<string, string>;
} {
  const results: Record<string, boolean> = {};
  const errors: Record<string, string> = {};

  console.group('🧪 Worker Functionality Test');

  // Test 1: Constructor
  try {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Worker constructor test requires instance
    const worker = new Worker('test-script.js');
    results['constructor'] = true;
    console.log('✅ Constructor: Success');
  } catch (error) {
    results['constructor'] = false;
    errors['constructor'] = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Constructor: Failed -', errors['constructor']);
  }

  // Test 2: Method calls (if constructor succeeded)
  if (results['constructor']) {
    try {
      const worker = new Worker('test-script.js');

      // Test postMessage
      worker.postMessage({ test: true });
      results.postMessage = true;
      console.log('✅ postMessage: Success');

      // Test terminate
      worker.terminate();
      results.terminate = true;
      console.log('✅ terminate: Success');

      // Test event handlers using addEventListener for better compatibility
      worker.addEventListener('message', (): void => {});
      worker.addEventListener('error', (): void => {});
      worker.addEventListener('messageerror', (): void => {});
      results.eventHandlers = true;
      console.log('✅ Event handlers: Success');

      // Test event listeners
      const dummyListener = (): void => {};
      worker.addEventListener('message', dummyListener);
      worker.removeEventListener('message', dummyListener);
      results.eventListeners = true;
      console.log('✅ Event listeners: Success');

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      results.methods = false;
      errors.methods = errorMsg;
      console.error('❌ Method calls: Failed -', errorMsg);
    }
  }

  console.groupEnd();

  const success = results['constructor'] && Object.values(results).every(Boolean);
  return { success, results, errors };
}

/**
 * Monitor for Worker-related errors in the console
 */
export function setupWorkerErrorMonitoring(): () => void {
  const originalError = console.error;
  const originalWarn = console.warn;

  const workerErrorKeywords = [
    'Worker is not a constructor',
    'Worker',
    'web worker',
    'worker thread',
    'ONNX',
    'transformers',
  ];

  const monitorFunction = (level: 'error' | 'warn', originalFn: typeof console.error) =>
    function(this: Console, ...args: unknown[]): unknown {
      const message = args.join(' ').toLowerCase();

      if (workerErrorKeywords.some(keyword => message.includes(keyword.toLowerCase()))) {
        console.group(`🚨 Worker-related ${level} detected`);
        console.log('Original message:', ...args);
        console.log('Diagnostics:');
        logWorkerDiagnostics();
        console.groupEnd();
      }

      return originalFn.apply(this, args);
    };

  console.error = monitorFunction('error', originalError) as typeof console.error;
  console.warn = monitorFunction('warn', originalWarn) as typeof console.warn;

  // Return cleanup function
  return () => {
    console.error = originalError;
    console.warn = originalWarn;
  };
}

/**
 * Generate a diagnostic report for issue reporting
 */
export function generateDiagnosticReport(): string {
  const diagnostics = diagnoseWorkerEnvironment();
  const functionality = testWorkerFunctionality();

  const report = `
# Worker Diagnostic Report

Generated: ${new Date().toISOString()}

## Environment
- Is Electron: ${diagnostics.environment.isElectron}
- Is Obsidian: ${diagnostics.environment.isObsidian}
- User Agent: ${diagnostics.environment.userAgent}
- Node Version: ${diagnostics.environment.nodeVersion ?? 'N/A'}

## Worker Status
- Available: ${diagnostics.workerAvailable}
- Type: ${diagnostics.workerType}
- Constructor Name: ${diagnostics.workerConstructorName}
- Is NoopWorker: ${diagnostics.isNoopWorker}
- Can Instantiate: ${diagnostics.canInstantiate}
- Instantiation Error: ${diagnostics.instantiationError ?? 'None'}

## Prototype Methods
${Object.entries(diagnostics.prototype)
  .map(([method, available]) => `- ${method}: ${available}`)
  .join('\n')}

## ONNX Runtime
- Available: ${diagnostics.onnxRuntimeInfo?.ortAvailable ?? false}
${diagnostics.onnxRuntimeInfo?.wasmConfig ?
  Object.entries(diagnostics.onnxRuntimeInfo.wasmConfig)
    .map(([key, value]) => `- ${key}: ${JSON.stringify(value)}`)
    .join('\n') : ''}

## Transformers.js
- Configured: ${diagnostics.transformersInfo?.envConfigured ?? false}
${diagnostics.transformersInfo?.envConfigured ?
  Object.entries(diagnostics.transformersInfo)
    .filter(([key]) => key !== 'envConfigured')
    .map(([key, value]) => `- ${key}: ${JSON.stringify(value)}`)
    .join('\n') : ''}

## Functionality Test
- Overall Success: ${functionality.success}
- Results: ${JSON.stringify(functionality.results, null, 2)}
- Errors: ${JSON.stringify(functionality.errors, null, 2)}
`;

  return report.trim();
}