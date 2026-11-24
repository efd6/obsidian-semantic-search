import type { io } from '@tensorflow/tfjs';

// The Universal Sentence Encoder lite model and its vocabulary are pinned by
// SHA-256, so a download that has changed or been tampered with is refused
// rather than cached and used. The hashes are of the files as served in
// November 2026; the weights match a copy downloaded in April 2026.
const MODEL_URL = 'https://tfhub.dev/tensorflow/tfjs-model/universal-sentence-encoder-lite/1/default/1';
const VOCAB_URL = 'https://storage.googleapis.com/tfjs-models/savedmodel/universal_sentence_encoder/vocab.json';

// modelHashes holds the expected SHA-256, in hex, of model.json, of each
// weights file by name, and of the vocabulary.
export interface modelHashes {
    model: string;
    weights: Record<string, string>;
    vocab: string;
}

export const pinnedHashes: modelHashes = {
    model: '507d11df18b070f99e0ad650b9a4e6534a4cfb05040127e8ce579f00c8fa3b53',
    weights: {
        'group1-shard1of7': '8775e61b6a4235ea230a62a0d81f1ff00f5213ce86baa5d89c29e611f8cd7412',
        'group1-shard2of7': 'deaf897e5eea5be6c71ea62876a092034560b6f6fbc99c87a768076385a465bd',
        'group1-shard3of7': '50ee49b0daf620cf0cacda2f5fcc0da5929f4a3e520034844b6f8d9f3f4ec936',
        'group1-shard4of7': 'c1a50daae51e7c6e1e904f5d8d638a8658a0a1d310b9345cd7a368866304d596',
        'group1-shard5of7': '410cde3029282e5f601c782985cbb5caa96977f6705dec981c98dd02e93fec6b',
        'group1-shard6of7': '83ef116b2b98dc98e03547280ca0166142fbf6b4547bf1d9e6d13a8f518c088b',
        'group1-shard7of7': 'a29a5e08ee3afd839250b9187b89f1d3163749b5b1807bb175341a16c6012689',
    },
    vocab: '1ad860b9720c16cd48e666d664a556b2515c04f5a26a4b53c0372427913b1b8e',
};

// fetcher is the part of fetch that downloads use.
export type fetcher = (url: string) => Promise<{ ok: boolean; status: number; arrayBuffer(): Promise<ArrayBuffer> }>;

interface modelJSON {
    modelTopology: unknown;
    weightsManifest: { paths: string[]; weights: io.WeightsManifestEntry[] }[];
}

// downloadModel downloads the model and its weights, checks each file against
// its pinned hash, and returns them ready to save.
export async function downloadModel(
    fetchFn: fetcher = fetch,
    hashes: modelHashes = pinnedHashes,
): Promise<io.ModelArtifacts> {
    const manifest = await fetchVerified(fetchFn, `${MODEL_URL}/model.json?tfjs-format=file`, hashes.model);
    const model = JSON.parse(new TextDecoder().decode(manifest)) as modelJSON;

    const weights: ArrayBuffer[] = [];
    for (const group of model.weightsManifest) {
        for (const path of group.paths) {
            const want = hashes.weights[path];
            if (!want) {
                throw new Error(`model download: unexpected weights file ${path}`);
            }
            weights.push(await fetchVerified(fetchFn, `${MODEL_URL}/${path}?tfjs-format=file`, want));
        }
    }

    return {
        modelTopology: model.modelTopology as io.ModelArtifacts['modelTopology'],
        weightSpecs: model.weightsManifest.flatMap(group => group.weights),
        weightData: concat(weights),
    };
}

// downloadVocab downloads the vocabulary, checks it against its pinned hash,
// and returns it parsed.
export async function downloadVocab(fetchFn: fetcher = fetch, hashes: modelHashes = pinnedHashes): Promise<unknown> {
    const data = await fetchVerified(fetchFn, VOCAB_URL, hashes.vocab);
    return JSON.parse(new TextDecoder().decode(data)) as unknown;
}

async function fetchVerified(fetchFn: fetcher, url: string, want: string): Promise<ArrayBuffer> {
    const response = await fetchFn(url);
    if (!response.ok) {
        throw new Error(`model download: ${url}: HTTP ${response.status}`);
    }
    const data = await response.arrayBuffer();
    const got = await sha256(data);
    if (got !== want) {
        throw new Error(`model download: ${url}: SHA-256 ${got} does not match pinned ${want}`);
    }
    return data;
}

export async function sha256(data: ArrayBuffer): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function concat(buffers: ArrayBuffer[]): ArrayBuffer {
    const total = buffers.reduce((n, b) => n + b.byteLength, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const b of buffers) {
        out.set(new Uint8Array(b), offset);
        offset += b.byteLength;
    }
    return out.buffer;
}
