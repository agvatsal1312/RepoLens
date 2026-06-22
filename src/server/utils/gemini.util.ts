import { GoogleGenAI } from "@google/genai";

let genai: GoogleGenAI;
function getGenAI() {
    if (!genai) {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error("GEMINI_API_KEY is not defined");
        }
        genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }
    return genai;
}

export const generateContent = async (prompt: string, model: string = 'gemini-2.5-flash', retries = 3): Promise<{ text: string }> => {
    try {
        const ai = getGenAI();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        return {
            text: response.text
        };
    } catch (error: any) {
        if (retries > 0 && (error.status === 503 || error.message?.includes('503') || error.message?.includes('demand'))) {
            console.log(`Gemini 503 error, retrying... (${retries} attempts left)`);
            await new Promise(resolve => setTimeout(resolve, (4 - retries) * 2000));
            return generateContent(prompt, model, retries - 1);
        }
        console.error('Gemini fallback failed:', error);
        throw error;
    }
};

export const generateContentStream = async function* (prompt: string, model: string = 'gemini-2.5-flash', retries = 3): AsyncGenerator<{ text: string }> {
    try {
        const ai = getGenAI();
        const responseStream = await ai.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        for await (const chunk of responseStream) {
            if (chunk.text) {
                yield { text: chunk.text };
            }
        }
    } catch (error: any) {
        if (retries > 0 && (error.status === 503 || error.message?.includes('503') || error.message?.includes('demand'))) {
            console.log(`Gemini stream 503 error, retrying... (${retries} attempts left)`);
            await new Promise(resolve => setTimeout(resolve, (4 - retries) * 2000));
            yield* generateContentStream(prompt, model, retries - 1);
        } else {
            console.error('Gemini stream fallback failed:', error);
            throw error;
        }
    }
};

