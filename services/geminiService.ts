
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { GEMINI_MODEL_NAME } from '../constants';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.error("API_KEY environment variable not set. Gemini API calls will fail.");
}
const ai = new GoogleGenAI({ apiKey: API_KEY! }); // API_KEY can be undefined if not set. Added '!' for TS.

export const generateText = async (prompt: string): Promise<string> => {
  if (!API_KEY) {
    return "Error: API_KEY not configured. Please set the API_KEY environment variable.";
  }
  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_MODEL_NAME,
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Error generating text with Gemini:", error);
    if (error instanceof Error) {
        return `Error from Gemini: ${error.message}`;
    }
    return "An unknown error occurred while contacting Gemini.";
  }
};

export const generatePostSuggestion = async (topic?: string): Promise<string> => {
  const prompt = topic 
    ? `Write a short, engaging social media post (like a tweet) about "${topic}". Include relevant hashtags. Keep it under 280 characters.`
    : `Write a short, engaging social media post (like a tweet) about a random interesting topic. Include relevant hashtags. Keep it under 280 characters.`;
  return generateText(prompt);
};

export const completePost = async (partialPost: string): Promise<string> => {
  const prompt = `Complete the following social media post in a creative and engaging way: "${partialPost}" Keep it under 280 characters.`;
  return generateText(prompt);
};

export const generateComment = async (postContent: string, postAuthorUsername: string): Promise<string> => {
  const prompt = `You are a friendly and engaging social media user.
Given the following social media post by @${postAuthorUsername}:
"${postContent}"

Write a short, relevant, and insightful comment for this post. 
- If it's a question, try to provide a helpful answer or perspective.
- If it's an opinion, react to it respectfully, perhaps adding your own thought.
- If it's news or an announcement, show engagement.
- Keep the comment concise and natural, like a real user would write. Avoid generic replies.
- Include a relevant emoji if it fits the tone.
- Maximum 150 characters.`;
  return generateText(prompt);
};
