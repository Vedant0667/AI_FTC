/**
 * RAG Document Ingestion
 * Fetches and processes FTC documentation sources for vector storage
 */

import { FTCDocument } from '../types';
import { FTC_SOURCES, TOP_TEAM_REPOS, CURRENT_SEASON, CHUNK_SIZE, CHUNK_OVERLAP, DocumentChunk } from './types';

// Simple text chunking with overlap
export function chunkText(text: string, chunkSize: number = CHUNK_SIZE, overlap: number = CHUNK_OVERLAP): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start += chunkSize - overlap;
  }

  return chunks;
}

// Convert FTCDocument to searchable chunks
export function documentToChunks(doc: FTCDocument): DocumentChunk[] {
  const textChunks = chunkText(doc.content);

  return textChunks.map((content, index) => ({
    id: `${doc.id}-chunk-${index}`,
    documentId: doc.id,
    content,
    metadata: {
      title: doc.title,
      sourceURL: doc.sourceURL,
      seasonTag: doc.seasonTag,
      sourcePriority: doc.sourcePriority,
      chunkIndex: index,
      totalChunks: textChunks.length,
    },
  }));
}

/**
 * Fetch GitHub repository content
 * Uses GitHub REST API to fetch Java files from FTC repos
 */
export async function fetchGitHubContent(repoURL: string, paths: string[]): Promise<FTCDocument[]> {
  console.log(`[Ingest] Fetching from GitHub: ${repoURL}`);

  const docs: FTCDocument[] = [];

  // Parse GitHub URL: https://github.com/OWNER/REPO
  const match = repoURL.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (!match) {
    console.error('Invalid GitHub URL format');
    return [];
  }

  const [, owner, repo] = match;

  try {
    // Fetch repository tree to get all files
    const treeResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/master?recursive=1`,
      {
        headers: {
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }
    );

    if (!treeResponse.ok) {
      console.error(`GitHub API error: ${treeResponse.status}`);
      return [];
    }

    const treeData = await treeResponse.json();

    // Filter for code and docs (.java, .kt, .md, .rst) in relevant paths
    const codeFiles = treeData.tree.filter((item: any) => {
      if (item.type !== 'blob') return false;

      const isCodeFile = item.path.endsWith('.java') ||
                         item.path.endsWith('.kt') ||
                         item.path.endsWith('.md') ||
                         item.path.endsWith('.rst');

      if (!isCodeFile) return false;

      // Check if file is in one of the specified paths
      return paths.some(p => item.path.startsWith(p));
    });

    console.log(`[Ingest] Found ${codeFiles.length} code files in ${owner}/${repo}`);

    // Fetch ALL files - no artificial limits
    const filesToFetch = codeFiles;

    for (const file of filesToFetch) {
      try {
        // Use raw.githubusercontent.com to bypass API rate limits
        const contentResponse = await fetch(
          `https://raw.githubusercontent.com/${owner}/${repo}/master/${file.path}`
        );

        if (contentResponse.ok) {
          const content = await contentResponse.text();

          docs.push({
            id: `github-${owner}-${repo}-${file.sha}`,
            title: file.path,
            content,
            sourceURL: `https://github.com/${owner}/${repo}/blob/master/${file.path}`,
            seasonTag: CURRENT_SEASON,
            sourcePriority: 1,
            lastUpdated: new Date(),
          });
        } else {
          console.error(`Failed to fetch ${file.path}: ${contentResponse.status}`);
        }

        // Small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (error) {
        console.error(`Error fetching ${file.path}:`, error);
      }
    }

  } catch (error) {
    console.error(`GitHub fetch error:`, error);
  }

  return docs;
}

/**
 * Fetch web documentation
 * Fetches markdown/HTML content and extracts text
 */
export async function fetchWebContent(baseURL: string, paths?: string[]): Promise<FTCDocument[]> {
  console.log(`[Ingest] Fetching from web: ${baseURL}`);

  const docs: FTCDocument[] = [];
  const urlsToFetch = paths ? paths.map(p => `${baseURL}${p}`) : [baseURL];

  for (const url of urlsToFetch) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'FTC-AI-Workbench/1.0',
        },
      });

      if (!response.ok) {
        console.error(`[Ingest] Failed to fetch ${url}: ${response.status}`);
        continue;
      }

      const html = await response.text();

      // Extract text content (remove HTML tags)
      const text = html
        .replace(/<script[^>]*>.*?<\/script>/gis, '')
        .replace(/<style[^>]*>.*?<\/style>/gis, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (text.length > 100) {
        docs.push({
          id: `web-${url.replace(/[^a-zA-Z0-9]/g, '-')}`,
          title: url.split('/').pop() || url,
          content: text,
          sourceURL: url,
          seasonTag: CURRENT_SEASON,
          sourcePriority: 8,
          lastUpdated: new Date(),
        });
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`[Ingest] Error fetching ${url}:`, error);
    }
  }

  return docs;
}

/**
 * Ingest top FTC team repositories
 */
export async function ingestTopTeams(): Promise<FTCDocument[]> {
  const allDocs: FTCDocument[] = [];

  console.log('[Ingest] Fetching top FTC team repositories...');

  for (const team of TOP_TEAM_REPOS) {
    try {
      const docs = await fetchGitHubContent(team.url, team.paths);

      docs.forEach(doc => {
        doc.sourcePriority = team.priority;
        doc.seasonTag = doc.seasonTag || CURRENT_SEASON;
      });

      allDocs.push(...docs);
      console.log(`[Ingest] Loaded ${docs.length} documents from ${team.name}`);
    } catch (error) {
      console.error(`[Ingest] Failed to load ${team.name}:`, error);
    }
  }

  return allDocs;
}

/**
 * Fetch PDF content
 */
export async function fetchPDFContent(url: string): Promise<FTCDocument[]> {
  console.log(`[Ingest] Fetching PDF: ${url}`);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Failed to fetch PDF: ${response.status}`);
      return [];
    }

    // For now, create a placeholder document
    // In production, would use pdf-parse or similar
    const doc: FTCDocument = {
      id: `pdf-${url.replace(/[^a-zA-Z0-9]/g, '-')}`,
      title: url.split('/').pop() || 'Competition Manual',
      content: `DECODE 2025-26 Competition Manual - Full rules and specifications available at ${url}`,
      sourceURL: url,
      seasonTag: CURRENT_SEASON,
      sourcePriority: 8,
      lastUpdated: new Date(),
    };

    return [doc];
  } catch (error) {
    console.error(`Error fetching PDF ${url}:`, error);
    return [];
  }
}

/**
 * Ingest all configured FTC sources
 * This should be run once to populate the vector store
 */
export async function ingestAllSources(): Promise<FTCDocument[]> {
  const allDocs: FTCDocument[] = [];

  // First, ingest top teams (highest priority after SDK)
  console.log('[Ingest] Phase 1: Top team repositories');
  const teamDocs = await ingestTopTeams();
  allDocs.push(...teamDocs);

  // Then ingest official sources
  console.log('[Ingest] Phase 2: Official FTC sources');
  for (const source of FTC_SOURCES) {
    try {
      let docs: FTCDocument[] = [];

      if (source.type === 'github' && 'paths' in source) {
        docs = await fetchGitHubContent(source.url, source.paths);
      } else if (source.type === 'web') {
        const paths = 'paths' in source ? source.paths : undefined;
        docs = await fetchWebContent(source.url, paths);
      } else if (source.type === 'pdf') {
        docs = await fetchPDFContent(source.url);
      }

      // Add metadata
      docs.forEach(doc => {
        doc.sourcePriority = source.priority;
        doc.seasonTag = doc.seasonTag || CURRENT_SEASON;
        doc.lastUpdated = new Date();
      });

      allDocs.push(...docs);
      console.log(`[Ingest] Loaded ${docs.length} documents from ${source.name}`);
    } catch (error) {
      console.error(`[Ingest] Failed to load ${source.name}:`, error);
    }
  }

  console.log(`[Ingest] Total documents ingested: ${allDocs.length}`);
  return allDocs;
}

/**
 * Fetch user's team repository
 */
export async function fetchUserRepo(repoURL: string): Promise<FTCDocument[]> {
  console.log(`[Ingest] Fetching user team repository: ${repoURL}`);

  try {
    const docs = await fetchGitHubContent(repoURL, ['TeamCode/src/main/java']);

    docs.forEach(doc => {
      doc.sourcePriority = 9; // USER_REPO priority
      doc.seasonTag = CURRENT_SEASON;
    });

    console.log(`[Ingest] Loaded ${docs.length} files from user repository`);
    return docs;
  } catch (error) {
    console.error('[Ingest] Failed to fetch user repository:', error);
    return [];
  }
}

/**
 * Manual document addition
 * Use this to add custom documentation or examples
 */
export function createDocument(
  title: string,
  content: string,
  sourceURL: string,
  priority: number,
  seasonTag: string = CURRENT_SEASON
): FTCDocument {
  return {
    id: `manual-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title,
    content,
    sourceURL,
    seasonTag,
    sourcePriority: priority,
    lastUpdated: new Date(),
  };
}

// Example seed documents for initial testing
export const SEED_DOCUMENTS: FTCDocument[] = [
  createDocument(
    'FTC SDK Overview',
    `The FTC SDK (Software Development Kit) provides the core libraries and tools for programming FTC robots.

Key components:
- OpMode base classes (LinearOpMode, OpMode)
- Hardware interfaces (DcMotor, Servo, etc.)
- Vision processing (VisionPortal, AprilTag detection)
- Telemetry system
- Configuration system

All OpModes must extend either LinearOpMode or OpMode and be annotated with @TeleOp or @Autonomous.

Example structure:
@Autonomous(name="Basic Auto")
public class BasicAuto extends LinearOpMode {
    @Override
    public void runOpMode() {
        // Hardware initialization
        waitForStart();
        // Autonomous logic
    }
}

Source: https://ftc-docs.firstinspires.org/ftc_sdk/overview/index.html`,
    'https://ftc-docs.firstinspires.org/ftc_sdk/overview/index.html',
    2
  ),

  createDocument(
    'Limelight FTC Integration',
    `Limelight is an external vision processor that can be used for AprilTag detection and object tracking in FTC.

Setup:
1. Connect Limelight to Robot Controller via USB
2. Configure team number in Limelight web interface
3. Set pipeline index for desired detection mode

Code integration:
import org.firstinspires.ftc.robotcore.external.hardware.camera.controls.ExposureControl;
import com.qualcomm.hardware.limelightvision.LLResult;
import com.qualcomm.hardware.limelightvision.Limelight3A;

Limelight3A limelight;
limelight = hardwareMap.get(Limelight3A.class, "limelight");
limelight.pipelineSwitch(0);
limelight.start();

LLResult result = limelight.getLatestResult();
if (result != null && result.isValid()) {
    // Process detection results
}

Source: https://docs.limelightvision.io/docs/docs-limelight/apis/ftc-programming`,
    'https://docs.limelightvision.io/docs/docs-limelight/apis/ftc-programming',
    6
  ),

  createDocument(
    'Road Runner Quickstart',
    `Road Runner is a motion planning library for FTC that enables smooth, accurate autonomous movement.

Coordinate System:
- X axis: Forward (towards field forward)
- Y axis: Left (towards driver's left)
- Heading: Counter-clockwise positive (radians)

Key classes:
- MecanumDrive / TankDrive: Base drive classes
- DriveConstants: Physical robot parameters
- TrajectoryBuilder: Creates motion paths

Setup steps:
1. Add Road Runner dependency to build.gradle
2. Create DriveConstants.java with robot measurements
3. Run tuning OpModes (straight test, turn test, track width)
4. Build trajectories in Autonomous

Example:
Trajectory traj = drive.trajectoryBuilder(new Pose2d())
    .forward(24)
    .turn(Math.toRadians(90))
    .build();
drive.followTrajectory(traj);

Source: https://learnroadrunner.com`,
    'https://learnroadrunner.com',
    3
  ),
];
