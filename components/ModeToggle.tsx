'use client';

import { Mode } from '@/lib/types';

interface ModeToggleProps {
  mode: Mode;
  onChange: (mode: Mode) => void;
}

export function ModeToggle({ mode, onChange }: ModeToggleProps) {
  const modes: { value: Mode; label: string; description: string }[] = [
    {
      value: 'full-generation',
      label: 'Full Generation',
      description: 'Generate complete, buildable FTC files',
    },
    {
      value: 'assist',
      label: 'Assist',
      description: 'Provide diffs for existing code',
    },
    {
      value: 'copilot',
      label: 'Co-Pilot',
      description: 'Plan first, generate on confirmation',
    },
  ];

  return (
    <div className="glass glass-border rounded-2xl p-5 space-y-4">
      <label className="text-sm font-medium text-text">Mode</label>
      <div className="grid grid-cols-3 gap-2">
        {modes.map((m) => (
          <button
            key={m.value}
            onClick={() => onChange(m.value)}
            className={`px-4 py-3 rounded-xl transition-all font-medium text-sm ${
              mode === m.value
                ? 'bg-accent text-white shadow-glow'
                : 'glass glass-border text-textMuted hover:glass-hover hover:text-text'
            }`}
            title={m.description}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-textDim">{modes.find((m) => m.value === mode)?.description}</p>
    </div>
  );
}
