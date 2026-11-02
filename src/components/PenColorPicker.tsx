import React from 'react';
import { Check } from 'lucide-react';
import { PEN_COLORS } from '../lib/types';

interface PenColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  className?: string;
  compact?: boolean;
  showLabel?: boolean;
}

export default function PenColorPicker({
  value,
  onChange,
  className = '',
  compact = false,
  showLabel = false,
}: PenColorPickerProps) {
  const normalizedValue = (value || '').toLowerCase();
  const activePen = PEN_COLORS.find((p) => p.value.toLowerCase() === normalizedValue) || PEN_COLORS[0];

  return (
    <div className={`pen-color-picker ${compact ? 'is-compact' : ''} ${className}`}>
      <div className="pen-swatches" role="radiogroup" aria-label="Pen colours">
        {PEN_COLORS.map((pen) => {
          const isActive = pen.value.toLowerCase() === normalizedValue;
          return (
            <button
              key={pen.id}
              type="button"
              role="radio"
              aria-checked={isActive}
              aria-label={pen.label}
              title={pen.label}
              className={`pen-swatch pen-swatch-${pen.id} ${isActive ? 'is-active' : ''}`}
              style={{ backgroundColor: pen.value }}
              onClick={() => onChange(pen.value)}
            >
              {isActive && <Check size={compact ? 11 : 13} strokeWidth={3} className="pen-swatch-check" />}
            </button>
          );
        })}
      </div>
      {showLabel && (
        <span className="pen-active-label" aria-live="polite">
          {activePen.label}
        </span>
      )}
    </div>
  );
}
