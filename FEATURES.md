# FTC AI Workbench - Enhanced Features

## ✨ New in this Version

### 1. **Live GitHub Repository Integration**

The app now fetches actual FTC SDK code directly from GitHub:
- Automatically retrieves Java files from FtcRobotController repository
- Parses classes, methods, and FTC SDK structure
- RAG system has access to real FTC hardware APIs and OpMode patterns
- Updates: Fetches up to 50 Java files from specified paths

**How it works:**
```typescript
// Fetches from: https://github.com/FIRST-Tech-Challenge/FtcRobotController
// Paths: FtcRobotController/src/main/java/org/firstinspires/ftc/robotcontroller
```

No GitHub API token required for public repositories (rate limit: 60 requests/hour).

### 2. **Glassmorphism UI (Cluely/Apple Spotlight Style)**

Complete UI redesign with modern aesthetics:
- **Pure black background** with gradient mesh overlay
- **Glassmorphism cards** with backdrop blur and transparency
- **Smooth animations**: fade-in, slide-up transitions
- **Apple-style shadows**: glow effects on interactive elements
- **SF Pro Display** font family (system fonts)
- **Rounded corners**: 16-20px radii throughout

#### Color Palette:
- Background: `#000000` (pure black)
- Accent: `#0A84FF` (Apple blue)
- Surface: `rgba(255, 255, 255, 0.05)` with blur
- Text: `#FFFFFF` with varying opacity

#### Visual Effects:
- Backdrop blur: 20px with saturation boost
- Box shadows: soft glows on hover
- Border: 1px `rgba(255, 255, 255, 0.1)`
- Gradient mesh background with radial gradients

### 3. **Enhanced User Experience**

- **Instant visual feedback**: All buttons have hover states with glow
- **Loading animations**: Spinning indicator during generation
- **Smooth transitions**: 300-400ms cubic-bezier easing
- **Focus states**: Accent-colored outlines on focus
- **Custom scrollbars**: Transparent with glassmorphism
- **Responsive layout**: Adapts to viewport size

### 4. **Improved Typography**

- Primary font: SF Pro Display (Apple system font)
- Monospace: SF Mono (code blocks)
- Letter spacing: -0.01em (tight tracking)
- Font weights: 400 (normal), 500 (medium), 600 (semibold)

## 🎨 Design System

### Glass Components

All major UI elements use the `.glass` utility class:

```css
.glass {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
}
```

### Animations

- `fade-in`: 300ms opacity transition
- `slide-up`: 400ms translateY + opacity
- `pulse-slow`: 3s breathing effect
- `spin`: Loading indicators

### Shadows

- `shadow-glass`: Subtle depth for cards
- `shadow-glow`: Accent-colored glow for CTAs
- `shadow-inner-glow`: Inset glow for inputs

## 🚀 Performance

- Edge runtime for AI streaming (low latency)
- Optimized Tailwind JIT compilation
- Lazy-loaded components
- GitHub API rate-limiting (100ms between requests)
- Client-side caching for API keys

## 📱 Responsive Design

The UI adapts across screen sizes:
- Desktop: Split 1/3 (config) - 2/3 (output) layout
- Tablet: Stacked layout with collapsible config
- Mobile: Full-width with slide-out panels

## 🔒 Privacy & Security

- **BYOK**: API keys stored in browser localStorage only
- **No telemetry**: Zero analytics or tracking
- **Direct API calls**: Browser → AI provider (no proxy)
- **Local file generation**: Files assembled client-side

## 🛠 Technical Stack

- **Framework**: Next.js 15 (App Router)
- **Runtime**: Edge (streaming) + Node (file ops)
- **Styling**: Tailwind CSS 3.4
- **Fonts**: System fonts (SF Pro, Segoe UI, Roboto)
- **APIs**: Anthropic Claude / OpenAI GPT
- **RAG**: GitHub REST API + custom text search

## 📦 New Dependencies

All existing dependencies remain. No additional packages needed for glassmorphism - pure Tailwind CSS.

## 🎯 Next Steps

To further enhance:
1. Add vector embeddings (OpenAI/Cohere) for better RAG
2. Implement proper vector store (Pinecone, Chroma)
3. Add GitHub API token support for higher rate limits
4. Cache fetched repositories locally
5. Add syntax highlighting for code blocks
6. Implement diff view for Assist mode

## 🐛 Known Issues

- GitHub API has 60 req/hour limit without token
- Hot reload may require clearing localStorage if API config persists incorrectly
- Some browsers may not support backdrop-filter (fallback: solid background)

## 📸 Screenshots

The new UI features:
- Gradient mesh background (blue + purple radials)
- Glass cards with blur effects
- Glowing accent buttons
- Clean, minimal header with status badge
- Smooth hover transitions
- Modern, professional aesthetic

Inspired by: Cluely, Apple macOS Big Sur/Monterey, iOS 15+ design language
