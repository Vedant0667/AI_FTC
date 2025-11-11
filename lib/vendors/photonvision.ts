/**
 * PhotonVision Integration
 * Network-based vision processor for FTC
 * Source: https://docs.photonvision.org
 */

import { PhotonVisionConfig } from '../types';

export interface PhotonVisionResult {
  hasTargets: boolean;
  latency: number;
  targets: PhotonTarget[];
}

export interface PhotonTarget {
  yaw: number;
  pitch: number;
  area: number;
  skew: number;
  fiducialId?: number;
  pose?: {
    x: number;
    y: number;
    z: number;
    rotation: number;
  };
}

/**
 * PhotonVision initialization code template
 * Uses NetworkTables for communication
 */
export function generatePhotonVisionInit(config: PhotonVisionConfig): string {
  return `// PhotonVision initialization
// Note: PhotonVision uses NetworkTables, which requires additional setup
// This is a simplified example - consult PhotonVision docs for full FTC integration

import org.photonvision.PhotonCamera;
import org.photonvision.targeting.PhotonPipelineResult;
import org.photonvision.targeting.PhotonTrackedTarget;

// In your OpMode class:
private PhotonCamera camera;

@Override
public void init() {
    // Initialize PhotonVision camera
    // Camera name must match the one configured in PhotonVision UI
    camera = new PhotonCamera("${config.cameraName}");

    // Note: Ensure NetworkTables is configured to connect to ${config.ipAddress}:${config.port}

    telemetry.addData("PhotonVision", "Initialized");
    telemetry.addData("Camera", "${config.cameraName}");
    telemetry.update();
}`;
}

/**
 * PhotonVision reading code template
 */
export function generatePhotonVisionRead(): string {
  return `// Read PhotonVision results
PhotonPipelineResult result = camera.getLatestResult();

if (result.hasTargets()) {
    PhotonTrackedTarget target = result.getBestTarget();

    telemetry.addData("Yaw", "%.2f deg", target.getYaw());
    telemetry.addData("Pitch", "%.2f deg", target.getPitch());
    telemetry.addData("Area", "%.2f%%", target.getArea());
    telemetry.addData("Skew", "%.2f deg", target.getSkew());

    // For AprilTag detection
    if (target.getFiducialId() >= 0) {
        telemetry.addData("Tag ID", target.getFiducialId());

        // Get pose estimate if available
        var pose = target.getBestCameraToTarget();
        telemetry.addData("X", "%.2f", pose.getX());
        telemetry.addData("Y", "%.2f", pose.getY());
        telemetry.addData("Z", "%.2f", pose.getZ());
    }

    telemetry.addData("Latency", "%.1f ms", result.getLatencyMillis());
    telemetry.addData("Targets", result.getTargets().size());
} else {
    telemetry.addData("PhotonVision", "No targets detected");
}

telemetry.update();`;
}

/**
 * Complete PhotonVision example OpMode
 */
export function generatePhotonVisionExample(config: PhotonVisionConfig): string {
  return `package org.firstinspires.ftc.teamcode;

import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;
import com.qualcomm.robotcore.eventloop.opmode.TeleOp;
import org.photonvision.PhotonCamera;
import org.photonvision.targeting.PhotonPipelineResult;
import org.photonvision.targeting.PhotonTrackedTarget;

import java.util.List;

@TeleOp(name="PhotonVision Example", group="Examples")
public class PhotonVisionExample extends LinearOpMode {

    private PhotonCamera camera;

    @Override
    public void runOpMode() {
        // Initialize PhotonVision
        camera = new PhotonCamera("${config.cameraName}");

        telemetry.addData("Status", "Initialized");
        telemetry.addData("Camera", "${config.cameraName}");
        telemetry.addData("IP Address", "${config.ipAddress}:${config.port}");
        telemetry.update();

        waitForStart();

        while (opModeIsActive()) {
            PhotonPipelineResult result = camera.getLatestResult();

            if (result.hasTargets()) {
                List<PhotonTrackedTarget> targets = result.getTargets();
                PhotonTrackedTarget best = result.getBestTarget();

                telemetry.addData("Targets Found", targets.size());
                telemetry.addData("Best Target Yaw", "%.2f deg", best.getYaw());
                telemetry.addData("Best Target Pitch", "%.2f deg", best.getPitch());
                telemetry.addData("Best Target Area", "%.2f%%", best.getArea());

                // AprilTag specific
                int tagId = best.getFiducialId();
                if (tagId >= 0) {
                    telemetry.addData("AprilTag ID", tagId);

                    var transform = best.getBestCameraToTarget();
                    telemetry.addData("Transform X", "%.2f m", transform.getX());
                    telemetry.addData("Transform Y", "%.2f m", transform.getY());
                    telemetry.addData("Transform Z", "%.2f m", transform.getZ());
                }

                telemetry.addData("Latency", "%.1f ms", result.getLatencyMillis());
            } else {
                telemetry.addData("PhotonVision", "Waiting for targets...");
            }

            telemetry.update();
        }
    }
}`;
}

/**
 * Dual vision system (Limelight + PhotonVision fallback)
 */
export function generateDualVisionSystem(
  limelightConfig: { pipelineIndex: number },
  photonConfig: PhotonVisionConfig
): string {
  return `package org.firstinspires.ftc.teamcode;

import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;
import com.qualcomm.robotcore.eventloop.opmode.TeleOp;
import com.qualcomm.hardware.limelightvision.Limelight3A;
import com.qualcomm.hardware.limelightvision.LLResult;
import org.photonvision.PhotonCamera;
import org.photonvision.targeting.PhotonPipelineResult;

@TeleOp(name="Dual Vision System", group="Vision")
public class DualVisionSystem extends LinearOpMode {

    private Limelight3A limelight;
    private PhotonCamera photonCamera;
    private boolean useLimelight = true;

    @Override
    public void runOpMode() {
        // Try Limelight first
        try {
            limelight = hardwareMap.get(Limelight3A.class, "limelight");
            limelight.pipelineSwitch(${limelightConfig.pipelineIndex});
            limelight.start();
            useLimelight = true;
            telemetry.addData("Vision", "Using Limelight");
        } catch (Exception e) {
            // Fallback to PhotonVision
            useLimelight = false;
            photonCamera = new PhotonCamera("${photonConfig.cameraName}");
            telemetry.addData("Vision", "Using PhotonVision (Limelight not found)");
        }

        telemetry.update();
        waitForStart();

        while (opModeIsActive()) {
            if (useLimelight) {
                processlimelight();
            } else {
                processPhotonVision();
            }

            telemetry.update();
        }

        if (useLimelight && limelight != null) {
            limelight.stop();
        }
    }

    private void processlimelight() {
        LLResult result = limelight.getLatestResult();
        if (result != null && result.isValid()) {
            var fiducials = result.getFiducialResults();
            telemetry.addData("Vision Source", "Limelight");
            telemetry.addData("Targets", fiducials.size());
            // ... process Limelight data
        }
    }

    private void processPhotonVision() {
        PhotonPipelineResult result = photonCamera.getLatestResult();
        if (result.hasTargets()) {
            telemetry.addData("Vision Source", "PhotonVision");
            telemetry.addData("Targets", result.getTargets().size());
            // ... process PhotonVision data
        }
    }
}`;
}
