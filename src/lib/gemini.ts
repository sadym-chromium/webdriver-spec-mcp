import { GoogleGenerativeAI } from "@google/generative-ai";
import { pipeline } from "@huggingface/transformers";
import dotenv from "dotenv";

dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  console.warn("GEMINI_API_KEY is not set in environment. Gemini features will fail.");
}

const genAI = new GoogleGenerativeAI(API_KEY || "");

// Local embedding model (all-MiniLM-L6-v2)
let extractor: any = null;

async function getExtractor() {
  if (!extractor) {
    extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  }
  return extractor;
}

const EMBEDDING_MODELS = [
  "gemini-embedding-001",
];

// Prioritize newer, faster, and cheaper/free-tier friendly models.
// Flash models are generally best for speed and cost.
const GENERATIVE_MODELS = [
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-flash-latest",
  "gemini-pro-latest",
];

export async function generateEmbedding(text: string): Promise<number[]> {
  // Try local embedding first for reliability and cost
  try {
    const ext = await getExtractor();
    const output = await ext(text, { pooling: "mean", normalize: true });
    return Array.from(output.data) as number[];
  } catch (localError) {
    console.warn("Local embedding failed, falling back to Gemini API:", localError);
  }

  if (!API_KEY) {
    throw new Error("GEMINI_API_KEY is not set and local embedding failed.");
  }

  let lastError: any;

  for (const modelName of EMBEDDING_MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.embedContent(text);
      if (!result.embedding || !result.embedding.values) {
        throw new Error(`Model ${modelName} returned empty embedding`);
      }
      return result.embedding.values;
    } catch (error: any) {
      const status = error.status || (error.response && error.response.status);
      const message = error.message || "";
      console.warn(`Failed to generate embedding with model ${modelName} (Status: ${status}): ${message}`);
      lastError = error;
    }
  }

  throw lastError;
}

export async function generateResponse(prompt: string): Promise<string> {
  let lastError: any;

  for (const modelName of GENERATIVE_MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
       console.warn(`Failed to generate response with model ${modelName}:`, error);
       lastError = error;
       // Continue to the next model
    }
  }

  console.error("All generative models failed.");
  throw lastError;
}
