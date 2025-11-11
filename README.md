# FTC AI Workbench

AI-powered programming assistant specialized for FIRST Tech Challenge teams. Built with Next.js 15, featuring RAG (Retrieval-Augmented Generation) from official FTC sources, and support for Claude/GPT models.

## Features

- **Three Operating Modes**
  - **Full Generation** – complete FTC Java files with Gradle snippets
  - **Assist** – scoped diffs for existing files
  - **Co-Pilot** – plan approval before code generation

- **Session Workspace**
  - Persistent sidebar with multiple chat sessions (localStorage)
  - Rename/delete sessions, quick template prompts, status indicator (Idle/Syncing/etc.)
  - Floating composer with BYOK API key support (Anthropic/OpenAI) and cancellation

- **RAG-Driven FTC Knowledge**
  - Auto-initialized ingest on first load, with `.rag-cache/documents.json`
  - Vendor-aware weighting (Limelight, PhotonVision, Pedro Pathing, FTCLib, Road Runner)
  - Manual “Add your team repo” hook (GitHub URL + optional OpenAI key for embeddings)

- **Robot Configuration**
  - Drive type (mecanum/tank/omni)
  - Physical parameters (wheel radius, track width, gear ratio)
  - IMU orientation & camera choice
  - Framework toggles (Road Runner, FTCLib, Dashboard, External Vision)

- **Vision Integration**
  - Limelight FTC docs + sample repos
  - PhotonVision + VisionPortal fallbacks
  - Dual-system examples with telemetry guidance

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Edit `.env.local` and add your API key:

```env
# Choose one provider
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

# OR

AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4-turbo-preview
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
app/
  layout.tsx              # Root layout
  page.tsx                # Redirect to workbench
  workbench/
    page.tsx              # Main workbench interface
  api/
    claude/
      route.ts            # AI streaming endpoint (Edge)
    files/
      route.ts            # File download/zip endpoint (Node)

components/
  ModeToggle.tsx          # Mode selection UI
  RobotConfigForm.tsx     # Robot configuration form
  OutputSections.tsx      # Conversation + structured output renderer
  FileDownloadBar.tsx     # Download generated files
  RAGConfig.tsx           # RAG status, repo ingest form
  APIKeyConfig.tsx        # Client-side BYOK storage

lib/
  types.ts                # Shared TypeScript types
  prompt/
    system.ts             # AI system prompt
    developer.ts          # Developer documentation
  rag/
    types.ts              # RAG type definitions
    ingest.ts             # Document ingestion logic
    query.ts              # Retrieval and ranking
  modes/
    full-generation.ts    # Full code generation
    assist.ts             # Diff generation
    copilot.ts            # Plan + generate
    index.ts              # Mode exports
  vendors/
    limelight.ts          # Limelight code templates
    photonvision.ts       # PhotonVision code templates

styles/
  globals.css             # Tailwind + custom styles
```

## Usage

### Full Generation Mode

1. Select "Full Generation" mode
2. Configure robot parameters (optional, can use defaults)
3. Enable frameworks (Road Runner, FTCLib, etc.) as needed
4. Enter your request (e.g., "Create autonomous OpMode with AprilTag navigation")
5. Submit and monitor the status pill (Retrieving Sources → Generating)
6. Review conversation + structured output, then download the generated ZIP

### Assist Mode

1. Select "Assist" mode
2. Provide context about existing code (file paths, snippets)
3. Request specific modifications
4. Review generated diffs
5. Apply changes manually or use provided diffs

**Example Output**:
- Unified diffs (--- / +++ format)
- Brief commentary on changes
- 60-second test routine

### Co-Pilot Mode

1. Select "Co-Pilot" mode
2. Describe your goal
3. Review generated implementation plan (3-6 steps)
4. Click "Approve Plan & Generate Code"
5. Wait for full code generation and download files

## RAG Knowledge Base

The system retrieves context from:

1. **FTC SDK** (Priority 1)
   - Source: https://github.com/FIRST-Tech-Challenge/FtcRobotController
   - Core SDK classes, OpMode patterns, hardware APIs

2. **Official FTC Docs** (Priority 2)
   - Source: https://ftc-docs.firstinspires.org
   - VisionPortal, AprilTag, TFOD, configuration guides

3. **Road Runner** (Priority 3)
   - Source: https://learnroadrunner.com
   - Motion planning, trajectory building, tuning

4. **FTC Dashboard** (Priority 4)
   - Source: https://acmerobotics.github.io/ftc-dashboard
   - Telemetry streaming, field overlays

5. **FTCLib** (Priority 5)
   - Source: https://docs.ftclib.org
   - Command-based programming, utility classes

6. **Limelight** (Priority 6)
   - Source: https://docs.limelightvision.io/docs/docs-limelight/apis/ftc-programming
   - External vision processor integration

7. **PhotonVision** (Priority 7)
  - Source: https://docs.photonvision.org
  - Network-based vision processing

### Caching & Refresh

- Ingest results are cached at `.rag-cache/documents.json` and re-used unless `force` is passed to the init API.
- The Next.js server auto-runs `/api/rag/init` on first load; a manual trigger button is available in the UI (Settings → RAG).
- User repository ingestion uses `/api/rag/add-repo` and merges documents into the cache; supplying an OpenAI key enables embeddings for custom repos.

### Extending the Knowledge Base

To add custom documentation:

1. Edit `lib/rag/ingest.ts`
2. Use `createDocument()` to add manual entries
3. Or implement `fetchGitHubContent()` / `fetchWebContent()` for automated ingestion

## Code Generation Constraints

All generated code follows these rules:

- **Language**: Java (default), Kotlin (on request)
- **Package**: `org.firstinspires.ftc.teamcode`
- **Base Class**: `LinearOpMode` or `OpMode`
- **Annotations**: `@TeleOp` or `@Autonomous`
- **Vision Init**: In `init()` method, non-blocking
- **Telemetry**: Always included for debugging
- **TODOs**: Clearly marked placeholders for team-specific values

## Test & Validation

Standard testing checklist for all generated code:

1. **Build**: Compile in Android Studio (Ladybug 2024.2+)
2. **Deploy**: Upload to Robot Controller, verify no errors
3. **Init Test**: Run `init()`, check telemetry output
4. **Dry Run**: Test autonomous for 30s without full field
5. **Field Test**: Run on field, log encoder/IMU data, tune as needed

## Common Failure Modes

### Vision Pipeline Never Detects Tags
- **Fix**: Check camera alignment, lighting, team number in Limelight UI

### Road Runner Overshoots Turns
- **Fix**: Re-tune `kV`, `kA`, `kStatic` in `DriveConstants.java`; run track width calibration

### Gradle Version Mismatch
- **Fix**: Pull latest SDK: `git clone https://github.com/FIRST-Tech-Challenge/FtcRobotController.git`

### File Download Fails
- **Fix**: Check file sizes, ensure serverless memory limits not exceeded

### Mode Toggle Not Reflecting
- **Fix**: Verify `ModeToggle` component state prop is wired to API call

## Development

### Build for Production

```bash
npm run build
npm start
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `AI_PROVIDER` | `anthropic` or `openai` | Yes |
| `ANTHROPIC_API_KEY` | Anthropic API key | If using Claude |
| `OPENAI_API_KEY` | OpenAI API key | If using GPT |
| `ANTHROPIC_MODEL` | Model ID (e.g., `claude-3-5-sonnet-20241022`) | No (has default) |
| `OPENAI_MODEL` | Model ID (e.g., `gpt-4-turbo-preview`) | No (has default) |

## License

MIT

## Support

For issues or questions:
- FTC SDK: https://github.com/FIRST-Tech-Challenge/FtcRobotController/issues
- Road Runner: https://learnroadrunner.com
- FTCLib: https://docs.ftclib.org
- This project: [Your repo issues]

---

**Built for DECODE 2025-26 season**
