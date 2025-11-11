/**
 * Full Generation Mode
 * Generates complete, buildable FTC Java files with Gradle dependencies
 */

import { RobotConfig, GeneratedFile } from '../types';

export function buildFullGenerationPrompt(
  userPrompt: string,
  robotConfig: RobotConfig,
  retrievedContext: string
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

# Mode: Full Generation
Generate complete, buildable FTC Java files that:
1. Use the robot configuration constants above
2. Follow FTC SDK best practices (LinearOpMode, annotations, etc.)
3. Include all necessary imports and package declarations
4. Provide file paths relative to TeamCode directory
5. Include Gradle dependency additions if needed
6. ${robotConfig.frameworkToggles.roadrunner ? 'Include Road Runner DriveConstants.java and trajectory code' : ''}
7. ${robotConfig.frameworkToggles.externalVision ? 'Include both Limelight AND VisionPortal fallback code' : ''}
8. ${robotConfig.frameworkToggles.dashboard ? 'Include FTC Dashboard telemetry annotations' : ''}
9. ${robotConfig.frameworkToggles.ftclib ? 'Use FTCLib command-based structure' : ''}

Provide output in the structured format (A-D sections) as specified in your system prompt.`;
}

/**
 * Extract generated files from AI response
 * Parses code blocks with file path headers
 */
export function extractFiles(response: string): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  // Match patterns like:
  // ### File: TeamCode/src/main/java/...
  // ```java
  // [code]
  // ```
  const filePattern = /### File: (.+?)\n```(\w+)?\n([\s\S]*?)```/g;
  let match;

  while ((match = filePattern.exec(response)) !== null) {
    const path = match[1].trim();
    const content = match[3].trim();

    files.push({ path, content });
  }

  // Also match Gradle additions
  const gradlePattern = /### Gradle: (.+?)\n```(\w+)?\n([\s\S]*?)```/g;

  while ((match = gradlePattern.exec(response)) !== null) {
    const path = match[1].trim();
    const content = match[3].trim();

    // Format as comment block for clarity
    const wrappedContent = `// Add to ${path}:\n\n${content}`;
    files.push({ path: `GRADLE_${path}`, content: wrappedContent });
  }

  return files;
}

/**
 * Validate generated files for common issues
 */
export function validateFiles(files: GeneratedFile[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const file of files) {
    // Check for package declaration in Java files
    if (file.path.endsWith('.java') && !file.content.includes('package org.firstinspires.ftc')) {
      errors.push(`${file.path}: Missing FTC package declaration`);
    }

    // Check for OpMode annotation
    if (
      file.path.includes('OpMode.java') &&
      !file.content.includes('@TeleOp') &&
      !file.content.includes('@Autonomous')
    ) {
      errors.push(`${file.path}: Missing @TeleOp or @Autonomous annotation`);
    }

    // Check for TODO markers
    if (file.content.includes('TODO:')) {
      errors.push(`${file.path}: Contains TODO markers - user must fill in placeholders`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
