import { generateEmbedding } from "./gemini.js";

export class Embedder {
  private static instance: Embedder;

  private constructor() { }

  public static getInstance(): Embedder {
    if (!Embedder.instance) {
      Embedder.instance = new Embedder();
    }
    return Embedder.instance;
  }

  public async init() {
    // Initialization is handled in gemini.ts module scope
  }

  public async embed(text: string): Promise<number[]> {
    return generateEmbedding(text);
  }
}
