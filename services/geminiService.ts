import { GoogleGenAI, Type, Schema } from "@google/genai";
import { TargetRegion, HSCodeResult } from "../types";

// Initialize the Gemini Client
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || '' });

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
  imageBase64?: string,
  onStatusUpdate?: (status: string) => void
): Promise<HSCodeResult> => {
  // We use the Gemini 2.5 Flash model which supports Google Search Grounding
  const modelId = "gemini-2.5-flash";

  if (onStatusUpdate) onStatusUpdate("Initializing classification engine...");

  // 1. Attempt to fetch Live Data (RAG Pattern)
  let liveDataContext = "";
  let regionSpecificInstructions = "";
  let tools: any[] = [];

  // Safely determine context based on region
  try {
    if (region === TargetRegion.SINGAPORE) {
      if (onStatusUpdate) onStatusUpdate("Searching Singapore TradeNet & AHTN...");
      // For Singapore, we use Google Search Grounding to get specific 8-digit codes
      tools = [{ googleSearch: {} }];

      // We still attempt the API fetch as a secondary source
      const apiData = await fetchSingaporeData(productDescription);
      if (apiData) liveDataContext += apiData + "\n";

      regionSpecificInstructions = `
          - **TARGET DATABASE**: Singapore TradeNet / AHTN 2022/2024.
          - **ACCURACY PROTOCOL**: You MUST verify the 8-digit code via Search. For example, 'Laptops' are '8471.30.20', NOT '8471.30.10'.
          - **CITATION**: You must state "Verified against Singapore Customs AHTN [Year]" in the 'sourceReference' field.
          - **SEARCH STRATEGY**: Search for "Singapore Customs HS Code [product]" and look for the 'AHTN 2022' column.
          - **TAX**: Standard GST is 9%.
          - **CONTROLS**: Check for SFA (Food), HSA (Health Sciences), or Strategic Goods Control.
        `;
    } else if (region === TargetRegion.SAUDI_ARABIA) {
      if (onStatusUpdate) onStatusUpdate("Querying ZATCA Tariff Database...");
      liveDataContext = await fetchSaudiData(productDescription);
      regionSpecificInstructions = `
          - **TARGET DATABASE**: Saudi ZATCA Integrated Tariff.
          - **ACCURACY PROTOCOL**: Look for 10-digit or 12-digit national codes.
          - **CITATION**: State "Verified against Saudi ZATCA Tariff" in 'sourceReference'.
          - **SEARCH STRATEGY**: Search for "Saudi Customs Tariff [product] code".
          - **TAX**: Standard VAT is 15%.
          - **COMPLIANCE**: Check for **Saber Platform** & **SASO** IECEE requirements.
        `;
    } else if (region === TargetRegion.UAE) {
      if (onStatusUpdate) onStatusUpdate("Checking Dubai Customs Records...");
      liveDataContext = await fetchUAEData(productDescription);
      regionSpecificInstructions = `
          - **TARGET DATABASE**: GCC Unified Customs Tariff (Dubai Customs).
          - **ACCURACY PROTOCOL**: Provide the 8-digit GCC code.
          - **CITATION**: State "Verified against GCC Common Tariff" in 'sourceReference'.
          - **TAX**: Standard VAT is 5%.
        `;
    } else if (region === TargetRegion.INDIA) {
      if (onStatusUpdate) onStatusUpdate("Searching ITC-HS & DGFT Policies...");
      tools = [{ googleSearch: {} }]; // Use Search for ITC-HS
      regionSpecificInstructions = `
          - **TARGET DATABASE**: ITC-HS 2022 (Indian Trade Clarification).
          - **ACCURACY PROTOCOL**: Identify the specific 8-digit subheading. Example: 'Smartphones' -> '8517.13.00'.
          - **CITATION**: State "Verified against Indian ITC-HS 2022" in 'sourceReference'.
          - **TAX**: Calculate BCD + SWS + IGST.
          - **COMPLIANCE**: Check BIS (CRO), WPC (Wireless), and DGFT Import Policy.
        `;
    } else if (region === TargetRegion.MALAYSIA) {
      if (onStatusUpdate) onStatusUpdate("Consulting Malaysian Customs (PDK)...");
      tools = [{ googleSearch: {} }]; // Use Search for PDK
      regionSpecificInstructions = `
          - **TARGET DATABASE**: Malaysian Customs Duties Order (PDK 2022/2024).
          - **ACCURACY PROTOCOL**: Provide 10-digit codes where possible (PDK split).
          - **CITATION**: State "Verified against Malaysia PDK 2022/2024" in 'sourceReference'.
          - **TAX**: SST (Sales Tax 5% or 10%).
          - **COMPLIANCE**: Check SIRIM (Electronics) & MAQIS.
        `;
    } else {
      if (onStatusUpdate) onStatusUpdate("Consulting Global WCO Standards...");
      liveDataContext = await fetchUAEData(productDescription);
      regionSpecificInstructions = `
          - **TARGET DATABASE**: WCO Harmonized System (2022 Edition).
          - **ACCURACY PROTOCOL**: Provide 6-digit global code.
          - **CITATION**: State "Based on WCO General Rules 2022" in 'sourceReference'.
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
    if (onStatusUpdate) onStatusUpdate("Analyzing product image features...");
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
    
    Your task is to classify the following product into its correct Harmonized System (HS) Code and suggest similar items with HIGH ACCURACY.
    
    ${imageBase64 ? "Note: An image of the product has been provided. Use visual details (material, packaging, type) to refine the classification." : ""}
    
    Product Description provided by user: "${productDescription}"
    Target Import Country: "${region}"
    
    *** REAL-TIME DATA CONTEXT (High Priority) ***
    ${liveDataContext ? liveDataContext : "No direct match in pre-fetched government databases. Rely on Google Search Tool."}
    **********************************************

    Guidelines:
    1. **MAIN CLASSIFICATION (High Accuracy)**: 
       - Identify the exact 8-digit (or 10/12-digit) HS Code for ${region}. 
       - **VERIFICATION**: You MUST use the Google Search Tool to find the official Tariff Schedule for ${region} (e.g., AHTN, ITC-HS, ZATCA).
       - **ANTI-HALLUCINATION**: Do not invent generic suffixes (like .00 or .10) if they don't exist in the *current* tariff book (post-2022).
       - **LEGACY CHECK**: Ensure you are not using pre-2022 codes (e.g., check if '9705.00' is now split into '9705.29', etc.).
    
    2. **CITATION (Crucial)**:
       - You MUST populate the 'sourceReference' field.
       - Tell the user EXACTLY which document you used (e.g., "Singapore TradeNet AHTN 2022", "ZATCA Integrated Tariff 2024"). 
       - If you inferred the code from general WCO rules because a national match wasn't found, state: "Inferred from WCO General Rules (National sub-heading not found)".
    
    3. **SIMILAR ITEMS**: 
       - Return at least 5 similar or related items from the same HS Chapter or functionality group.
       - This is crucial for users if their input was ambiguous.
       
    4. **Region Specific Rules**: ${regionSpecificInstructions}

    5. **Source Attribution**: If you found the code via Google Search in an official document, set 'source' to 'Live API'.

    **IMPORTANT: RESPONSE FORMAT**
    You MUST return a VALID JSON object. Do not include markdown code blocks.
    The JSON must follow this structure exactly:
    {
      "hsCode": "string (Prefer 8+ digits if verified, else 6)",
      "productName": "string (Official Tariff Name)",
      "description": "string (Full Description from Tariff Book)",
      "dutyRate": "string (e.g., '5%', 'Free')",
      "taxRate": "string (e.g., '9% GST')",
      "restrictions": ["string (restriction 1)", "string (restriction 2)"],
      "reasoning": "string (Explain exactly why this 8-digit code was chosen over others. Cite the specific tariff heading/subheading logic.)",
      "confidenceScore": number (0-100),
      "requiredDocuments": ["string (doc 1)", "string (doc 2)"],
      "source": "Live API" | "AI Model",
      "sourceReference": "string (Exact name of the Tariff Book or Authority verified against)",
      "similarItems": [
        {
          "name": "string (similar product name)",
          "hsCode": "string (HS Code)",
          "reason": "string (1 sentence reason for similarity)"
        }
      ]
    }
  `;

  parts.push({ text: promptText });

  try {
    if (onStatusUpdate) onStatusUpdate("Synthesizing final compliance report...");
    const response = await ai.models.generateContent({
      model: modelId,
      contents: { parts: parts },
      config: {
        // NOTE: responseMimeType cannot be set when using tools like Google Search.
        // We rely on the prompt to enforce JSON format.
        temperature: 0.05, // Very low temperature for maximum determinism and accuracy
        systemInstruction: "You are a strict Trade Compliance Officer. Your only goal is ACCURACY. You prioritize official government tariff schedules over general knowledge. You verify every 8-digit code against the country's specific tariff book (AHTN, ITC-HS, etc.) using Google Search. You never halluciante suffixes.",
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