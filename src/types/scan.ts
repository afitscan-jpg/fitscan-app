export type VerdictColor = 'green' | 'amber' | 'red' | 'grey';
export type Grade = 'A' | 'B' | 'C' | 'D' | 'E';
export type Verdict = 'Good' | 'OK' | 'Avoid' | 'Unknown';

export interface ScanNutrients {
  energy_kcal: number | null;
  sugars_g: number | null;
  fat_g: number | null;
  saturated_fat_g: number | null;
  carbs_g: number | null;
  salt_g: number | null;
  protein_g: number | null;
  fiber_g: number | null;
}

export interface ScanResult {
  score: number | null;   // null when the food couldn't be graded (unknown)
  grade: Grade | null;    // null when the food couldn't be graded (unknown)
  verdict: Verdict;
  verdict_color: VerdictColor;
  headline_hinglish: string;
  flags: string[];
  nutrients: ScanNutrients;       // always per 100 g/ml
  is_beverage: boolean;
  serving_g?: number | null;      // OFF serving size (g/ml); null/absent if unknown
  scored_basis?: 'serving' | 'per_100g';
}

export interface ScanResponse {
  status: 'ok' | 'not_found';
  barcode: string;
  name: string;
  brand: string;
  image_url: string | null;
  result?: ScanResult;
}
