export type Stage =
  | 'draft' | 'locked' | 'rendered' | 'qa' | 'approved' | 'composed' | 'exported';

export type AssetType =
  | 'garment_raw' | 'garment_cut' | 'ghost' | 'view_front' | 'view_left'
  | 'view_right' | 'view_back' | 'tryon' | 'retouched' | 'composed'
  | 'model_sheet' | 'model_portrait' | 'model_expressions' | 'size_guide';

export interface Asset {
  id: string;
  project_id: string;
  product_id?: string;
  variant_id?: string;
  model_id?: string;
  type: AssetType;
  stage: Stage;
  parent_asset_id?: string;
  lock_id?: string;
  file_path: string;
  mime: string;
  width?: number;
  height?: number;
  qa_mode?: 'MOCK' | 'REAL';
  approval_evidence?: string;
  qa_json?: string;
  qa_score?: number;
  approved: number;
  created_at: string;
}

export interface ReferenceManifestEntry {
  order: number;
  imageIndex: number;
  assetId: string;
  role: 'identity_sheet' | 'garment_original' | 'garment_cut_support' | 'previous_render_support' | 'pose_source_support';
  type: AssetType;
  sha256: string;
  variantId: string | null;
}

export interface GarmentDNA {

  descriptor: string;
  verifiedAttributes: Record<string, string | number | null>;
  unknownAttributes: string[];
  lockCode?: string;
  sourceHashes?: string[];
  variantId?: string | null;
}

export interface Variant {
  id: string;
  product_id: string;
  color_name: string;
  color_hex?: string | null;
  sku?: string | null;
  status: string;
}

export interface GarmentLock {
  id: string;
  product_id: string;
  variant_id?: string | null;
  garment_dna_json?: string;
  source_asset_ids_json: string;
  qa_score?: number | null;
  approved: number;
  approved_at?: string | null;
  status: string;
  version: number;
  created_at: string;
}


export interface OpticalMetrics {
  deltaE: number;
  sharpness: number;
  resolutionOk: boolean;
  dimensions: string;
}

export interface QAControlReport {
  controlA_identity: { passed: boolean; confidence: number; details: string };
  controlB_prohibitedExclusion: {
    passed: boolean;
    noJewelryAdded: boolean;
    noLipstickChange: boolean;
    noMakeupChange: boolean;
    noSkinMarksImported: boolean;
    noAnatomyDeformation: boolean;
    violations: string[];
  };
  controlC_textileFidelity: { passed: boolean; silhouetteIntact: boolean; details: string };
  controlD_compositionPose: { passed: boolean; posePreserved: boolean; details: string };
  controlE_technicalQuality: { passed: boolean; details: string };
  suggestedAction: 'APPROVE' | 'ASSISTED_RETRY' | 'HALT_PRESERVE_PREVIOUS';
}

export interface QAResult {
  overallStatus: 'PASS' | 'FAIL';
  attributes: Record<string, 'MATCH' | 'POSSIBLE_MISMATCH' | 'MISMATCH' | 'NOT_VISIBLE'>;
  hasCriticalMismatch: boolean;
  notes: string;
  opticalMetrics?: OpticalMetrics;
  controls?: QAControlReport;
}

export interface SkinToneSwatch {
  hex: string;
  rgb: [number, number, number];
  percentage: number;
  label: string;
}

export interface ModelDNA {
  archetype_id?: string;
  name?: string;
  age_apparent?: number;
  height_m?: number;
  ethnicity?: string;
  body_type?: string;
  skin_tone?: string;
  skin_undertone?: string;
  skin_pore_visibility?: string;
  facial_features?: string[];
  eye_color?: string;
  hair_color?: string;
  hair_style?: string;
  makeup?: string;
  expression?: string;
  pose?: string;
  lighting_setup?: string;
  background?: string;
  resolution?: '1K' | '2K' | '4K';
  biometricPalette?: {
    classifiedTone: string;
    swatches: SkinToneSwatch[];
  };
}

export interface StylistScriptPart {
  section: 'INTRO' | 'DETAILS' | 'FIT' | 'STYLING' | 'CLOSING';
  durationSec: number;
  narration: string;
  visualFocus: string;
}

export interface StylistScenePlan {
  id: number;
  type: 'INTRO' | 'DETAIL' | 'FIT' | 'STYLING' | 'CLOSING';
  cameraAngle: string;
  movement: string;
  durationSec: number;
  description: string;
  linkedAssetId?: string;
}

export interface ProductScriptBundle {
  productId: string;
  generatedAt: string;
  model: string;
  parts: StylistScriptPart[];
  scenes: StylistScenePlan[];
  fullText: string;
}

export interface SubjectLandmarks {
  headTopY: number;
  eyeLineY: number;
  chinY: number;
  torsoCenterY: number;
  subjectCenterX: number;
  boundingBox: { minX: number; minY: number; maxX: number; maxY: number };
  confidence: 'HIGH' | 'FALLBACK_GEOMETRIC';
}

export interface QualityValidationCheck {
  passed: boolean;
  sourceIntegrityVerified: boolean;
  zeroScaleDistortion: boolean;
  resolutionVerified: boolean;
  outputSha256: string;
  sourceHashes: Record<string, string>;
  timestamp: string;
}

export interface Job {
  id: string;
  project_id?: string;
  type: string;
  status: 'queued' | 'running' | 'done' | 'failed';
  input_json?: string;
  output_json?: string;
  error?: string;
  model_used?: string;
  cost_usd?: number;
  started_at?: string;
  ended_at?: string;
  created_at: string;
}

export const STAGE_ORDER: Stage[] = ['draft', 'locked', 'rendered', 'qa', 'approved', 'composed', 'exported'];

