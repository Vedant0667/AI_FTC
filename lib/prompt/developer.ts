/**
 * DEVELOPER PROMPT: Context about the wrapper application
 * This is NOT sent to the model - it's documentation for how the wrapper is built
 */

export const DEVELOPER_CONTEXT = `
# FTC AI Wrapper - Developer Context

## Architecture
- Framework: Next.js 15 (App Router)
- Styling: Tailwind CSS (dark theme, accent: #4dd0e1)
- AI Providers: Claude (Anthropic) or GPT (OpenAI)
- RAG: LangChain-based document retrieval from FTC sources

## Folder Structure
\`\`\`
app/
  layout.tsx
  workbench/
    page.tsx
components/
  ModeToggle.tsx
  RobotConfigForm.tsx
  OutputSections.tsx
  FileDownloadBar.tsx
lib/
  prompt/
    system.ts          // SYSTEM prompt for AI
    developer.ts       // This file
  rag/
    query.ts           // RAG retrieval logic
    ingest.ts          // Document ingestion
    types.ts           // Type definitions
  vendors/
    limelight.ts       // Limelight USB interface
    photonvision.ts    // PhotonVision socket client
  types.ts             // Shared types
app/api/
  claude/
    route.ts           // Edge: streams AI responses
  files/
    route.ts           // Node: zips generated files
styles/
  globals.css
\`\`\`

## Mode Behavior

### Full Generation
- Generate complete, buildable FTC Java files
- Include file paths relative to FTC Android Studio layout
- Reflect robotConfig constants (wheelRadius, trackWidth, etc.)
- If ExternalVision enabled: include Limelight AND VisionPortal fallback
- Output: Array of { path: string, content: string }

### Assist
- Receive file references + specific regions
- Output unified diffs only (--- before / +++ after)
- Brief commentary (1-2 sentences)
- 60-second test routine
- Output: Array of { path: string, diff: string }

### Co-Pilot
- Output step-by-step implementation plan (3-6 steps)
- Wait for user confirmation before generating code
- Do NOT output full files until user says "go"
- Output: { plan: string[], awaitingConfirmation: boolean }

## Robot Config Schema
\`\`\`typescript
interface RobotConfig {
  driveType: 'mecanum' | 'tank' | 'omni';
  wheelRadius: number;      // inches
  trackWidth: number;       // inches
  gearRatio: number;
  imuOrientation: string;   // e.g., "REV_HUB_LOGO_UP"
  cameraModel: string;      // e.g., "Logitech C920"
  frameworkToggles: {
    roadrunner: boolean;
    ftclib: boolean;
    dashboard: boolean;
    externalVision: boolean;
  };
}
\`\`\`

## RAG Sources (Priority Order)
1. FTC SDK (FtcRobotController repo)
2. Official FTC Docs (ftc-docs.firstinspires.org)
3. Road Runner Docs
4. FTC Dashboard
5. FTCLib
6. Limelight FTC Docs
7. PhotonVision

Each document has metadata:
- title: string
- content: string
- sourceURL: string
- seasonTag: string  // "DECODE 2025-26"

## UI Components

### ModeToggle
Three-button group: Full Generation | Assist | Co-Pilot
Sends selected mode to API

### RobotConfigForm
Form inputs for all robotConfig fields
Collapsible sections for framework toggles

### OutputSections
Four panels (A-D) rendering markdown:
- A) Answer
- B) Code (syntax highlighted)
- C) Test & Validation (checklist)
- D) Failure Modes & Fixes

### FileDownloadBar
"Download All" button
Calls /api/files with code array
Returns .zip download

## API Routes

### /api/claude/route.ts (Edge)
- Input: { mode, robotConfig, userPrompt, frameworkToggles, conversationHistory? }
- Retrieves relevant docs via RAG
- Constructs system prompt + context
- Streams AI response
- Output: ReadableStream (SSE format)

### /api/files/route.ts (Node)
- Input: { files: Array<{ path: string, content: string }> }
- Creates zip archive
- Output: Blob download

## Environment Variables
- ANTHROPIC_API_KEY or OPENAI_API_KEY
- AI_PROVIDER: "anthropic" | "openai"
- ANTHROPIC_MODEL or OPENAI_MODEL

## Code Generation Rules
- Language: Java (default), Kotlin (if requested)
- Package: org.firstinspires.ftc.teamcode
- Annotations: @TeleOp, @Autonomous
- Base class: LinearOpMode or OpMode
- Telemetry: Always included
- Vision init: In init() method, non-blocking
- Road Runner: Include DriveConstants.java, state coordinate frame

## Test & Validation Template
1. Build in Android Studio (Ladybug 2024.2+)
2. Deploy to robot controller
3. Verify init telemetry
4. Dry-run autonomous (30s)
5. Full field test + tuning

## Failure Modes Template
- Vision detection failure
- Road Runner tuning issues
- Gradle/SDK version mismatch
- File download size limits
- UI mode toggle state sync

## Design Principles
- No chat bubbles or typing animations
- Dark theme, high contrast
- Minimal, professional aesthetic (like Cluely or GitHub Copilot)
- Code workbench feel, not chatbot UI
- Fast, responsive, local-first (once RAG indexed)
`;

export const getDeveloperContext = () => DEVELOPER_CONTEXT;
