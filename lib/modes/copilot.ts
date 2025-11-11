/**
 * Co-Pilot Mode
 * First generates a plan, waits for confirmation, then generates code
 */

import { RobotConfig, CopilotPlan } from '../types';

export function buildCopilotPlanPrompt(
  userPrompt: string,
  robotConfig: RobotConfig,
  retrievedContext: string
): string {
  return `${retrievedContext}

# User Request
${userPrompt}

# Robot Configuration
- Drive Type: ${robotConfig.driveType}
- Frameworks: ${Object.entries(robotConfig.frameworkToggles)
    .filter(([_, enabled]) => enabled)
    .map(([name]) => name)
    .join(', ') || 'None'}

# Mode: Co-Pilot (Planning Phase)
Create a step-by-step implementation plan (3-6 steps) for this request.

For each step, specify:
- What files will be created/modified
- What key functionality will be implemented
- What dependencies (if any) will be added

Format as a numbered list. Keep it concise but specific.

After presenting the plan, state: "Awaiting confirmation to proceed with code generation."

Do NOT generate actual code yet.`;
}

export function buildCopilotGeneratePrompt(
  userPrompt: string,
  robotConfig: RobotConfig,
  retrievedContext: string,
  plan: string
): string {
  return `${retrievedContext}

# User Request
${userPrompt}

# Robot Configuration
- Drive Type: ${robotConfig.driveType}
- Wheel Radius: ${robotConfig.wheelRadius} inches
- Track Width: ${robotConfig.trackWidth} inches
- Gear Ratio: ${robotConfig.gearRatio}
- IMU Orientation: ${robotConfig.imuOrientation}
- Camera Model: ${robotConfig.cameraModel}

# Framework Toggles
${Object.entries(robotConfig.frameworkToggles)
  .filter(([_, enabled]) => enabled)
  .map(([name]) => `- ${name}`)
  .join('\n') || 'None'}

# Approved Plan
${plan}

# Mode: Co-Pilot (Generation Phase)
Now generate the complete code according to the approved plan above.

Follow the same requirements as Full Generation mode:
1. Complete, buildable FTC Java files
2. Use robot configuration constants
3. Include file paths, imports, annotations
4. Provide Gradle dependencies if needed
5. Include test & validation steps
6. Include failure modes & fixes

Provide output in the structured format (A-D sections).`;
}

/**
 * Extract plan from AI response
 */
export function extractPlan(response: string): CopilotPlan {
  const lines = response.split('\n');
  const steps: string[] = [];

  for (const line of lines) {
    // Match numbered list items (1. Step, 2. Step, etc.)
    const match = line.match(/^\s*(\d+)\.\s+(.+)$/);
    if (match) {
      steps.push(match[2].trim());
    }
  }

  // Check if awaiting confirmation
  const awaitingConfirmation = response
    .toLowerCase()
    .includes('awaiting confirmation');

  return {
    steps,
    awaitingConfirmation,
  };
}

/**
 * Check if response contains a plan vs actual code
 */
export function isPlanResponse(response: string): boolean {
  const hasAwaitingConfirmation = response
    .toLowerCase()
    .includes('awaiting confirmation');
  const hasCodeBlocks = /```(\w+)/.test(response);
  const hasNumberedSteps = /^\s*\d+\.\s+/m.test(response);

  // It's a plan if it has numbered steps, awaiting confirmation, and no code blocks
  return hasNumberedSteps && hasAwaitingConfirmation && !hasCodeBlocks;
}
