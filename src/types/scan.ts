export type VerdictColor = 'green' | 'amber' | 'red';
export type Grade = 'A' | 'B' | 'C' | 'D' | 'E';
export type Verdict = 'Good' | 'OK' | 'Avoid';

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
  score: number;
  grade: Grade;
  verdict: Verdict;
  verdict_color: VerdictColor;
  headline_hinglish: string;
  flags: string[];
  nutrients: ScanNutrients;
  is_beverage: boolean;
}

export interface ScanResponse {
  status: 'ok' | 'not_found';
  barcode: string;
  name: string;
  brand: string;
  image_url: string | null;
  result?: ScanResult;
}
