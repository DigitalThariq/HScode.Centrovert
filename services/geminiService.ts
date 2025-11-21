import { GoogleGenAI, Type, Schema } from "@google/genai";
import { TargetRegion, HSCodeResult } from "../types";

// Initialize the Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Helper: Safe JSON Parser ---
const cleanAndParseJSON = (text: string): any => {
  try {
    // 1. Try direct parse
    return JSON.parse(text);
  } catch (e) {
    // 2. Try stripping markdown code blocks
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```([\s\S]*?)```/);
    if (jsonMatch && jsonMatch[1]) {
      try {
        return JSON.parse(jsonMatch[1]);
      } catch (e2) {
        // Continue to step 3
      }
    }
    // 3. Try finding the first '{' and last '}'
    const firstOpen = text.indexOf('{');
    const lastClose = text.lastIndexOf('}');
    if (firstOpen !== -1 && lastClose !== -1) {
      try {
        return JSON.parse(text.substring(firstOpen, lastClose + 1));
      } catch (e3) {
        throw new Error("Failed to parse AI response as JSON");
      }
    }
    throw e;
  }
};

// --- Live API Integration Helpers ---

// Generic fetch with timeout to prevent hanging
async function fetchWithTimeout(resource: string, options: RequestInit = {}, timeout = 5000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

// 1. Singapore Data (data.gov.sg)
const SG_RESOURCE_ID = "d_8cfe111e0a5a5cf5b598e78851e58ad4";

async function fetchSingaporeData(query: string): Promise<string> {
  try {
    const url = `https://data.gov.sg/api/action/datastore_search?resource_id=${SG_RESOURCE_ID}&q=${encodeURIComponent(query)}&limit=3`;
    const response = await fetchWithTimeout(url);
    
    if (!response.ok) {
      console.warn(`[Singapore API] Request failed. Status: ${response.status} ${response.statusText}`);
      if (response.status === 429) console.warn("[Singapore API] Rate limit exceeded.");
      return "";
    }
    
    const data = await response.json();
    
    // Robust check for data structure
    if (data?.result?.records && Array.isArray(data.result.records) && data.result.records.length > 0) {
      const records = data.result.records.map((r: any) => ({
        product: r.device_name || r.product_name || "Unknown Product",
        risk_class: r.risk_classification || "N/A",
        description: r.description || ""
      }));
      return `Match found in Singapore HSA Database: ${JSON.stringify(records)}`;
    }
    return "";
  } catch (error: any) {
    if (error.name === 'AbortError') {
        console.warn("[Singapore API] Request timed out (exceeded 5000ms).");
    } else {
        console.warn("[Singapore API] Network/Parsing Error:", error.message);
    }
    return "";
  }
}

// 2. UAE Data (Dubai Pulse)
async function fetchUAEData(query: string): Promise<string> {
  const token = process.env.UAE_API_TOKEN;
  if (!token) {
    console.warn("[UAE API] Skipping: No API Token found in environment variables (UAE_API_TOKEN).");
    return ""; 
  }

  try {
    const url = `https://api.dubaipulse.gov.ae/shared/customs?commoditydescription=${encodeURIComponent(query)}`;
    const response = await fetchWithTimeout(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        console.error("[UAE API] Authentication failed. Check UAE_API_TOKEN validity.");
      } else {
        console.warn(`[UAE API] Request failed. Status: ${response.status} ${response.statusText}`);
      }
      return "";
    }
    
    // Robust check for text/json content type before parsing
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1) {
        const data = await response.json();
        return `Match found in Dubai Customs Database: ${JSON.stringify(data)}`;
    }
    return "";
  } catch (error: any) {
    if (error.name === 'AbortError') {
        console.warn("[UAE API] Request timed out.");
    } else {
        console.warn("[UAE API] Error:", error.message);
    }
    return "";
  }
}

// 3. Saudi Arabia Data (ZATCA)
async function fetchSaudiData(query: string): Promise<string> {
  const token = process.env.SAUDI_API_TOKEN;
  if (!token) {
     console.warn("[Saudi API] Skipping: No API Token found in environment variables (SAUDI_API_TOKEN).");
     return ""; 
  }

  try {
    const url = `https://zatca.gov.sa/api/tariff/v1/search?description=${encodeURIComponent(query)}&language=en`;
    const response = await fetchWithTimeout(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Client-ID': 'HScodeCentrovert-App',
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
         console.error("[Saudi API] Authentication failed. Check SAUDI_API_TOKEN.");
      } else if (response.status === 503) {
         console.warn("[Saudi API] Service unavailable (Maintenance).");
      } else {
         console.warn(`[Saudi API] Request failed. Status: ${response.status} ${response.statusText}`);
      }
      return "";
    }
    
    const data = await response.json();
    // ZATCA API structure validation
    if (data && (Array.isArray(data) || data.items)) {
         return `Match found in ZATCA Tariff Schedule: ${JSON.stringify(data)}`;
    }
    return "";
  } catch (error: any) {
    if (error.name === 'AbortError') {
        console.warn("[Saudi API] Request timed out.");
    } else {
        console.warn("[Saudi API] Error:", error.message);
    }
    return "";
  }
}

// --- Main Classification Logic ---

export const identifyHSCode = async (
  productDescription: string,
  region: TargetRegion,
  imageBase64?: string
): Promise<HSCodeResult> => {
  // We use the Gemini 2.5 Flash model which supports Google Search Grounding
  const modelId = "gemini-2.5-flash";

  // 1. Attempt to fetch Live Data (RAG Pattern)
  let liveDataContext = "";
  let regionSpecificInstructions = "";
  let tools: any[] = [];

  // Safely determine context based on region
  try {
      if (region === TargetRegion.SINGAPORE) {
        // For Singapore, we use Google Search Grounding to get specific 8-digit codes
        tools = [{ googleSearch: {} }];
        
        // We still attempt the API fetch as a secondary source
        const apiData = await fetchSingaporeData(productDescription);
        if (apiData) liveDataContext += apiData + "\n";

        regionSpecificInstructions = `
          - **CRITICAL**: You MUST use the Google Search Tool to find the exact 8-digit HS Code from the Singapore Customs TradeNet or 'customs.gov.sg' website.
          - The last 2 digits are crucial. Do not default to '00' unless verified.
          - Standard GST is 9%.
          - Check for SFA (Food), HSA (Health Sciences), or Strategic Goods Control controls.
        `;
      } else if (region === TargetRegion.SAUDI_ARABIA) {
        liveDataContext = await fetchSaudiData(productDescription);
        regionSpecificInstructions = `
          - **CRITICAL**: Use the **Saudi ZATCA Integrated Tariff**.
          - Provide **10-digit or 12-digit codes** where applicable (National Subheadings).
          - **VAT**: Standard VAT in Saudi Arabia is **15%**.
          - **Restrictions**: You MUST check for **Saber Platform** registration requirements.
          - Check for **SASO** (Standards), **SFDA** (Food/Drug), or **CITC** (Telecom) requirements.
        `;
      } else if (region === TargetRegion.UAE) {
        liveDataContext = await fetchUAEData(productDescription);
        regionSpecificInstructions = `
          - Use the GCC Common Customs Tariff as applied by Dubai Customs.
          - Provide 8-digit codes.
          - Standard VAT is 5%.
        `;
      } else if (region === TargetRegion.INDIA) {
        tools = [{ googleSearch: {} }]; // Use Search for ITC-HS
        regionSpecificInstructions = `
          - Use the **ITC-HS (Indian Trade Clarification based on Harmonized System)**.
          - Provide 8-digit codes.
          - **Tax**: Calculate **IGST** (Integrated GST) which is typically 5%, 12%, 18%, or 28%. Mention Social Welfare Surcharge (SWS) if applicable (usually 10% of BCD).
          - **Restrictions**: Check for **BIS** (Bureau of Indian Standards) CRO requirements, **FSSAI** for food, and **DGFT** (Directorate General of Foreign Trade) Import Policy (Free/Restricted/Prohibited).
        `;
      } else if (region === TargetRegion.MALAYSIA) {
        tools = [{ googleSearch: {} }]; // Use Search for PDK
        regionSpecificInstructions = `
          - Use the **Malaysian Customs Duties Order (PDK)** and ASEAN Harmonized Tariff Nomenclature (AHTN).
          - Provide 10-digit codes where possible, otherwise 8-digit AHTN.
          - **Tax**: Apply **SST** (Sales and Service Tax). Sales tax is typically 5% or 10%.
          - **Restrictions**: Check for **SIRIM** approval for electronics, **MAQIS** for agriculture, and **NPRA** for cosmetics/drugs. Mention Approved Permits (AP) if required.
        `;
      } else {
        liveDataContext = await fetchUAEData(productDescription); 
        regionSpecificInstructions = `
          - Use the Unified GCC Customs Tariff.
          - Provide 8-digit codes.
          - Standard VAT varies by country.
        `;
      }
  } catch (err) {
      console.warn("Error during context gathering:", err);
      // Fail silently on context gathering to ensure main classification still proceeds
  }

  // 2. Construct Parts for Multimodal Input
  const parts: any[] = [];

  // Add Image if present
  if (imageBase64) {
    // Remove data url prefix if present (data:image/jpeg;base64,)
    const cleanBase64 = imageBase64.split(',')[1] || imageBase64;
    parts.push({
      inlineData: {
        data: cleanBase64,
        mimeType: "image/jpeg" 
      }
    });
  }

  // Add Text Prompt with JSON Requirement
  const promptText = `
    Act as an expert Customs Broker and Trade Compliance Specialist for ${region}.
    
    Your task is to classify the following product into its correct Harmonized System (HS) Code.
    
    ${imageBase64 ? "Note: An image of the product has been provided. Use visual details (material, packaging, type) to refine the classification." : ""}
    
    Product Description provided by user: "${productDescription}"
    Target Import Country: "${region}"
    
    *** REAL-TIME DATA CONTEXT (High Priority) ***
    ${liveDataContext ? liveDataContext : "No direct match in live government databases. Rely on internal knowledge or Google Search."}
    **********************************************

    Guidelines:
    1. If 'Real-Time Data Context' contains a match, prioritize that classification and set 'confidenceScore' to 95 or higher. Set 'source' to 'Live API'.
    2. If Google Search was used to find the code, set 'source' to 'Live API'.
    3. If relying on internal training, set 'source' to 'AI Model'.
    4. **Region Specific Rules**: ${regionSpecificInstructions}
    
    Analyze the material, function, and composition of the product to determine the code.

    **IMPORTANT: RESPONSE FORMAT**
    You MUST return a VALID JSON object. Do not include markdown code blocks.
    The JSON must follow this structure exactly:
    {
      "hsCode": "string (8-12 digits)",
      "productName": "string",
      "description": "string (Official Tariff Description)",
      "dutyRate": "string (e.g., '5%', 'Free')",
      "taxRate": "string (e.g., '9% GST')",
      "restrictions": ["string (restriction 1)", "string (restriction 2)"],
      "reasoning": "string",
      "confidenceScore": number (0-100),
      "requiredDocuments": ["string (doc 1)", "string (doc 2)"],
      "source": "Live API" | "AI Model"
    }
  `;
  
  parts.push({ text: promptText });

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: { parts: parts },
      config: {
        // NOTE: responseMimeType cannot be set when using tools like Google Search.
        // We rely on the prompt to enforce JSON format.
        temperature: 0.1,
        systemInstruction: "You are a strict and precise trade compliance AI. You prioritize official national tariff books over generic HS codes. You ALWAYS output valid raw JSON.",
        tools: tools.length > 0 ? tools : undefined,
      },
    });

    const textResponse = response.text;
    if (!textResponse) {
      throw new Error("No response from AI");
    }

    // Robust Cleaning and Parsing
    const result: HSCodeResult = cleanAndParseJSON(textResponse);
    
    // Post-process: If search tool was used, ensure source is marked correctly if high confidence
    if (tools.length > 0 && result.confidenceScore > 85) {
        result.source = 'Live API';
    }

    return result;

  } catch (error) {
    console.error("Error identifying HS Code:", error);
    throw error;
  }
};
