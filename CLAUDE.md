# CLAUDE.md - AI Assistant Guide for FTC AI Workbench

**Last Updated:** 2025-11-15
**Repository:** AI_FTC
**Target Season:** DECODE 2025-26
**Framework:** Next.js 15.1.4 + React 19 + TypeScript 5.7.2

---

## Table of Contents

1. [Repository Overview](#repository-overview)
2. [Architecture & Design Patterns](#architecture--design-patterns)
3. [Directory Structure](#directory-structure)
4. [Key Files Reference](#key-files-reference)
5. [Development Workflows](#development-workflows)
6. [Code Conventions](#code-conventions)
7. [RAG System Deep Dive](#rag-system-deep-dive)
8. [AI Generation Modes](#ai-generation-modes)
9. [Common Modification Patterns](#common-modification-patterns)
10. [Testing & Validation](#testing--validation)
11. [Troubleshooting Guide](#troubleshooting-guide)
12. [Git Workflow](#git-workflow)

---

## Repository Overview

### What is AI_FTC?

AI_FTC (FTC AI Workbench) is a specialized AI-powered programming assistant for FIRST Tech Challenge robotics teams. It combines:

- **Next.js 15 web application** with modern React 19 and TypeScript
- **RAG (Retrieval-Augmented Generation)** from 10+ FTC knowledge sources
- **Multi-AI provider support** (Anthropic Claude Sonnet 4.5, OpenAI GPT-4)
- **BYOK architecture** (Bring Your Own Key) for privacy
- **Glassmorphism UI** inspired by Apple design language

### Core Capabilities

1. **Full code generation** - Complete FTC Java files with Gradle dependencies
2. **Code assistance** - Unified diffs for existing code modifications
3. **Planning mode** - Two-phase plan approval before generation
4. **Robot configuration** - Drive types, sensors, frameworks (Road Runner, FTCLib)
5. **Vision integration** - Limelight and PhotonVision support
6. **Multi-session workspace** - Persistent chat sessions with localStorage

### Technology Stack

**Frontend:**
- Next.js 15.1.4 (App Router)
- React 19.0.0
- TypeScript 5.7.2
- Tailwind CSS 3.4.17

**AI/ML:**
- `@anthropic-ai/sdk` ^0.32.1
- `openai` ^4.77.3
- `@langchain/community` ^0.3.17 (RAG framework)

**Utilities:**
- `archiver` ^7.0.1 (ZIP creation)
- `jszip` ^3.10.1 (ZIP parsing)
- `cheerio` ^1.0.0 (HTML parsing)
- `pdf-parse` ^1.1.1 (PDF extraction)

---

## Architecture & Design Patterns

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser Client                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Workbench  │  │  API Config  │  │  RAG Config  │      │
│  │     UI       │  │  (localStorage)│  │    Panel     │      │
│  └──────┬───────┘  └──────────────┘  └──────────────┘      │
│         │                                                     │
│         ▼                                                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Next.js API Routes (Server-Side)             │   │
│  │                                                        │   │
│  │  /api/claude     ┌─────────────┐  /api/rag/init      │   │
│  │  (Streaming)     │ RAG System  │  /api/rag/add-repo  │   │
│  │                  │  Query +    │                      │   │
│  │  /api/files      │  Ingest     │  /api/files         │   │
│  │  (Download)      └─────────────┘  (ZIP Export)       │   │
│  └──────┬───────────────────────────────────────────────┘   │
│         │                                                     │
└─────────┼─────────────────────────────────────────────────────┘
          │
          ▼
   ┌──────────────────────────────────────────────────────┐
   │          External Services                           │
   │  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
   │  │  Anthropic   │  │    OpenAI    │  │   GitHub   │ │
   │  │    Claude    │  │     GPT      │  │ API (RAG)  │ │
   │  └──────────────┘  └──────────────┘  └────────────┘ │
   └──────────────────────────────────────────────────────┘
```

### Key Design Patterns

#### 1. BYOK (Bring Your Own Key) Architecture

**Why:** Privacy-first approach - no server-side API key storage

**Implementation:**
- API keys stored in browser `localStorage`
- Keys sent directly from browser to AI providers
- No backend proxy or key management
- Zero telemetry or tracking

**Location:** `/home/user/AI_FTC/components/APIKeyConfig.tsx`

#### 2. RAG (Retrieval-Augmented Generation)

**Why:** Context-aware code generation with FTC-specific knowledge

**Flow:**
```
User Query → Enhance with Robot Config →
BM25/Semantic Search → Priority Weighting →
Top-K Documents (10) → Format as Context →
Send to AI Model
```

**Location:** `/home/user/AI_FTC/lib/rag/`

#### 3. Mode-Based Generation Strategy

**Why:** Different use cases require different output formats

**Modes:**
1. **Full Generation** - Complete files with Gradle dependencies
2. **Assist** - Unified diffs for existing code
3. **Co-Pilot** - Plan approval before generation

**Location:** `/home/user/AI_FTC/lib/modes/`

#### 4. Session Management Pattern

**Why:** Multi-conversation workflow with persistence

**Implementation:**
- Each session has unique ID (timestamp + random)
- Sessions stored in `localStorage`
- Independent conversation histories
- Editable session titles

**Location:** `/home/user/AI_FTC/app/workbench/page.tsx` (lines 80-150)

---

## Directory Structure

```
/home/user/AI_FTC/
├── app/                          # Next.js 15 App Router
│   ├── api/                      # API routes (server-side)
│   │   ├── claude/
│   │   │   └── route.ts         # AI streaming endpoint (Node.js runtime)
│   │   ├── files/
│   │   │   └── route.ts         # File download/zip endpoint
│   │   └── rag/
│   │       ├── init/
│   │       │   └── route.ts     # RAG initialization
│   │       └── add-repo/
│   │           └── route.ts     # Add user repository to RAG
│   ├── layout.tsx               # Root layout with metadata
│   ├── page.tsx                 # Home page (redirects to /workbench)
│   └── workbench/
│       └── page.tsx             # Main workbench interface (624 lines)
│
├── components/                   # React components
│   ├── APIKeyConfig.tsx         # BYOK API key configuration
│   ├── ConfirmDialog.tsx        # Confirmation dialog component
│   ├── FileDownloadBar.tsx      # Download generated files as ZIP
│   ├── ModeToggle.tsx           # Mode selection UI (Full/Assist/Co-Pilot)
│   ├── OutputSections.tsx       # Conversation + output renderer
│   ├── RAGConfig.tsx            # RAG status and repo ingest
│   └── RobotConfigForm.tsx      # Robot configuration form
│
├── lib/                         # Core business logic
│   ├── modes/                   # Code generation modes
│   │   ├── assist.ts           # Diff generation mode
│   │   ├── copilot.ts          # Plan-then-generate mode
│   │   ├── full-generation.ts  # Full code generation mode
│   │   └── index.ts            # Mode exports
│   ├── prompt/                  # AI prompting
│   │   ├── developer.ts        # Developer documentation context
│   │   └── system.ts           # System prompt for AI behavior
│   ├── rag/                     # RAG system
│   │   ├── embeddings.ts       # OpenAI embeddings wrapper
│   │   ├── ingest.ts           # Document ingestion (490 lines)
│   │   ├── query.ts            # Retrieval and ranking (473 lines)
│   │   └── types.ts            # RAG type definitions
│   ├── vendors/                 # Vendor-specific code templates
│   │   ├── limelight.ts        # Limelight vision templates
│   │   └── photonvision.ts     # PhotonVision templates
│   └── types.ts                 # Shared TypeScript types
│
├── styles/
│   └── globals.css              # Tailwind + glassmorphism styles
│
├── .rag-cache/                  # RAG document cache (gitignored)
│   └── documents.json           # Cached ingested documents
│
├── next.config.js               # Next.js configuration
├── tailwind.config.ts           # Tailwind CSS configuration
├── tsconfig.json                # TypeScript configuration
├── package.json                 # Dependencies
├── .env.example                 # Environment variables template
├── .gitignore                   # Git ignore rules
├── README.md                    # Project documentation
├── FEATURES.md                  # Feature documentation
└── SETUP.md                     # Setup instructions
```

---

## Key Files Reference

### Critical Files (Must Understand)

#### 1. `/home/user/AI_FTC/app/workbench/page.tsx` (624 lines)

**Purpose:** Main application interface

**Key Features:**
- Multi-session management
- Real-time streaming UI
- Settings panel (API config, RAG, Robot config)
- Status indicators (Idle/Retrieving/Generating/Error)
- File download handling

**State Management:**
```typescript
const [sessions, setSessions] = useState<Session[]>([])
const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
const [mode, setMode] = useState<'full' | 'assist' | 'copilot'>('full')
const [robotConfig, setRobotConfig] = useState<RobotConfig>({...})
const [apiConfig, setApiConfig] = useState<{provider: string, key: string}>({...})
```

**When to Modify:**
- Adding new UI features
- Changing layout or styling
- Adding new session capabilities
- Modifying streaming behavior

---

#### 2. `/home/user/AI_FTC/app/api/claude/route.ts`

**Purpose:** AI streaming endpoint (Node.js runtime)

**Request Flow:**
1. Receive POST request with `{messages, mode, robotConfig}`
2. Query RAG system for relevant docs
3. Build system prompt with context
4. Stream response from Anthropic/OpenAI
5. Return SSE (Server-Sent Events) stream

**Key Code Sections:**
```typescript
export const runtime = 'nodejs' // Important: Not Edge runtime

// RAG retrieval
const relevantDocs = await queryRAG(latestMessage, robotConfig)

// Provider selection
if (provider === 'anthropic') {
  const stream = await anthropic.messages.stream({...})
} else if (provider === 'openai') {
  const stream = await openai.chat.completions.create({stream: true, ...})
}
```

**When to Modify:**
- Adding new AI providers
- Changing RAG retrieval logic
- Modifying prompt construction
- Adding streaming features

---

#### 3. `/home/user/AI_FTC/lib/rag/query.ts` (473 lines)

**Purpose:** RAG retrieval and ranking engine

**Search Modes:**
1. **BM25 (default)** - Keyword-based text matching, no API key required
2. **Semantic (optional)** - OpenAI embeddings for similarity search

**Retrieval Algorithm:**
```typescript
function queryRAG(query: string, robotConfig: RobotConfig, k: number = 10) {
  1. Enhance query with robot config keywords
  2. BM25 scoring across all documents
  3. Boost scores by source priority (1-9)
  4. Keyword boosting for vendors (Limelight, Road Runner, FTCLib)
  5. Sort by score, return top-k
  6. Format documents for AI prompt
}
```

**Priority Weighting:**
```typescript
// Higher priority = lower number (1 is highest)
priority_1: FTC SDK (official samples) - 10x boost
priority_2: Top FTC teams (World Champions) - 8x boost
priority_3: Road Runner - 7x boost
priority_4: FTCLib - 6x boost
priority_5: Limelight - 5x boost
```

**When to Modify:**
- Adding new knowledge sources
- Tuning retrieval performance
- Changing ranking algorithm
- Adding new search modes

---

#### 4. `/home/user/AI_FTC/lib/rag/ingest.ts` (490 lines)

**Purpose:** Document ingestion from GitHub/Web sources

**Capabilities:**
- GitHub repository archiving
- ZIP file parsing
- Markdown/Java/PDF text extraction
- Document chunking (1000 chars, 200 overlap)
- Optional OpenAI embeddings
- File system caching (`.rag-cache/documents.json`)

**Ingestion Flow:**
```typescript
async function ingestRepository(repoUrl: string) {
  1. Download GitHub repo as ZIP
  2. Parse ZIP, extract relevant files (.md, .java, .pdf)
  3. Chunk large files (1000 chars, 200 overlap)
  4. Create Document objects with metadata
  5. Optional: Generate OpenAI embeddings
  6. Cache to .rag-cache/documents.json
}
```

**When to Modify:**
- Adding new file type parsers
- Changing chunking strategy
- Adding new knowledge sources
- Implementing vector database integration

---

#### 5. `/home/user/AI_FTC/lib/prompt/system.ts`

**Purpose:** System prompt defining AI assistant behavior

**Sections:**
1. **Role definition** - FTC programming expert
2. **Output structure** - 4-section format (Answer/Code/Test/Failure Modes)
3. **Code constraints** - Java, package names, annotations
4. **Best practices** - Vision init, telemetry, TODOs
5. **Robot config integration** - Physical parameters, frameworks

**Key Constraints:**
```typescript
- Language: Java (default), Kotlin on request
- Package: org.firstinspires.ftc.teamcode
- Base class: LinearOpMode or OpMode
- Annotations: @TeleOp or @Autonomous
- Vision init: In init() method, non-blocking
- Telemetry: Always included
- TODOs: Clearly marked placeholders
```

**When to Modify:**
- Changing AI behavior
- Adding new code generation rules
- Updating FTC best practices
- Adding new frameworks

---

#### 6. `/home/user/AI_FTC/lib/types.ts`

**Purpose:** Shared TypeScript type definitions

**Key Types:**
```typescript
interface RobotConfig {
  driveType: 'mecanum' | 'tank' | 'omni'
  wheelRadius: number
  trackWidth: number
  gearRatio: number
  imuOrientation: string
  cameraModel: string
  useRoadRunner: boolean
  useFTCLib: boolean
  useDashboard: boolean
  useExternalVision: boolean
}

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Session {
  id: string
  title: string
  messages: Message[]
  createdAt: number
}

interface GeneratedFile {
  path: string
  content: string
}
```

**When to Modify:**
- Adding new configuration options
- Extending session capabilities
- Adding new data structures

---

#### 7. `/home/user/AI_FTC/lib/modes/`

**Purpose:** Code generation mode implementations

**Files:**

**a) `full-generation.ts`**
- Generates complete, buildable Java files
- Includes file paths in TeamCode structure
- Adds Gradle dependencies
- Reflects robot configuration

**b) `assist.ts`**
- Generates unified diffs (--- / +++ format)
- Targeted modifications only
- Includes 60-second test routine

**c) `copilot.ts`**
- Two-phase: Plan approval → Code generation
- 3-6 step plan with clear descriptions
- User must approve before generation

**When to Modify:**
- Adding new generation modes
- Changing output formats
- Modifying mode-specific prompts

---

## Development Workflows

### Local Development Setup

```bash
# 1. Clone repository
git clone <repo-url>
cd AI_FTC

# 2. Install dependencies
npm install

# 3. Run development server
npm run dev

# 4. Open browser
# Navigate to http://localhost:3000
```

### Adding a New AI Model

**Example: Adding Gemini support**

1. **Install SDK:**
```bash
npm install @google-cloud/aiplatform
```

2. **Update API route** (`/home/user/AI_FTC/app/api/claude/route.ts`):
```typescript
import { VertexAI } from '@google-cloud/aiplatform'

// In POST handler:
if (provider === 'gemini') {
  const vertexAI = new VertexAI({...})
  const model = vertexAI.preview.getGenerativeModel({model: 'gemini-pro'})
  const stream = await model.generateContentStream({...})
  // Handle streaming...
}
```

3. **Update API config component** (`/home/user/AI_FTC/components/APIKeyConfig.tsx`):
```typescript
<select value={provider} onChange={...}>
  <option value="anthropic">Anthropic Claude</option>
  <option value="openai">OpenAI GPT</option>
  <option value="gemini">Google Gemini</option>
</select>
```

4. **Update environment variables** (`.env.example`):
```env
GEMINI_API_KEY=AIza...
GEMINI_MODEL=gemini-pro
```

---

### Adding a New RAG Source

**Example: Adding Pedro Pathing documentation**

1. **Edit RAG types** (`/home/user/AI_FTC/lib/rag/types.ts`):
```typescript
export const FTC_SOURCES: DocumentSource[] = [
  // Existing sources...
  {
    name: 'Pedro Pathing',
    url: 'https://github.com/pedro-1.0/pedro-pathing',
    priority: 3,
    type: 'github',
    paths: ['src/', 'docs/'],
    description: 'Pedro Pathing motion planning library'
  }
]
```

2. **Delete RAG cache:**
```bash
rm -rf .rag-cache/documents.json
```

3. **Restart server:**
```bash
npm run dev
```

4. **Verify ingestion:**
- Open http://localhost:3000
- Check browser console for "Ingested X documents"
- Test query: "How do I use Pedro Pathing?"

---

### Adding a New Generation Mode

**Example: Adding "Refactor" mode**

1. **Create mode file** (`/home/user/AI_FTC/lib/modes/refactor.ts`):
```typescript
import type { RobotConfig } from '../types'

export function buildRefactorPrompt(
  userRequest: string,
  robotConfig: RobotConfig,
  ragContext: string
): string {
  return `You are an FTC code refactoring expert.

**User Request:** ${userRequest}

**Robot Configuration:**
${JSON.stringify(robotConfig, null, 2)}

**Relevant Documentation:**
${ragContext}

**Task:** Analyze the existing code and suggest refactorings to improve:
1. Code organization and structure
2. Performance and efficiency
3. Readability and maintainability
4. FTC best practices compliance

**Output Format:**

### A) Refactoring Analysis
- List of issues found
- Suggested improvements

### B) Refactored Code
- Updated code with changes highlighted

### C) Migration Guide
- Step-by-step instructions for applying changes
- Potential risks and testing requirements
`
}
```

2. **Export from index** (`/home/user/AI_FTC/lib/modes/index.ts`):
```typescript
export { buildFullGenerationPrompt } from './full-generation'
export { buildAssistPrompt } from './assist'
export { buildCopilotPrompt } from './copilot'
export { buildRefactorPrompt } from './refactor'
```

3. **Update types** (`/home/user/AI_FTC/lib/types.ts`):
```typescript
export type GenerationMode = 'full' | 'assist' | 'copilot' | 'refactor'
```

4. **Update mode toggle** (`/home/user/AI_FTC/components/ModeToggle.tsx`):
```typescript
<select value={mode} onChange={...}>
  <option value="full">Full Generation</option>
  <option value="assist">Assist</option>
  <option value="copilot">Co-Pilot</option>
  <option value="refactor">Refactor</option>
</select>
```

5. **Update API route** (`/home/user/AI_FTC/app/api/claude/route.ts`):
```typescript
import { buildRefactorPrompt } from '@/lib/modes'

// In mode selection:
let systemPrompt = ''
if (mode === 'refactor') {
  systemPrompt = buildRefactorPrompt(latestMessage, robotConfig, ragContext)
}
```

---

### Customizing the UI Theme

**Location:** `/home/user/AI_FTC/tailwind.config.ts` and `/home/user/AI_FTC/styles/globals.css`

**Change accent color:**
```typescript
// tailwind.config.ts
theme: {
  extend: {
    colors: {
      accent: {
        DEFAULT: '#10B981', // Green instead of blue
        hover: '#059669',
      }
    }
  }
}
```

**Change glassmorphism opacity:**
```css
/* globals.css */
.glass {
  background: rgba(255, 255, 255, 0.08); /* Increased from 0.05 */
  backdrop-filter: blur(24px) saturate(200%); /* Increased blur */
}
```

**Change background gradient:**
```css
/* globals.css */
body::before {
  background:
    radial-gradient(circle at 20% 20%, rgba(16, 185, 129, 0.15) 0%, transparent 50%),
    radial-gradient(circle at 80% 80%, rgba(239, 68, 68, 0.15) 0%, transparent 50%);
}
```

---

## Code Conventions

### TypeScript Conventions

**1. Type imports:**
```typescript
// ✅ Good: Explicit type imports
import type { RobotConfig, Message } from '@/lib/types'
import { useState } from 'react'

// ❌ Avoid: Mixing types and values in same import
import { RobotConfig, useState } from 'somewhere'
```

**2. Interface vs Type:**
```typescript
// ✅ Use interface for objects that can be extended
interface RobotConfig {
  driveType: string
  wheelRadius: number
}

// ✅ Use type for unions, intersections, and primitives
type GenerationMode = 'full' | 'assist' | 'copilot'
type Status = 'idle' | 'retrieving' | 'generating' | 'error'
```

**3. Async/await:**
```typescript
// ✅ Good: Proper error handling
async function fetchData() {
  try {
    const response = await fetch('/api/data')
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return await response.json()
  } catch (error) {
    console.error('Fetch failed:', error)
    throw error
  }
}

// ❌ Avoid: No error handling
async function fetchData() {
  const response = await fetch('/api/data')
  return await response.json()
}
```

**4. Optional chaining:**
```typescript
// ✅ Good: Safe property access
const title = session?.messages?.[0]?.content ?? 'New Session'

// ❌ Avoid: Manual null checks
const title = session && session.messages && session.messages[0]
  ? session.messages[0].content
  : 'New Session'
```

---

### React Conventions

**1. Component structure:**
```typescript
// ✅ Good: Functional component with TypeScript
interface Props {
  mode: GenerationMode
  onModeChange: (mode: GenerationMode) => void
}

export default function ModeToggle({ mode, onModeChange }: Props) {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    // Side effects here
  }, [dependencies])

  return (
    <div>...</div>
  )
}
```

**2. Event handlers:**
```typescript
// ✅ Good: Inline arrow function for simple handlers
<button onClick={() => setMode('full')}>Full</button>

// ✅ Good: Extracted function for complex handlers
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  // Complex logic here
}
<form onSubmit={handleSubmit}>...</form>
```

**3. State management:**
```typescript
// ✅ Good: Multiple useState for unrelated state
const [sessions, setSessions] = useState<Session[]>([])
const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
const [mode, setMode] = useState<GenerationMode>('full')

// ❌ Avoid: Single useState for complex state (harder to update)
const [state, setState] = useState({
  sessions: [],
  currentSessionId: null,
  mode: 'full'
})
```

**4. useEffect dependencies:**
```typescript
// ✅ Good: Complete dependency array
useEffect(() => {
  const savedSessions = localStorage.getItem('sessions')
  if (savedSessions) {
    setSessions(JSON.parse(savedSessions))
  }
}, []) // Empty array = run once on mount

useEffect(() => {
  localStorage.setItem('sessions', JSON.stringify(sessions))
}, [sessions]) // Run when sessions change
```

---

### File Naming Conventions

```
PascalCase:    Components (ModeToggle.tsx, APIKeyConfig.tsx)
camelCase:     Utilities (query.ts, ingest.ts, embeddings.ts)
kebab-case:    Multi-word files (full-generation.ts)
UPPERCASE:     Constants (README.md, FEATURES.md)
```

---

### Import Order

```typescript
// 1. External dependencies
import { useState, useEffect } from 'react'
import Anthropic from '@anthropic-ai/sdk'

// 2. Internal modules (absolute paths)
import type { RobotConfig, Message } from '@/lib/types'
import { queryRAG } from '@/lib/rag/query'

// 3. Components
import ModeToggle from '@/components/ModeToggle'
import OutputSections from '@/components/OutputSections'

// 4. Styles
import '@/styles/globals.css'
```

---

## RAG System Deep Dive

### Document Sources (Priority-Weighted)

**Priority 1 (Highest):**
- **FTC SDK** - Official FIRST Tech Challenge SDK
  - Source: https://github.com/FIRST-Tech-Challenge/FtcRobotController
  - Content: Hardware layer, OpMode patterns, samples
  - Boost: 10x

**Priority 2:**
- **Top FTC Teams** - World Championship winners
  - Clueless #11212 (2024 Champions)
  - Gluten Free #11115 (2023 Champions)
  - Boost: 8x

**Priority 3:**
- **Road Runner** - Motion planning library
  - Source: https://learnroadrunner.com
  - Content: Trajectory building, tuning guides
  - Boost: 7x

**Priority 4:**
- **FTCLib** - Command-based programming
  - Source: https://docs.ftclib.org
  - Content: Utility classes, subsystems
  - Boost: 6x

**Priority 5:**
- **Limelight** - External vision processor
  - Source: https://docs.limelightvision.io
  - Content: FTC integration, AprilTag detection
  - Boost: 5x

**Priority 6:**
- **PhotonVision** - Alternative vision system
  - Source: https://docs.photonvision.org
  - Boost: 4x

**Priority 7:**
- **FTC Dashboard** - Telemetry streaming
  - Source: https://acmerobotics.github.io/ftc-dashboard
  - Boost: 3x

**Priority 8:**
- **Official FTC Docs** - Competition guides
  - Source: https://ftc-docs.firstinspires.org
  - Boost: 2x

**Priority 9 (Lowest):**
- **User Repository** - Team-specific code
  - Source: GitHub URL provided by user
  - Boost: 1x

---

### Search Algorithm

**BM25 (Default - No API Key Required):**

```typescript
function bm25Score(
  query: string,
  document: string,
  allDocuments: string[]
): number {
  // 1. Tokenize query and document
  const queryTokens = query.toLowerCase().split(/\s+/)
  const docTokens = document.toLowerCase().split(/\s+/)

  // 2. Calculate term frequency (TF)
  const termFreq = (term: string) =>
    docTokens.filter(t => t === term).length / docTokens.length

  // 3. Calculate inverse document frequency (IDF)
  const docFreq = (term: string) =>
    allDocuments.filter(d => d.includes(term)).length
  const idf = (term: string) =>
    Math.log((allDocuments.length - docFreq(term) + 0.5) / (docFreq(term) + 0.5))

  // 4. BM25 formula
  const k1 = 1.5, b = 0.75
  const avgDocLen = allDocuments.reduce((sum, d) => sum + d.length, 0) / allDocuments.length
  const score = queryTokens.reduce((sum, term) => {
    const tf = termFreq(term)
    const normalization = k1 * (1 - b + b * (docTokens.length / avgDocLen))
    return sum + idf(term) * (tf * (k1 + 1)) / (tf + normalization)
  }, 0)

  return score
}
```

**Semantic Search (Optional - Requires OpenAI Key):**

```typescript
async function semanticSearch(
  query: string,
  documents: Document[],
  openAIKey: string,
  k: number = 10
): Promise<Document[]> {
  // 1. Generate query embedding
  const queryEmbedding = await generateEmbedding(query, openAIKey)

  // 2. Calculate cosine similarity with each document
  const scores = documents.map(doc => ({
    doc,
    score: cosineSimilarity(queryEmbedding, doc.embedding)
  }))

  // 3. Sort by score, return top-k
  return scores
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map(s => s.doc)
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0)
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0))
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0))
  return dotProduct / (magnitudeA * magnitudeB)
}
```

---

### Keyword Boosting

Certain vendor-specific keywords get score multipliers:

```typescript
const VENDOR_KEYWORDS = {
  limelight: ['limelight', 'LL3A', 'limelight3a', 'pipeline'],
  roadrunner: ['roadrunner', 'trajectory', 'drive constants', 'motion planning'],
  ftclib: ['ftclib', 'command', 'subsystem', 'command-based'],
  dashboard: ['dashboard', 'telemetry', 'field overlay'],
  photonvision: ['photonvision', 'photon', 'vision portal']
}

function applyKeywordBoost(score: number, query: string, docContent: string): number {
  let boostedScore = score

  for (const [vendor, keywords] of Object.entries(VENDOR_KEYWORDS)) {
    const queryHasKeyword = keywords.some(kw => query.toLowerCase().includes(kw))
    const docHasKeyword = keywords.some(kw => docContent.toLowerCase().includes(kw))

    if (queryHasKeyword && docHasKeyword) {
      boostedScore *= 1.5 // 50% boost for keyword match
    }
  }

  return boostedScore
}
```

---

### Caching Strategy

**Cache Location:** `/home/user/AI_FTC/.rag-cache/documents.json`

**Cache Structure:**
```json
{
  "documents": [
    {
      "content": "...",
      "metadata": {
        "source": "FTC SDK",
        "priority": 1,
        "url": "https://...",
        "filePath": "samples/OpMode.java",
        "type": "code"
      },
      "embedding": [0.123, -0.456, ...] // Optional
    }
  ],
  "version": "1.0",
  "lastUpdated": "2025-11-15T12:00:00Z"
}
```

**Cache Invalidation:**
- Manual: Delete `.rag-cache/documents.json`
- Automatic: Not implemented (future: TTL-based)
- Force refresh: Pass `force=true` to `/api/rag/init`

---

## AI Generation Modes

### Mode 1: Full Generation

**Purpose:** Generate complete, buildable FTC Java files

**Output Format:**
```markdown
### A) Answer
Brief summary of what was generated

### B) Code
#### File: TeamCode/src/main/java/org/firstinspires/ftc/teamcode/autonomous/MyAuto.java
```java
package org.firstinspires.ftc.teamcode.autonomous;

import com.qualcomm.robotcore.eventloop.opmode.Autonomous;
import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;

@Autonomous(name="My Auto", group="Autonomous")
public class MyAuto extends LinearOpMode {
    @Override
    public void runOpMode() {
        // TODO: Initialize hardware
        telemetry.addData("Status", "Initialized");
        telemetry.update();

        waitForStart();

        // TODO: Add autonomous code
    }
}
```

#### Gradle Dependencies
Add to `TeamCode/build.gradle`:
```gradle
dependencies {
    implementation 'org.ftclib.ftclib:core:2.1.1'
}
```

### C) Test & Validation
1. **Build** - Compile in Android Studio
2. **Deploy** - Upload to Robot Controller
3. **Init Test** - Run init(), check telemetry
4. **Dry Run** - Test for 30s without field
5. **Field Test** - Run on field, log data

### D) Failure Modes & Fixes
- **Issue:** Code doesn't compile
  - **Fix:** Verify Gradle sync, check imports
```

**Prompt Template** (`/home/user/AI_FTC/lib/modes/full-generation.ts`):
```typescript
export function buildFullGenerationPrompt(
  userRequest: string,
  robotConfig: RobotConfig,
  ragContext: string
): string {
  return `You are an FTC programming expert specializing in Java code generation.

**User Request:** ${userRequest}

**Robot Configuration:**
- Drive Type: ${robotConfig.driveType}
- Wheel Radius: ${robotConfig.wheelRadius} inches
- Track Width: ${robotConfig.trackWidth} inches
- Frameworks: ${robotConfig.useRoadRunner ? 'Road Runner' : ''} ${robotConfig.useFTCLib ? 'FTCLib' : ''}

**Relevant Documentation:**
${ragContext}

**Task:** Generate complete, buildable FTC Java code files.

**Requirements:**
1. Package: org.firstinspires.ftc.teamcode
2. Base class: LinearOpMode or OpMode
3. Annotations: @TeleOp or @Autonomous
4. File paths: TeamCode/src/main/java/org/firstinspires/ftc/teamcode/...
5. Include Gradle dependencies
6. Add TODOs for team-specific values
7. Include telemetry for debugging

**Output Format:**
[4-section format as shown above]
`
}
```

---

### Mode 2: Assist

**Purpose:** Generate unified diffs for existing code

**Output Format:**
```markdown
### A) Answer
Brief explanation of changes

### B) Diffs

#### File: TeamCode/.../MyOpMode.java
```diff
--- a/TeamCode/src/main/java/org/firstinspires/ftc/teamcode/MyOpMode.java
+++ b/TeamCode/src/main/java/org/firstinspires/ftc/teamcode/MyOpMode.java
@@ -15,6 +15,8 @@ public class MyOpMode extends LinearOpMode {

     @Override
     public void runOpMode() {
+        // Initialize Limelight
+        Limelight3A limelight = hardwareMap.get(Limelight3A.class, "limelight");

         telemetry.addData("Status", "Initialized");
         telemetry.update();
```

### C) Test Routine (60 seconds)
1. [0:00-0:10] Deploy code, connect to Robot Controller
2. [0:10-0:20] Initialize OpMode, check telemetry
3. [0:20-0:40] Test new functionality
4. [0:40-0:60] Verify no errors, check logs

### D) Failure Modes & Fixes
[Common issues specific to the changes]
```

**Key Features:**
- Unified diff format (`---`/`+++`, `@@` line markers)
- Context lines before/after changes
- 60-second test routine
- Targeted modifications only

---

### Mode 3: Co-Pilot

**Purpose:** Plan approval before code generation

**Phase 1 - Planning:**
```markdown
### Implementation Plan

I propose the following approach:

**Step 1:** Set up Limelight hardware mapping
- Add Limelight3A to hardwareMap in init()
- Configure pipeline selection

**Step 2:** Create AprilTag detection loop
- Poll Limelight for detections in while(opModeIsActive())
- Parse LLResult for tag ID, tx, ty, ta

**Step 3:** Implement navigation logic
- Calculate drive power based on tx (horizontal offset)
- Drive forward until ta (area) > threshold
- Stop when aligned

**Step 4:** Add telemetry
- Display tag ID, offset, distance
- Show drive power values

**Step 5:** Add safety features
- Timeout after 30 seconds
- Stop if no tag detected for 5 seconds

Do you approve this plan? Reply "Approve" to proceed with code generation.
```

**Phase 2 - Generation (after approval):**
```markdown
### A) Generated Code
[Full code as in Mode 1]

### B) Implementation Notes
- Step 1 implemented in init()
- Steps 2-3 implemented in main loop
- Step 4: Telemetry added throughout
- Step 5: Timeout check added

### C) Test & Validation
[Standard 5-step test plan]
```

**Benefits:**
- User can review approach before committing
- Opportunity to clarify requirements
- Prevents wasted generation on wrong approach

---

## Common Modification Patterns

### Pattern 1: Adding a New Robot Configuration Field

**Use Case:** Team wants to add "gear ratio" parameter

**Steps:**

1. **Update types** (`/home/user/AI_FTC/lib/types.ts`):
```typescript
export interface RobotConfig {
  driveType: 'mecanum' | 'tank' | 'omni'
  wheelRadius: number
  trackWidth: number
  gearRatio: number // ADD THIS
  // ... other fields
}
```

2. **Update form component** (`/home/user/AI_FTC/components/RobotConfigForm.tsx`):
```typescript
<div>
  <label>Gear Ratio</label>
  <input
    type="number"
    value={config.gearRatio}
    onChange={(e) => onChange({ ...config, gearRatio: parseFloat(e.target.value) })}
    step="0.1"
  />
</div>
```

3. **Update default config** (`/home/user/AI_FTC/app/workbench/page.tsx`):
```typescript
const [robotConfig, setRobotConfig] = useState<RobotConfig>({
  driveType: 'mecanum',
  wheelRadius: 2,
  trackWidth: 16,
  gearRatio: 1.0, // ADD THIS
  // ... other fields
})
```

4. **Update system prompt** (`/home/user/AI_FTC/lib/prompt/system.ts`):
```typescript
**Robot Configuration:**
- Drive Type: ${robotConfig.driveType}
- Wheel Radius: ${robotConfig.wheelRadius} inches
- Track Width: ${robotConfig.trackWidth} inches
- Gear Ratio: ${robotConfig.gearRatio} // ADD THIS
```

---

### Pattern 2: Adding a New Component

**Use Case:** Create a telemetry display component

**Steps:**

1. **Create component file** (`/home/user/AI_FTC/components/TelemetryDisplay.tsx`):
```typescript
'use client'

interface Props {
  data: Record<string, string | number>
}

export default function TelemetryDisplay({ data }: Props) {
  return (
    <div className="glass p-4 rounded-xl">
      <h3 className="text-lg font-semibold mb-2">Telemetry</h3>
      <div className="space-y-1">
        {Object.entries(data).map(([key, value]) => (
          <div key={key} className="flex justify-between">
            <span className="text-white/60">{key}:</span>
            <span className="font-mono">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

2. **Import in parent** (`/home/user/AI_FTC/app/workbench/page.tsx`):
```typescript
import TelemetryDisplay from '@/components/TelemetryDisplay'

// In render:
<TelemetryDisplay data={{
  'Status': 'Generating',
  'Mode': mode,
  'Session': currentSession?.title ?? 'None'
}} />
```

---

### Pattern 3: Modifying the Glassmorphism Theme

**Use Case:** Make UI more transparent with stronger blur

**Location:** `/home/user/AI_FTC/styles/globals.css`

**Before:**
```css
.glass {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}
```

**After:**
```css
.glass {
  background: rgba(255, 255, 255, 0.03); /* More transparent */
  backdrop-filter: blur(30px) saturate(200%); /* Stronger blur */
  -webkit-backdrop-filter: blur(30px) saturate(200%);
  border: 1px solid rgba(255, 255, 255, 0.15); /* Brighter border */
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.2); /* Deeper shadow */
}
```

---

### Pattern 4: Adding Environment Variable Support

**Use Case:** Add server-side API key fallback

**Steps:**

1. **Update .env.example:**
```env
# Optional: Server-side API key fallback
SERVER_ANTHROPIC_KEY=sk-ant-...
```

2. **Update API route** (`/home/user/AI_FTC/app/api/claude/route.ts`):
```typescript
const apiKey = req.headers.get('x-api-key') || process.env.SERVER_ANTHROPIC_KEY

if (!apiKey) {
  return new Response('API key required', { status: 401 })
}
```

3. **Update documentation** (`README.md`, `SETUP.md`)

---

## Testing & Validation

### Manual Testing Checklist

**Before committing changes:**

1. **TypeScript compilation:**
```bash
npm run build
```
Expected: No type errors

2. **ESLint validation:**
```bash
npm run lint
```
Expected: No warnings

3. **Development server:**
```bash
npm run dev
```
Expected: Server starts on port 3000, no console errors

4. **Browser testing:**
- Open http://localhost:3000
- Check for visual regressions
- Test all interactive elements
- Verify localStorage persistence
- Test API key configuration
- Test generation modes
- Test file download

---

### Testing Generated FTC Code

**Standard test plan for AI-generated code:**

**1. Build Test (Android Studio):**
```bash
# In Android Studio:
Build > Make Project (Ctrl+F9)

# Expected: 0 errors, 0 warnings
```

**2. Deploy Test:**
```bash
# Upload to Robot Controller
Build > Deploy to Device

# Expected: Successful deployment, OpMode appears in Driver Station
```

**3. Init Test:**
```bash
# In Driver Station:
1. Select OpMode
2. Press INIT
3. Check telemetry output

# Expected: "Status: Initialized" appears, no errors
```

**4. Dry Run Test (30 seconds):**
```bash
# Without full field setup:
1. Press START
2. Let run for 30 seconds
3. Press STOP
4. Check telemetry logs

# Expected: No crashes, telemetry shows expected values
```

**5. Field Test:**
```bash
# On full field:
1. Place robot at starting position
2. Press INIT, verify sensor readings
3. Press START
4. Observe behavior
5. Check logs for errors

# Expected: Robot behaves as intended, encoder/IMU data looks reasonable
```

---

### Common Test Failures

**Failure:** TypeScript error `Property 'X' does not exist on type 'Y'`
- **Cause:** Type mismatch or missing type definition
- **Fix:** Check type definitions in `/home/user/AI_FTC/lib/types.ts`, ensure interface matches usage

**Failure:** Runtime error `Cannot read property 'X' of undefined`
- **Cause:** Accessing property on null/undefined object
- **Fix:** Add optional chaining (`?.`) or null check (`if (obj) {...}`)

**Failure:** API route returns 500 error
- **Cause:** Server-side exception
- **Fix:** Check server console logs, add try/catch blocks

**Failure:** RAG returns no results
- **Cause:** Cache empty or query too specific
- **Fix:** Delete `.rag-cache/documents.json`, restart server, try broader query

**Failure:** File download fails
- **Cause:** Large file size or serverless timeout
- **Fix:** Reduce file count, check file sizes, increase timeout limit

---

## Troubleshooting Guide

### Issue: RAG Retrieval Returns No Results

**Symptoms:**
- AI responses lack FTC-specific context
- Generated code uses generic patterns instead of FTC SDK

**Diagnosis:**
```bash
# Check if RAG cache exists
ls -la /home/user/AI_FTC/.rag-cache/documents.json

# Check file size (should be > 100KB)
du -h /home/user/AI_FTC/.rag-cache/documents.json

# Check browser console for RAG errors
# Look for: "RAG retrieval failed" or "0 documents retrieved"
```

**Solutions:**

1. **Force re-ingest:**
```bash
# Delete cache
rm /home/user/AI_FTC/.rag-cache/documents.json

# Restart server
npm run dev

# Check browser console for "Ingested X documents"
```

2. **Check GitHub API rate limit:**
```bash
# In browser console:
fetch('https://api.github.com/rate_limit')
  .then(r => r.json())
  .then(d => console.log(d))

# Look for: "remaining": 0
# Solution: Wait 1 hour or add GitHub token
```

3. **Verify document sources:**
```typescript
// Check /home/user/AI_FTC/lib/rag/types.ts
// Ensure FTC_SOURCES array is populated
```

---

### Issue: Streaming Response Cuts Off Mid-Generation

**Symptoms:**
- AI response stops abruptly
- Incomplete code blocks
- "Generating..." status never completes

**Diagnosis:**
```bash
# Check browser console for errors
# Look for: "Failed to fetch", "Network error", "Stream closed"

# Check server logs (terminal running npm run dev)
# Look for: "Connection reset", "Timeout", "API error"
```

**Solutions:**

1. **API key issue:**
- Verify key in browser localStorage: `localStorage.getItem('apiKey')`
- Check key has credits/quota
- Re-enter key in settings

2. **Network timeout:**
- Reduce complexity of request
- Simplify robot configuration
- Use shorter prompts

3. **AI provider rate limit:**
- Check Anthropic/OpenAI dashboard for rate limits
- Wait and retry
- Consider switching providers

---

### Issue: Generated Code Has Compilation Errors

**Symptoms:**
- Android Studio shows red underlines
- Build fails with errors

**Diagnosis:**
- Check error messages in Android Studio
- Look for import errors, syntax errors, type mismatches

**Solutions:**

1. **Missing imports:**
```java
// AI may forget imports, add manually:
import com.qualcomm.robotcore.hardware.DcMotor;
import com.qualcomm.robotcore.hardware.Servo;
```

2. **Wrong package name:**
```java
// AI should use: org.firstinspires.ftc.teamcode
// If not, change package declaration at top of file
```

3. **Gradle dependency missing:**
- Check if AI provided Gradle snippet
- Add to `TeamCode/build.gradle`:
```gradle
dependencies {
    implementation 'org.ftclib.ftclib:core:2.1.1'
}
```
- Sync Gradle (File > Sync Project with Gradle Files)

---

### Issue: Glassmorphism Not Rendering (Blurred Background Missing)

**Symptoms:**
- UI looks flat, no blur effect
- Cards have solid background instead of translucent

**Diagnosis:**
```bash
# Check browser support for backdrop-filter
# Open browser console:
CSS.supports('backdrop-filter', 'blur(10px)')

# If returns false, browser doesn't support backdrop-filter
```

**Solutions:**

1. **Browser compatibility:**
- Use Chrome 76+, Safari 9+, Edge 79+
- Firefox requires `layout.css.backdrop-filter.enabled` = true in about:config

2. **Fallback for unsupported browsers:**
```css
/* In /home/user/AI_FTC/styles/globals.css */
.glass {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);

  /* Fallback for browsers without backdrop-filter support */
  @supports not (backdrop-filter: blur(20px)) {
    background: rgba(30, 30, 30, 0.9); /* Solid background */
  }
}
```

---

### Issue: Sessions Lost After Browser Refresh

**Symptoms:**
- localStorage sessions disappear
- "No sessions" message on reload

**Diagnosis:**
```bash
# Check if localStorage is working
# In browser console:
localStorage.setItem('test', 'value')
localStorage.getItem('test') // Should return 'value'

# Check if sessions are saved:
JSON.parse(localStorage.getItem('sessions') || '[]')
```

**Solutions:**

1. **Private browsing mode:**
- localStorage is disabled in private/incognito mode
- Solution: Use normal browsing mode

2. **Browser settings:**
- Check if cookies/storage is blocked
- Enable third-party cookies if needed

3. **Storage quota exceeded:**
- Clear old sessions: `localStorage.removeItem('sessions')`
- Reduce session count

---

## Git Workflow

### Branch Strategy

**Main branch:** `main` (production)
**Feature branches:** `feature/description`
**Bug fixes:** `fix/description`
**Claude branches:** `claude/session-id`

### Commit Message Format

```
<type>: <short description>

<optional detailed description>

<optional footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Formatting, missing semicolons, etc.
- `refactor`: Code change that neither fixes bug nor adds feature
- `test`: Adding tests
- `chore`: Updating build tasks, package manager configs, etc.

**Examples:**
```bash
git commit -m "feat: add Gemini AI provider support"
git commit -m "fix: resolve RAG cache corruption on concurrent ingest"
git commit -m "docs: update CLAUDE.md with new RAG sources"
git commit -m "refactor: extract session management to custom hook"
```

---

### Creating a Pull Request

**Steps:**

1. **Create feature branch:**
```bash
git checkout -b feature/add-telemetry-component
```

2. **Make changes, commit:**
```bash
git add .
git commit -m "feat: add TelemetryDisplay component with glassmorphism styling"
```

3. **Push to remote:**
```bash
git push -u origin feature/add-telemetry-component
```

4. **Create PR:**
- Go to GitHub repository
- Click "New Pull Request"
- Select base: `main`, compare: `feature/add-telemetry-component`
- Fill in PR template:

```markdown
## Description
Adds a new TelemetryDisplay component for showing robot telemetry data in the UI.

## Changes
- Created `/components/TelemetryDisplay.tsx`
- Added glassmorphism styling
- Integrated into workbench page
- Updated types for telemetry data structure

## Testing
- [x] TypeScript compiles without errors
- [x] ESLint passes
- [x] Visual inspection in browser
- [x] Telemetry data displays correctly

## Screenshots
[Attach screenshots of new component]
```

5. **Request review, merge when approved**

---

## Final Notes for AI Assistants

### When Responding to User Queries

**1. File path references:**
- Always use absolute paths: `/home/user/AI_FTC/...`
- Include line numbers when relevant: `workbench/page.tsx:150`

**2. Code examples:**
- Show complete examples, not just snippets
- Include import statements
- Add comments explaining key parts

**3. Multiple solutions:**
- Offer alternatives when applicable
- Explain trade-offs (performance vs. simplicity, etc.)

**4. Context awareness:**
- Reference existing patterns in the codebase
- Maintain consistency with conventions (TypeScript, React, Tailwind)
- Respect the glassmorphism design language

**5. Validation:**
- Remind user to test changes
- Suggest relevant test cases
- Point to troubleshooting section if applicable

---

### Understanding User Intent

**Query types and appropriate responses:**

**"How do I...?"**
- Provide step-by-step instructions
- Reference specific files
- Include code examples
- Link to relevant documentation

**"Why does...?"**
- Explain the underlying reason
- Reference architecture decisions
- Provide context from this CLAUDE.md

**"Can you add...?"**
- Follow modification patterns from this guide
- Show complete implementation
- Update all related files (types, components, etc.)
- Suggest testing approach

**"Fix..."**
- Diagnose the issue
- Reference troubleshooting guide
- Provide solution with explanation
- Suggest prevention strategies

---

### Codebase Health Principles

**1. Type safety:**
- Never use `any` type without justification
- Prefer explicit types over inference when clarity matters
- Use `unknown` instead of `any` for truly unknown types

**2. Error handling:**
- Always wrap async operations in try/catch
- Provide meaningful error messages
- Log errors for debugging

**3. Performance:**
- Avoid unnecessary re-renders (React.memo, useMemo, useCallback)
- Lazy load heavy components
- Optimize image sizes

**4. Security:**
- Never expose API keys in client-side code (except BYOK in localStorage)
- Validate all user inputs
- Sanitize HTML before rendering (use React's built-in XSS protection)

**5. Accessibility:**
- Use semantic HTML elements
- Add ARIA labels where needed
- Ensure keyboard navigation works
- Maintain sufficient color contrast

---

## Version History

- **v1.0** (2025-11-15) - Initial CLAUDE.md creation
  - Comprehensive codebase documentation
  - Architecture patterns documented
  - Development workflows established
  - RAG system deep dive added
  - Troubleshooting guide created

---

## Additional Resources

- **README.md** - User-facing documentation
- **FEATURES.md** - Feature changelog and UI details
- **SETUP.md** - Setup instructions for end users
- **FTC Documentation** - https://ftc-docs.firstinspires.org
- **Next.js Docs** - https://nextjs.org/docs
- **Anthropic Claude** - https://docs.anthropic.com
- **OpenAI GPT** - https://platform.openai.com/docs

---

**End of CLAUDE.md**
