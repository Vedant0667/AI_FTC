# FTC AI Workbench - Setup Instructions

## Quick Start

1. **Install Dependencies**
   \`\`\`bash
   npm install
   \`\`\`

2. **Run Development Server**
   \`\`\`bash
   npm run dev
   \`\`\`

3. **Open Browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

4. **Configure API Key** (in browser)
   - Choose provider: Anthropic (Claude) or OpenAI (GPT)
   - Enter your API key (stored locally in browser)
   - Keys: Anthropic starts with `sk-ant-`, OpenAI starts with `sk-`

## BYOK (Bring Your Own Key)

This application uses **BYOK** architecture:
- API keys are **stored in browser localStorage** only
- Keys are **never sent to the application server**
- Keys go directly from browser → AI provider API
- No backend API keys needed
- Privacy-first design

## Application Features

### Three Generation Modes

1. **Full Generation**
   - Generates complete, buildable FTC Java files
   - Includes file paths (TeamCode structure)
   - Adds Gradle dependencies
   - Reflects robot configuration constants

2. **Assist**
   - Provides unified diffs for existing files
   - Targeted modifications only
   - Includes 60-second test routines

3. **Co-Pilot**
   - Step-by-step planning phase
   - User approval required
   - Then generates full code

### Robot Configuration

Configure your robot's physical parameters:
- Drive type: Mecanum, Tank, or Omni
- Wheel radius (inches)
- Track width (inches)
- Gear ratio
- IMU orientation
- Camera model

### Framework Toggles

Enable optional frameworks:
- **Road Runner**: Motion planning library
- **FTCLib**: Command-based programming
- **FTC Dashboard**: Advanced telemetry
- **External Vision**: Limelight/PhotonVision support

### RAG (Retrieval-Augmented Generation)

The system retrieves relevant documentation from:
- FTC SDK (priority 1)
- Official FTC Docs (priority 2)
- Road Runner (priority 3)
- FTC Dashboard (priority 4)
- FTCLib (priority 5)
- Limelight (priority 6)
- PhotonVision (priority 7)

Seed documents are included. Extend by implementing GitHub/web fetchers in \`lib/rag/ingest.ts\`.

## Output Structure

Responses follow this format:

### A) Answer
Direct response to your request

### B) Code
Generated files with paths:
- \`TeamCode/src/main/java/org/firstinspires/ftc/teamcode/...\`
- Gradle dependency additions

### C) Test & Validation
5-step testing checklist:
1. Build in Android Studio
2. Deploy to robot
3. Verify init telemetry
4. Dry-run autonomous
5. Full field test

### D) Failure Modes & Fixes
Common issues and solutions

## File Download

Click "Download All" to export generated files as a .zip archive.

## Development

### Tech Stack
- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS
- **AI**: Anthropic Claude / OpenAI GPT
- **RAG**: Custom text-based retrieval (upgrade to embeddings for production)

### API Routes
- \`/api/claude\`: Edge runtime, streams AI responses
- \`/api/files\`: Node runtime, zips files for download

### Extending RAG

Edit \`lib/rag/ingest.ts\`:
- Implement \`fetchGitHubContent()\` for repo ingestion
- Implement \`fetchWebContent()\` for web scraping
- Add documents to \`SEED_DOCUMENTS\` or call \`addDocuments()\`

Current RAG uses simple text similarity. For production:
- Use OpenAI embeddings or local models
- Implement proper vector store (Pinecone, Chroma, etc.)
- Add semantic search

## Troubleshooting

### API Key Not Working
- Verify key format (Anthropic: `sk-ant-...`, OpenAI: `sk-...`)
- Check API key has credits/quota
- Check browser console for errors

### No Output Generated
- Ensure API key is configured
- Check network tab for failed requests
- Verify prompt is not empty

### File Download Fails
- Check generated files exist
- Look for browser console errors
- Verify zip size is reasonable

### Vision Code Not Generating
- Enable "External Vision" toggle in Robot Config
- Mention "Limelight" or "AprilTag" in prompt
- Check RAG is retrieving vision docs

## Season Notes

This workbench is configured for **DECODE 2025-26** season.

Generated code follows FTC SDK best practices:
- Minimum Android Studio: Ladybug 2024.2
- Package: \`org.firstinspires.ftc.teamcode\`
- Annotations: \`@TeleOp\` / \`@Autonomous\`
- Base classes: \`LinearOpMode\` / \`OpMode\`

## Support

For FTC-specific questions, refer to:
- [FTC Docs](https://ftc-docs.firstinspires.org)
- [FTC SDK GitHub](https://github.com/FIRST-Tech-Challenge/FtcRobotController)
- [Limelight Docs](https://docs.limelightvision.io)

For application issues, check the generated code structure and console logs.
