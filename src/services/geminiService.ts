import { GoogleGenAI, Type, Modality } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

const USER_PORTFOLIO = "https://kbabic1119.github.io/portfolio/";
const USER_LINKEDIN = "https://www.linkedin.com/in/kazimiez-babic-5ba29a3b6";

export const getAI = () => {
  if (!apiKey) throw new Error("GEMINI_API_KEY is missing");
  return new GoogleGenAI({ apiKey });
};

export interface BusinessLead {
  id: string;
  name: string;
  website?: string;
  address?: string;
  phone?: string;
  rating?: number;
  user_ratings_total?: number;
  linkedin?: string;
  source?: 'maps' | 'linkedin';
  role?: string;
  company_size?: string;
  email?: string;
}

export const findLeads = async (query: string, location?: { lat: number; lng: number }): Promise<BusinessLead[]> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `Find businesses for: ${query}. 
    For each business, provide its name, address, phone number, rating, and website if available.
    Focus on businesses that might need a website redesign.`,
    config: {
      tools: [{ googleMaps: {} }],
      toolConfig: {
        retrievalConfig: location ? {
          latLng: {
            latitude: location.lat,
            longitude: location.lng
          }
        } : undefined
      }
    },
  });

  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  const leads: BusinessLead[] = [];
  
  if (chunks) {
    chunks.forEach((chunk: any) => {
      if (chunk.maps && leads.length < 5) {
        leads.push({
          id: chunk.maps.uri || Math.random().toString(36).substr(2, 9),
          name: chunk.maps.title || "Unknown Business",
          website: chunk.maps.uri,
          source: 'maps'
        });
      }
    });
  }

  return leads;
};

export const findLinkedInLeads = async (filters: { industry?: string; jobTitle?: string; location?: string }): Promise<BusinessLead[]> => {
  const { industry, jobTitle, location } = filters;
  const ai = getAI();
  
  const prompt = `Find LinkedIn profiles of people with the following criteria:
  ${jobTitle ? `- Job Title: ${jobTitle}` : ''}
  ${industry ? `- Industry: ${industry}` : ''}
  ${location ? `- Location: ${location}` : ''}
  
  Focus on finding business owners or decision makers who might need a website redesign or a new website for their business.
  Return exactly 5 leads.
  Return a list of businesses with their owner's name, role, LinkedIn profile URL, website URL, email contact, and company size if possible.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }]
    }
  });
  
  const structuredResponse = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Extract a list of business leads from the following search results:
    ${response.text}
    
    Format as a JSON array of objects with: name (person), role, linkedin (URL), website (URL), email, companySize, and niche.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            role: { type: Type.STRING },
            linkedin: { type: Type.STRING },
            website: { type: Type.STRING },
            email: { type: Type.STRING },
            companySize: { type: Type.STRING },
            niche: { type: Type.STRING }
          },
          required: ["name"]
        }
      }
    }
  });

  try {
    const data = JSON.parse(structuredResponse.text);
    return data.map((item: any) => ({
      id: item.linkedin || Math.random().toString(36).substr(2, 9),
      name: item.name,
      role: item.role,
      website: item.website,
      linkedin: item.linkedin,
      email: item.email,
      company_size: item.companySize,
      source: 'linkedin'
    }));
  } catch (e) {
    console.error("Failed to parse LinkedIn leads", e);
    return [];
  }
};

const retryWithBackoff = async <T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    let isRateLimit = false;
    if (error.status === 429) {
      isRateLimit = true;
    } else if (error.message) {
      try {
        const parsedError = JSON.parse(error.message);
        if (parsedError.error && parsedError.error.code === 429) {
          isRateLimit = true;
        }
      } catch (e) {
        // Not JSON
      }
    }
    
    if (isRateLimit && retries > 0) {
      console.warn(`Rate limit exceeded, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryWithBackoff(fn, retries - 1, delay * 2);
    }
    throw error;
  }
};

export const analyzeWebsite = async (businessName: string, websiteUrl: string) => {
  const ai = getAI();
  
  let formattedUrl = websiteUrl.trim();
  if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
    formattedUrl = 'https://' + formattedUrl;
  }
  
  console.log("Analyzing website:", formattedUrl);

  const analysisPromise = retryWithBackoff(async () => {
    console.log("Calling ai.models.generateContent...");
    const result = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze the website for "${businessName}" at ${formattedUrl}. 
      Identify 3-5 specific issues that suggest they need a redesign (e.g., poor mobile responsiveness, outdated design, slow loading, lack of clear CTA, missing modern features).
      Additionally, provide 3-5 specific, actionable SEO improvements (e.g., meta tags, keyword optimization, site structure, speed optimization).
      Be professional and constructive.`,
      config: {
        tools: [{ urlContext: {} }]
      }
    });
    console.log("ai.models.generateContent result:", result);
    return result;
  });

  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error("Analysis timed out. The website might be unreachable or the analysis is taking too long.")), 120000)
  );

  console.log("Waiting for Promise.race...");
  const response = await Promise.race([analysisPromise, timeoutPromise]) as any;
  console.log("Analysis response:", response.text);

  return response.text;
};

export const generatePitch = async (businessName: string, analysis: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Write a highly personalized, natural-sounding cold email to the owner of "${businessName}".
    
    ABOUT ME:
    - Name: Kazimiez Babic
    - Portfolio: ${USER_PORTFOLIO}
    
    WEBSITE ANALYSIS CONTEXT:
    ${analysis}
    
    INSTRUCTIONS:
    1. Write this like a normal human being sending an email to a local business owner. NO marketing jargon, NO "I hope this email finds you well", NO "synergy".
    2. Keep it extremely short (under 75 words). 
    3. Start by complimenting their business briefly.
    4. Casually mention ONE specific issue you noticed on their site from the analysis (e.g., "I noticed your site is a bit hard to read on mobile" or "I saw the site takes a while to load"). Do NOT list multiple issues.
    5. Offer a completely free, no-strings-attached custom homepage mockup to show them what a modern version could look like.
    6. Include my portfolio link (${USER_PORTFOLIO}) naturally.
    7. Sign off with my name: Kazimiez Babic.
    8. Do not use any placeholder brackets like [Insert Name].
    9. The subject line should be included at the very top as "Subject: [Your suggested subject line]\\n\\n". Make the subject line casual and intriguing (e.g., "Quick question about your website", "Idea for ${businessName}").`,
  });

  return response.text;
};

export const reframePitch = async (businessName: string, currentPitch: string, feedback: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Reframe this cold email pitch for "${businessName}".
    
    CURRENT PITCH:
    ${currentPitch}
    
    USER FEEDBACK/INSTRUCTION:
    ${feedback}
    
    INSTRUCTIONS:
    1. Keep it extremely short (under 75 words).
    2. Incorporate the user's feedback while keeping the tone natural, human, and NOT salesy.
    3. Ensure my name (Kazimiez Babic) and portfolio (${USER_PORTFOLIO}) are still included.
    4. Do not use placeholder brackets.
    5. Keep the "Subject: ..." format at the top.`,
  });

  return response.text;
};
