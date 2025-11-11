/**
 * Assist Mode
 * Generates unified diffs for existing code modifications
 */

import { RobotConfig, GeneratedDiff } from '../types';

export function buildAssistPrompt(
  userPrompt: string,
  robotConfig: RobotConfig,
  retrievedContext: string,
  existingFiles?: { path: string; content: string }[]
): string {
  let filesContext = '';

  if (existingFiles && existingFiles.length > 0) {
    filesContext = '\n# Existing Files\n\n';
    existingFiles.forEach((file) => {
      filesContext += `## File: ${file.path}\n\`\`\`java\n${file.content}\n\`\`\`\n\n`;
    });
  }

  return `${retrievedContext}

${filesContext}

# User Request
${userPrompt}

# Robot Configuration
- Drive Type: ${robotConfig.driveType}
- Wheel Radius: ${robotConfig.wheelRadius} inches
- Track Width: ${robotConfig.trackWidth} inches
- IMU Orientation: ${robotConfig.imuOrientation}

# Framework Toggles
${Object.entries(robotConfig.frameworkToggles)
  .filter(([_, enabled]) => enabled)
  .map(([name]) => `- ${name}`)
  .join('\n') || 'None'}

# Mode: Assist
Provide targeted modifications to the specified files using unified diff format:

\`\`\`diff
--- a/path/to/file.java
+++ b/path/to/file.java
@@ -10,7 +10,9 @@
 existing line
-remove this line
+add this line
+add another line
 existing line
\`\`\`

For each file:
1. Show only the changed sections (with 3 lines of context)
2. Include brief commentary (1-2 sentences) explaining the change
3. Provide a 60-second test routine to verify the modification

Keep diffs minimal and focused on the user's request.`;
}

/**
 * Extract diffs from AI response
 */
export function extractDiffs(response: string): GeneratedDiff[] {
  const diffs: GeneratedDiff[] = [];

  // Match diff blocks
  const diffPattern = /```diff\n([\s\S]*?)```/g;
  let match;

  while ((match = diffPattern.exec(response)) !== null) {
    const diffContent = match[1].trim();

    // Extract file path from diff header
    const pathMatch = diffContent.match(/^\+\+\+ b\/(.+)$/m);
    const path = pathMatch ? pathMatch[1] : 'unknown';

    // Look for commentary before or after diff
    const startIndex = match.index;
    const beforeText = response.slice(Math.max(0, startIndex - 300), startIndex);
    const afterText = response.slice(
      match.index + match[0].length,
      match.index + match[0].length + 300
    );

    // Extract commentary (sentences before/after the diff)
    const commentaryMatch =
      beforeText.match(/([A-Z][^.!?]*[.!?])\s*$/s) ||
      afterText.match(/^([A-Z][^.!?]*[.!?])/s);

    const commentary = commentaryMatch ? commentaryMatch[1].trim() : undefined;

    diffs.push({
      path,
      diff: diffContent,
      commentary,
    });
  }

  return diffs;
}

/**
 * Apply diff to existing content (basic implementation)
 * For production, use a proper diff/patch library
 */
export function applyDiff(originalContent: string, diff: string): string {
  // This is a simplified implementation
  // For production, use libraries like diff-match-patch or node-patch

  const lines = originalContent.split('\n');
  const diffLines = diff.split('\n');

  // Parse diff to find changes
  // This is a basic implementation - real diff application is more complex
  console.warn('applyDiff is a simplified implementation. Use a proper diff library for production.');

  // For now, just return original content with a warning comment
  return `// TODO: Apply diff manually\n// ${diff}\n\n${originalContent}`;
}
