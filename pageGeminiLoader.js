import { GoogleGenerativeAI } from "https://cdn.skypack.dev/@google/generative-ai";

try{
    window.GoogleGenerativeAI = GoogleGenerativeAI;
    console.log("✅ GoogleGenerativeAI exposed on window by loader");
}catch{console.log("Error exposing GoogleGenerativeAI on window")}