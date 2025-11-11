'use client';

import { RobotConfig, DriveType } from '@/lib/types';
import { useState } from 'react';

interface RobotConfigFormProps {
  config: RobotConfig;
  onChange: (config: RobotConfig) => void;
}

export function RobotConfigForm({ config, onChange }: RobotConfigFormProps) {
  const [expanded, setExpanded] = useState(false);

  const updateConfig = (updates: Partial<RobotConfig>) => {
    onChange({ ...config, ...updates });
  };

  const updateToggles = (key: keyof RobotConfig['frameworkToggles'], value: boolean) => {
    onChange({
      ...config,
      frameworkToggles: {
        ...config.frameworkToggles,
        [key]: value,
      },
    });
  };

  return (
    <div className="space-y-4 bg-surface border border-border rounded-lg p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-text">Robot Configuration</h3>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-accent hover:text-accentHover"
        >
          {expanded ? 'Collapse' : 'Expand'}
        </button>
      </div>

      {expanded && (
        <div className="space-y-4">
          {/* Drive Configuration */}
          <div className="space-y-3">
            <h4 className="text-xs font-medium text-textMuted uppercase">Drive</h4>

            <div>
              <label className="text-xs text-textMuted">Drive Type</label>
              <select
                value={config.driveType}
                onChange={(e) => updateConfig({ driveType: e.target.value as DriveType })}
                className="w-full mt-1 px-3 py-2 bg-background border border-border rounded text-sm text-text focus:outline-none focus:border-accent"
              >
                <option value="mecanum">Mecanum</option>
                <option value="tank">Tank</option>
                <option value="omni">Omni</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-textMuted">Wheel Radius (in)</label>
                <input
                  type="number"
                  step="0.1"
                  value={config.wheelRadius}
                  onChange={(e) => updateConfig({ wheelRadius: parseFloat(e.target.value) })}
                  className="w-full mt-1 px-3 py-2 bg-background border border-border rounded text-sm text-text focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="text-xs text-textMuted">Track Width (in)</label>
                <input
                  type="number"
                  step="0.1"
                  value={config.trackWidth}
                  onChange={(e) => updateConfig({ trackWidth: parseFloat(e.target.value) })}
                  className="w-full mt-1 px-3 py-2 bg-background border border-border rounded text-sm text-text focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="text-xs text-textMuted">Gear Ratio</label>
                <input
                  type="number"
                  step="0.1"
                  value={config.gearRatio}
                  onChange={(e) => updateConfig({ gearRatio: parseFloat(e.target.value) })}
                  className="w-full mt-1 px-3 py-2 bg-background border border-border rounded text-sm text-text focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="text-xs text-textMuted">IMU Orientation</label>
                <select
                  value={config.imuOrientation}
                  onChange={(e) => updateConfig({ imuOrientation: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-background border border-border rounded text-sm text-text focus:outline-none focus:border-accent"
                >
                  <option value="REV_HUB_LOGO_UP">Logo Up</option>
                  <option value="REV_HUB_LOGO_DOWN">Logo Down</option>
                  <option value="REV_HUB_LOGO_FORWARD">Logo Forward</option>
                  <option value="REV_HUB_LOGO_BACKWARD">Logo Backward</option>
                  <option value="REV_HUB_LOGO_LEFT">Logo Left</option>
                  <option value="REV_HUB_LOGO_RIGHT">Logo Right</option>
                </select>
              </div>
            </div>
          </div>

          {/* Vision Configuration */}
          <div className="space-y-3">
            <h4 className="text-xs font-medium text-textMuted uppercase">Vision</h4>

            <div>
              <label className="text-xs text-textMuted">Camera Model</label>
              <input
                type="text"
                value={config.cameraModel}
                onChange={(e) => updateConfig({ cameraModel: e.target.value })}
                placeholder="e.g., Logitech C920"
                className="w-full mt-1 px-3 py-2 bg-background border border-border rounded text-sm text-text focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          {/* Framework Toggles */}
          <div className="space-y-3">
            <h4 className="text-xs font-medium text-textMuted uppercase">Frameworks</h4>

            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.frameworkToggles.roadrunner}
                  onChange={(e) => updateToggles('roadrunner', e.target.checked)}
                  className="w-4 h-4 accent-accent"
                />
                <span className="text-sm text-text">Road Runner</span>
                <span className="text-xs text-textMuted">(motion planning)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.frameworkToggles.ftclib}
                  onChange={(e) => updateToggles('ftclib', e.target.checked)}
                  className="w-4 h-4 accent-accent"
                />
                <span className="text-sm text-text">FTCLib</span>
                <span className="text-xs text-textMuted">(command-based)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.frameworkToggles.dashboard}
                  onChange={(e) => updateToggles('dashboard', e.target.checked)}
                  className="w-4 h-4 accent-accent"
                />
                <span className="text-sm text-text">FTC Dashboard</span>
                <span className="text-xs text-textMuted">(telemetry streaming)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.frameworkToggles.externalVision}
                  onChange={(e) => updateToggles('externalVision', e.target.checked)}
                  className="w-4 h-4 accent-accent"
                />
                <span className="text-sm text-text">External Vision</span>
                <span className="text-xs text-textMuted">(Limelight/PhotonVision)</span>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
