import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  console.warn("GEMINI_API_KEY is not set in .env file. Embeddings will fail.");
}

const genAI = new GoogleGenerativeAI(API_KEY || "");
const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
const generativeModel = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const result = await model.embedContent(text);
    return result.embedding.values;
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw error;
  }
}

export async function generateResponse(prompt: string): Promise<string> {
  try {
    const result = await generativeModel.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Error generating response:", error);
    throw error;
  }
}
