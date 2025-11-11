/**
 * Shared type definitions for the FTC AI Wrapper application
 */

export type DriveType = 'mecanum' | 'tank' | 'omni';
export type Mode = 'full-generation' | 'assist' | 'copilot';
export type AIProvider = 'anthropic' | 'openai';

export interface RobotConfig {
  driveType: DriveType;
  wheelRadius: number;      // inches
  trackWidth: number;       // inches
  gearRatio: number;
  imuOrientation: string;   // e.g., "REV_HUB_LOGO_UP", "REV_HUB_LOGO_FORWARD"
  cameraModel: string;      // e.g., "Logitech C920", "Arducam OV9281"
  frameworkToggles: {
    roadrunner: boolean;
    ftclib: boolean;
    dashboard: boolean;
    externalVision: boolean;
  };
}

export interface GeneratedFile {
  path: string;
  content: string;
}

export interface GeneratedDiff {
  path: string;
  diff: string;
  commentary?: string;
}

export interface CopilotPlan {
  steps: string[];
  awaitingConfirmation: boolean;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface StreamRequest {
  mode: Mode;
  robotConfig: RobotConfig;
  userPrompt: string;
  conversationHistory?: Message[];
}

export interface StreamResponse {
  type: 'chunk' | 'done' | 'error';
  content?: string;
  error?: string;
}

export interface FileDownloadRequest {
  files: GeneratedFile[];
}

// RAG-specific types
export interface FTCDocument {
  id: string;
  title: string;
  content: string;
  sourceURL: string;
  seasonTag: string;        // e.g., "DECODE 2025-26"
  sourcePriority: number;   // 1=SDK, 2=Docs, 3=Tools, 4=Examples
  lastUpdated: Date;
}

export interface RAGQuery {
  query: string;
  topK?: number;
  seasonFilter?: string;
  sourcePriorityWeights?: Record<number, number>;
}

export interface RAGResult {
  documents: FTCDocument[];
  scores: number[];
}

// Vendor integration types
export interface LimelightConfig {
  teamNumber: number;
  pipelineIndex: number;
  usbPort?: string;
}

export interface PhotonVisionConfig {
  cameraName: string;
  ipAddress: string;
  port: number;
}

export const DEFAULT_ROBOT_CONFIG: RobotConfig = {
  driveType: 'mecanum',
  wheelRadius: 2.0,
  trackWidth: 14.0,
  gearRatio: 1.0,
  imuOrientation: 'REV_HUB_LOGO_UP',
  cameraModel: 'Logitech C920',
  frameworkToggles: {
    roadrunner: false,
    ftclib: false,
    dashboard: false,
    externalVision: false,
  },
};
