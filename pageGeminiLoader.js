import { GoogleGenerativeAI } from "https://cdn.skypack.dev/@google/generative-ai";

window.GoogleGenerativeAI = GoogleGenerativeAI;
console.log("✅ GoogleGenerativeAI exposed on window by loader");