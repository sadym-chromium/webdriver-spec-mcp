import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  console.warn("GEMINI_API_KEY is not set in .env file. Embeddings will fail.");
}

const genAI = new GoogleGenerativeAI(API_KEY || "");

// Prioritize stable, cost-effective models.
// `gemini-embedding-001` is confirmed working in current environment.
// `text-embedding-004` is a standard model to fall back on.
const EMBEDDING_MODELS = [
  "gemini-embedding-001",
  "text-embedding-004",
  "embedding-001"
];

// Prioritize newer, faster, and cheaper/free-tier friendly models.
// Flash models are generally best for speed and cost.
const GENERATIVE_MODELS = [
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
  "gemini-1.5-pro",
  "gemini-1.0-pro",
  "gemini-pro"
];

export async function generateEmbedding(text: string): Promise<number[]> {
  let lastError: any;

  for (const modelName of EMBEDDING_MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.embedContent(text);
      return result.embedding.values;
    } catch (error) {
      console.warn(`Failed to generate embedding with model ${modelName}:`, error);
      lastError = error;
      // Continue to the next model
    }
  }

  console.error("All embedding models failed.");
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
