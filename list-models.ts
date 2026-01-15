import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY || "");

async function main() {
  try {
      console.log("Fetching models via REST API...");
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
      const data = await response.json();
      
      if (data.models) {
          console.log("Available models:");
          data.models.forEach((m: any) => {
              if (m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent")) {
                  console.log(`- ${m.name}`);
              }
          });
      } else {
          console.log("No models returned or error:", data);
      }
      
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
