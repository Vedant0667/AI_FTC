/**
 * Limelight Vision Integration
 * USB-based external vision processor for FTC
 * Source: https://docs.limelightvision.io/docs/docs-limelight/apis/ftc-programming
 */

import { LimelightConfig } from '../types';

export interface LimelightResult {
  valid: boolean;
  targetCount: number;
  targets: LimelightTarget[];
  captureLatency: number;
  pipelineLatency: number;
}

export interface LimelightTarget {
  tx: number;           // Horizontal offset from crosshair (-29.8 to 29.8 degrees)
  ty: number;           // Vertical offset from crosshair (-24.85 to 24.85 degrees)
  ta: number;           // Target area (0% to 100% of image)
  ts: number;           // Skew/rotation (-90 to 0 degrees)
  tid: number;          // AprilTag ID (for AprilTag pipeline)
  pose?: {
    x: number;
    y: number;
    z: number;
    roll: number;
    pitch: number;
    yaw: number;
  };
}

/**
 * Limelight initialization code template
 * This generates Java code for FTC OpMode integration
 */
export function generateLimelightInit(config: LimelightConfig): string {
  return `// Limelight initialization
import com.qualcomm.hardware.limelightvision.LLResult;
import com.qualcomm.hardware.limelightvision.LLResultTypes;
import com.qualcomm.hardware.limelightvision.Limelight3A;

// In your OpMode class:
private Limelight3A limelight;

@Override
public void init() {
    // Initialize Limelight
    limelight = hardwareMap.get(Limelight3A.class, "limelight");

    // Configure pipeline
    limelight.pipelineSwitch(${config.pipelineIndex});

    // Start the Limelight
    limelight.start();

    telemetry.addData("Limelight", "Initialized");
    telemetry.update();
}`;
}

/**
 * Limelight reading code template
 * For use in loop() or runOpMode()
 */
export function generateLimelightRead(): string {
  return `// Read Limelight results
LLResult result = limelight.getLatestResult();

if (result != null && result.isValid()) {
    // AprilTag detection
    List<LLResultTypes.FiducialResult> fiducials = result.getFiducialResults();

    if (!fiducials.isEmpty()) {
        for (LLResultTypes.FiducialResult tag : fiducials) {
            telemetry.addData("Tag ID", tag.getFiducialId());
            telemetry.addData("TX", "%.2f", tag.getTargetXDegrees());
            telemetry.addData("TY", "%.2f", tag.getTargetYDegrees());
            telemetry.addData("TA", "%.2f", tag.getTargetArea());

            // Robot pose relative to tag
            Pose3D pose = tag.getRobotPoseFieldSpace();
            if (pose != null) {
                telemetry.addData("X", "%.2f", pose.getPosition().x);
                telemetry.addData("Y", "%.2f", pose.getPosition().y);
                telemetry.addData("Z", "%.2f", pose.getPosition().z);
                telemetry.addData("Yaw", "%.2f", Math.toDegrees(pose.getOrientation().getYaw()));
            }
        }
    } else {
        telemetry.addData("Limelight", "No targets detected");
    }

    telemetry.addData("Latency", "%.1f ms", result.getStaleness());
} else {
    telemetry.addData("Limelight", "No valid result");
}

telemetry.update();`;
}

/**
 * Limelight shutdown code
 */
export function generateLimelightShutdown(): string {
  return `@Override
public void stop() {
    if (limelight != null) {
        limelight.stop();
    }
}`;
}

/**
 * Complete Limelight example OpMode
 */
export function generateLimelightExample(config: LimelightConfig): string {
  return `package org.firstinspires.ftc.teamcode;

import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;
import com.qualcomm.robotcore.eventloop.opmode.TeleOp;
import com.qualcomm.hardware.limelightvision.LLResult;
import com.qualcomm.hardware.limelightvision.LLResultTypes;
import com.qualcomm.hardware.limelightvision.Limelight3A;
import org.firstinspires.ftc.robotcore.external.navigation.Pose3D;

import java.util.List;

@TeleOp(name="Limelight Example", group="Examples")
public class LimelightExample extends LinearOpMode {

    private Limelight3A limelight;

    @Override
    public void runOpMode() {
        // Initialize hardware
        limelight = hardwareMap.get(Limelight3A.class, "limelight");
        limelight.pipelineSwitch(${config.pipelineIndex});
        limelight.start();

        telemetry.addData("Status", "Initialized");
        telemetry.addData("Team Number", ${config.teamNumber});
        telemetry.update();

        waitForStart();

        while (opModeIsActive()) {
            LLResult result = limelight.getLatestResult();

            if (result != null && result.isValid()) {
                List<LLResultTypes.FiducialResult> fiducials = result.getFiducialResults();

                telemetry.addData("Targets Found", fiducials.size());

                for (LLResultTypes.FiducialResult tag : fiducials) {
                    telemetry.addData("Tag ID", tag.getFiducialId());
                    telemetry.addData("TX", "%.2f deg", tag.getTargetXDegrees());
                    telemetry.addData("TY", "%.2f deg", tag.getTargetYDegrees());
                    telemetry.addData("Area", "%.2f%%", tag.getTargetArea());

                    Pose3D robotPose = tag.getRobotPoseFieldSpace();
                    if (robotPose != null) {
                        telemetry.addData("Position", "X=%.2f Y=%.2f Z=%.2f",
                            robotPose.getPosition().x,
                            robotPose.getPosition().y,
                            robotPose.getPosition().z);
                    }
                }

                telemetry.addData("Latency", "%.1f ms", result.getStaleness());
            } else {
                telemetry.addData("Limelight", "Waiting for targets...");
            }

            telemetry.update();
        }

        limelight.stop();
    }
}`;
}
