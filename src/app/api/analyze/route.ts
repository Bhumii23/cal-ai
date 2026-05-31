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
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
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
    const cleanJson = responseText.replace(/```json/gi, "").replace(/```/g, "").trim();
    
    const parsedData = JSON.parse(cleanJson);

    // Map the response fields
    const foodItem = {
      name: parsedData.foodName || "Unknown Food",
      calories: parsedData.calories || 0,
      protein: parsedData.protein || 0,
      carbs: parsedData.carbs || 0,
      fat: parsedData.fat || 0,
      servingSize: parsedData.servingSize || "Unknown",
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
