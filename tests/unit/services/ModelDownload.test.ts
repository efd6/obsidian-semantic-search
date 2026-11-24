import { webcrypto } from 'crypto';
import { downloadModel, downloadVocab, fetcher, modelHashes, sha256 } from '../../../src/services/ModelDownload';

// The shared Jest setup replaces crypto.subtle with a fake hash. These tests
// are about checking real hashes, so use Node's WebCrypto.
Object.defineProperty(globalThis.crypto, 'subtle', { value: webcrypto.subtle, configurable: true });

const encode = (s: string): ArrayBuffer => new TextEncoder().encode(s).buffer as ArrayBuffer;

const modelJSON = JSON.stringify({
  modelTopology: { node: [] },
  weightsManifest: [
    { paths: ['shard1', 'shard2'], weights: [{ name: 'w', shape: [2], dtype: 'float32' }] },
  ],
});

// files maps the last path element of each URL, without its query, to the
// body served for it.
const files: Record<string, ArrayBuffer> = {
  'model.json': encode(modelJSON),
  shard1: new Uint8Array([1, 2, 3, 4]).buffer,
  shard2: new Uint8Array([5, 6, 7, 8]).buffer,
  'vocab.json': encode('[["a", -1.0]]'),
};

function testFetch(served: Record<string, ArrayBuffer> = files): jest.MockedFunction<fetcher> {
  return jest.fn((url: string) => {
    const name = url.split('?')[0].split('/').pop() ?? '';
    const body = served[name];
    return Promise.resolve({
      ok: body !== undefined,
      status: body === undefined ? 404 : 200,
      arrayBuffer: (): Promise<ArrayBuffer> => Promise.resolve(body ?? new ArrayBuffer(0)),
    });
  });
}

async function hashesOf(served: Record<string, ArrayBuffer>): Promise<modelHashes> {
  return {
    model: await sha256(served['model.json']),
    weights: { shard1: await sha256(served.shard1), shard2: await sha256(served.shard2) },
    vocab: await sha256(served['vocab.json']),
  };
}

describe('ModelDownload', () => {
  it('sha256 computes real SHA-256', async () => {
    // FIPS 180-2 test vector.
    expect(await sha256(encode('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('downloadModel returns the topology, weight specs and joined weights when every hash matches', async () => {
    const artifacts = await downloadModel(testFetch(), await hashesOf(files));

    expect(artifacts.modelTopology).toEqual({ node: [] });
    expect(artifacts.weightSpecs).toEqual([{ name: 'w', shape: [2], dtype: 'float32' }]);
    expect([...new Uint8Array(artifacts.weightData as ArrayBuffer)]).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('downloadModel refuses a weights file that does not match its hash', async () => {
    const hashes = await hashesOf(files);
    const tampered = { ...files, shard2: new Uint8Array([5, 6, 7, 9]).buffer };

    await expect(downloadModel(testFetch(tampered), hashes)).rejects.toThrow(/shard2.*does not match/);
  });

  it('downloadModel refuses a model.json that does not match its hash', async () => {
    const hashes = await hashesOf(files);
    const tampered = { ...files, 'model.json': encode(modelJSON.replace('"w"', '"x"')) };

    await expect(downloadModel(testFetch(tampered), hashes)).rejects.toThrow(/model\.json.*does not match/);
  });

  it('downloadModel refuses a weights file it has no hash for', async () => {
    const hashes = await hashesOf(files);
    delete hashes.weights.shard2;

    await expect(downloadModel(testFetch(), hashes)).rejects.toThrow('unexpected weights file shard2');
  });

  it('downloadModel reports HTTP errors', async () => {
    const hashes = await hashesOf(files);
    const missing = { ...files };
    delete (missing as Record<string, ArrayBuffer>).shard1;

    await expect(downloadModel(testFetch(missing), hashes)).rejects.toThrow('HTTP 404');
  });

  it('downloadVocab returns the parsed vocabulary when its hash matches and refuses it otherwise', async () => {
    const hashes = await hashesOf(files);

    await expect(downloadVocab(testFetch(), hashes)).resolves.toEqual([['a', -1]]);
    await expect(downloadVocab(testFetch({ ...files, 'vocab.json': encode('[]') }), hashes)).rejects.toThrow(/does not match/);
  });
});
