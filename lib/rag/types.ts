/**
 * RAG-specific type definitions and constants
 */

import { FTCDocument } from '../types';

export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  embedding?: number[];
  metadata: {
    title: string;
    sourceURL: string;
    seasonTag: string;
    sourcePriority: number;
    chunkIndex: number;
    totalChunks: number;
  };
}

export interface EmbeddingModel {
  embed(texts: string[]): Promise<number[][]>;
  embedQuery(text: string): Promise<number[]>;
}

export interface VectorStore {
  addDocuments(chunks: DocumentChunk[]): Promise<void>;
  similaritySearch(query: string, k: number): Promise<{ chunk: DocumentChunk; score: number }[]>;
  clear(): Promise<void>;
}

// Source priority mapping (lower = higher priority)
export enum SourcePriority {
  SDK = 1,
  TOP_TEAMS = 2,
  ROADRUNNER = 3,
  FTCLIB = 4,
  LIMELIGHT = 5,
  PHOTONVISION = 6,
  DASHBOARD = 7,
  OFFICIAL_DOCS = 8,
  USER_REPO = 9,
}

// Top FTC teams repositories (World Championship finalists/winners)
export const TOP_TEAM_REPOS = [
  {
    name: 'Team 11212 Clueless - 2024 World Champions',
    url: 'https://github.com/FTCclueless/CenterStage',
    priority: SourcePriority.TOP_TEAMS,
    type: 'github',
    paths: ['TeamCode/src/main/java'],
  },
  {
    name: 'Team 11212 Clueless - Into The Deep 2024-2025',
    url: 'https://github.com/FTCclueless/IntoTheDeep',
    priority: SourcePriority.TOP_TEAMS,
    type: 'github',
    paths: ['TeamCode/src/main/java'],
  },
  {
    name: 'Team 21229 Quality Control - Pedro Pathing',
    url: 'https://github.com/21229QualityControl/Pedro-Pathing-Quickstart',
    priority: SourcePriority.TOP_TEAMS,
    type: 'github',
    paths: ['TeamCode/src/main/java'],
  },
  {
    name: 'Team 492 Titan Robotics - Multi-Year',
    url: 'https://github.com/trc492/Ftc2024CenterStage',
    priority: SourcePriority.TOP_TEAMS,
    type: 'github',
    paths: ['TeamCode/src/main/java'],
  },
  {
    name: 'Team 16481 RoboRacers - CenterStage',
    url: 'https://github.com/RoboRacers/FtcRobotController-2024',
    priority: SourcePriority.TOP_TEAMS,
    type: 'github',
    paths: ['TeamCode/src/main/java'],
  },
] as const;

// FTC documentation sources to ingest
export const FTC_SOURCES = [
  {
    name: 'FTC SDK - Official Samples',
    url: 'https://github.com/FIRST-Tech-Challenge/FtcRobotController',
    priority: SourcePriority.SDK,
    type: 'github',
    paths: [
      'FtcRobotController/src/main/java/org/firstinspires/ftc/robotcontroller/external/samples',
    ],
  },
  {
    name: 'FTC SDK - Hardware Layer',
    url: 'https://github.com/FIRST-Tech-Challenge/FtcRobotController',
    priority: SourcePriority.SDK,
    type: 'github',
    paths: [
      'RobotCore/src/main/java/com/qualcomm/robotcore/hardware',
      'Hardware/src/main/java/com/qualcomm/hardware',
    ],
  },
  {
    name: 'Road Runner Quickstart - Complete Examples',
    url: 'https://github.com/acmerobotics/road-runner-quickstart',
    priority: SourcePriority.ROADRUNNER,
    type: 'github',
    paths: [
      'TeamCode/src/main/java/org/firstinspires/ftc/teamcode',
    ],
  },
  {
    name: 'Pedro Pathing - Official Quickstart',
    url: 'https://github.com/Pedro-Pathing/Quickstart',
    priority: SourcePriority.ROADRUNNER,
    type: 'github',
    paths: ['TeamCode/src/main/java'],
  },
  {
    name: 'FTCLib - Core Library',
    url: 'https://github.com/FTCLib/FTCLib',
    priority: SourcePriority.FTCLIB,
    type: 'github',
    paths: [
      'core/src/main/java/com/arcrobotics/ftclib',
    ],
  },
  {
    name: 'FTCLib - Examples',
    url: 'https://github.com/FTCLib/FTCLib',
    priority: SourcePriority.FTCLIB,
    type: 'github',
    paths: ['examples/src/main/java'],
  },
  {
    name: 'EasyOpenCV - Vision Library',
    url: 'https://github.com/OpenFTC/EasyOpenCV',
    priority: SourcePriority.LIMELIGHT,
    type: 'github',
    paths: [
      'easyopencv/src/main/java/org/openftc/easyopencv',
      'examples/src/main/java',
    ],
  },
  {
    name: 'EOCV AprilTag Plugin - Examples',
    url: 'https://github.com/OpenFTC/EOCV-AprilTag-Plugin',
    priority: SourcePriority.LIMELIGHT,
    type: 'github',
    paths: ['examples/src/main/java/org/firstinspires/ftc/teamcode'],
  },
  {
    name: 'Game Manual 0 - Best Practices',
    url: 'https://github.com/gamemanual0/gm0',
    priority: SourcePriority.OFFICIAL_DOCS,
    type: 'github',
    paths: ['source/docs'],
  },
  {
    name: 'DECODE 2025-26 Competition Manual',
    url: 'https://firstinspires.blob.core.windows.net/ftc/2024-25/Competition-Manual.pdf',
    priority: SourcePriority.OFFICIAL_DOCS,
    type: 'pdf',
  },
  {
    name: 'FTC Resources - Official Documentation',
    url: 'https://ftc-resources.firstinspires.org',
    priority: SourcePriority.OFFICIAL_DOCS,
    type: 'web',
  },
] as const;

export const CURRENT_SEASON = 'DECODE 2025-26';

// Chunking configuration
export const CHUNK_SIZE = 1000;  // characters
export const CHUNK_OVERLAP = 200; // characters

// Retrieval configuration
export const DEFAULT_TOP_K = 10; // Increased from 5 to get more context
export const RELEVANCE_THRESHOLD = 0.0; // Accept all matches, let priority weighting sort them
