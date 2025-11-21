export enum TargetRegion {
  SINGAPORE = 'Singapore',
  MALAYSIA = 'Malaysia',
  INDIA = 'India',
  UAE = 'UAE',
  SAUDI_ARABIA = 'Saudi Arabia',
  QATAR = 'Qatar',
  OMAN = 'Oman',
  BAHRAIN = 'Bahrain',
  KUWAIT = 'Kuwait',
  GLOBAL = 'Global (6-digit)'
}

export interface HSCodeResult {
  hsCode: string;
  productName: string;
  description: string;
  dutyRate: string;
  taxRate: string; // VAT or GST
  restrictions: string[];
  reasoning: string;
  confidenceScore: number; // 0-100
  requiredDocuments: string[];
  source?: 'Live API' | 'AI Model'; // New field to track data origin
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model' | 'system';
  content: string | HSCodeResult;
  timestamp: number;
}