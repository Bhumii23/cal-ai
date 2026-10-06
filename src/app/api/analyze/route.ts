import Groq from "groq-sdk";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: "GROQ_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { image } = body;

    if (!image) {
      return NextResponse.json(
        { error: "No base64 image provided in the request" },
        { status: 400 }
      );
    }

    // Determine mimeType if not passed, defaulting to jpeg
    const mimeType = body.mimeType || "image/jpeg";
    
    const prompt =
      "Analyze this food image and return ONLY a valid JSON object with these exact fields: { foodName: string, calories: number, protein: number, carbs: number, fat: number, servingSize: string }. No extra text, just JSON.";

    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create({
      model: "qwen/qwen3.8-27b",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${image}`,
              },
            },
          ],
        },
      ],
    });

    // Extract the text content from the response
    const responseText = completion.choices[0]?.message?.content;
    
    if (!responseText) {
      throw new Error("No text content returned from Groq API");
    }

    // Clean up potential markdown formatting (```json ... ```)
    // const cleanJson = responseText.replace(/```json/gi, "").replace(/```/g, "").trim();
    
    // const parsedData = JSON.parse(cleanJson);

    // Remove <think>...</think> if present
let cleanText = responseText.replace(/<think>[\s\S]*?<\/think>/gi, "");

// Remove markdown code blocks
cleanText = cleanText
  .replace(/```json/gi, "")
  .replace(/```/g, "")
  .trim();

// Extract only the JSON object
const jsonMatch = cleanText.match(/\{[\s\S]*\}/);

if (!jsonMatch) {
  throw new Error("No valid JSON found in AI response:\n" + cleanText);
}

const parsedData = JSON.parse(jsonMatch[0]);

    // Map the response fields (LLM may return strings — coerce safely).
    const toNonNegative = (value: unknown) => {
      const num = Number(value);
      return Number.isFinite(num) ? Math.max(0, num) : 0;
    };
    const foodItem = {
      name: String(parsedData.foodName || "Unknown Food"),
      calories: toNonNegative(parsedData.calories),
      protein: toNonNegative(parsedData.protein),
      carbs: toNonNegative(parsedData.carbs),
      fat: toNonNegative(parsedData.fat),
      servingSize: String(parsedData.servingSize || "Unknown"),
    };

    return NextResponse.json(foodItem);
  } catch (error: unknown) {
    console.error("Error in /api/analyze:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to analyze image" },
      { status: 500 }
    );
  }
}
