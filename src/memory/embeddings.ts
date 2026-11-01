export type EmbeddingVector = Float32Array;

export interface EmbeddingGenerator {
  generate(input: string): Promise<EmbeddingVector>;
}

const DEFAULT_MODEL = "sentence-transformers/all-MiniLM-L6-v2";
const FALLBACK_DIMENSIONS = 384;

export function normalizeEmbedding(vector: EmbeddingVector): EmbeddingVector {
  let magnitude = 0;
  for (let index = 0; index < vector.length; index += 1) {
    magnitude += vector[index] * vector[index];
  }

  magnitude = Math.sqrt(magnitude);
  if (!Number.isFinite(magnitude) || magnitude === 0) {
    return new Float32Array(vector);
  }

  const normalized = new Float32Array(vector.length);
  for (let index = 0; index < vector.length; index += 1) {
    normalized[index] = vector[index] / magnitude;
  }
  return normalized;
}

export function dotProduct(left: EmbeddingVector, right: EmbeddingVector): number {
  const length = Math.min(left.length, right.length);
  let score = 0;
  for (let index = 0; index < length; index += 1) {
    score += left[index] * right[index];
  }
  return score;
}

export function cosineSimilarity(left: EmbeddingVector, right: EmbeddingVector): number {
  const leftLength = Math.sqrt(dotProduct(left, left));
  const rightLength = Math.sqrt(dotProduct(right, right));

  if (!Number.isFinite(leftLength) || !Number.isFinite(rightLength) || leftLength === 0 || rightLength === 0) {
    return 0;
  }

  return dotProduct(left, right) / (leftLength * rightLength);
}

export function serializeEmbedding(vector: EmbeddingVector): Buffer {
  return Buffer.from(vector.buffer, vector.byteOffset, vector.byteLength);
}

export function deserializeEmbedding(buffer: Uint8Array | Buffer): EmbeddingVector {
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const length = bytes.length / Float32Array.BYTES_PER_ELEMENT;
  const vector = new Float32Array(length);
  for (let index = 0; index < length; index += 1) {
    vector[index] = bytes.readFloatLE(index * Float32Array.BYTES_PER_ELEMENT);
  }
  return vector;
}

function createFallbackEmbedding(text: string): EmbeddingVector {
  const vector = new Float32Array(FALLBACK_DIMENSIONS);
  const normalizedText = text.toLowerCase();

  for (let index = 0; index < normalizedText.length; index += 1) {
    const code = normalizedText.charCodeAt(index);
    const slot = (code + index * 31) % FALLBACK_DIMENSIONS;
    const contribution = (code % 13) / 13 + 1;
    vector[slot] += contribution;
  }

  return normalizeEmbedding(vector);
}

async function createLocalEmbeddingGenerator(): Promise<EmbeddingGenerator> {
  const transformers = await import("@huggingface/transformers");
  const { AutoModel, AutoTokenizer, mean_pooling } = transformers as {
    AutoModel: {
      from_pretrained: (name: string) => Promise<any>;
    };
    AutoTokenizer: {
      from_pretrained: (name: string) => Promise<any>;
    };
    mean_pooling: (lastHiddenState: any, attentionMask: any) => any;
  };

  try {
    const tokenizer = await AutoTokenizer.from_pretrained(DEFAULT_MODEL);
    const model = await AutoModel.from_pretrained(DEFAULT_MODEL);

    return {
      async generate(input: string): Promise<EmbeddingVector> {
        const tokenized = await tokenizer(input, {
          truncation: true,
          padding: true,
          max_length: 512,
          return_tensors: "pt",
        });
        const modelOutput = await model(tokenized);
        const lastHiddenState = modelOutput.last_hidden_state ?? modelOutput[0];
        const attentionMask = modelOutput.attention_mask ?? tokenized.attention_mask;
        const pooled = mean_pooling(lastHiddenState, attentionMask);

        const rawValues = pooled.tolist ? pooled.tolist() : pooled.toArray ? pooled.toArray() : pooled;
        const flattened = Array.isArray(rawValues)
          ? rawValues.flat()
          : Array.isArray(rawValues?.[0])
            ? rawValues[0]
            : Array.from(rawValues ?? []);

        return normalizeEmbedding(new Float32Array(flattened.map((value: number) => Number(value))));
      },
    };
  } catch {
    return {
      async generate(input: string): Promise<EmbeddingVector> {
        return createFallbackEmbedding(input);
      },
    };
  }
}

let singleton: Promise<EmbeddingGenerator> | null = null;

export function getEmbeddingGenerator(): Promise<EmbeddingGenerator> {
  if (!singleton) {
    singleton = createLocalEmbeddingGenerator();
  }
  return singleton;
}

export async function embedText(input: string): Promise<EmbeddingVector> {
  const generator = await getEmbeddingGenerator();
  return generator.generate(input);
}

export function createEmbeddingGeneratorFromCallback(
  callback: (input: string) => Promise<EmbeddingVector> | EmbeddingVector,
): EmbeddingGenerator {
  return {
    generate: async (input: string) => {
      const value = await callback(input);
      return normalizeEmbedding(value instanceof Float32Array ? value : new Float32Array(value));
    },
  };
}
