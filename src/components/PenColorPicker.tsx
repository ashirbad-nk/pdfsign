import React, { useEffect, useRef, useState } from 'react';
import { Check, Palette } from 'lucide-react';
import { PEN_COLORS, COLOR_SHADE_GROUPS } from '../lib/types';

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
  const [paletteOpen, setPaletteOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const normalizedValue = (value || '').toLowerCase();
  const activeDefaultPen = PEN_COLORS.find((p) => p.value.toLowerCase() === normalizedValue);

  // Find label if picked from shades grid
  let activeLabel = activeDefaultPen?.label || '';
  if (!activeLabel) {
    for (const group of COLOR_SHADE_GROUPS) {
      const match = group.shades.find((s) => s.value.toLowerCase() === normalizedValue);
      if (match) {
        activeLabel = match.label;
        break;
      }
    }
  }
  if (!activeLabel) {
    activeLabel = 'Custom colour';
  }

  const isCustomColor = !activeDefaultPen && Boolean(value);

  // Close popover when clicking outside
  useEffect(() => {
    if (!paletteOpen) return;
    const onDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setPaletteOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [paletteOpen]);

  return (
    <div
      ref={containerRef}
      className={`pen-color-picker ${compact ? 'is-compact' : ''} ${className}`}
    >
      <div className="pen-swatches" role="radiogroup" aria-label="Pen colours">
        {/* Default 4 pens */}
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
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onChange(pen.value);
                setPaletteOpen(false);
              }}
            >
              {isActive && (
                <Check
                  size={compact ? 11 : 13}
                  strokeWidth={3}
                  className="pen-swatch-check"
                />
              )}
            </button>
          );
        })}

        {/* Palette selector button for additional shades */}
        <button
          type="button"
          aria-label="More colour shades"
          title={isCustomColor ? `Custom colour: ${activeLabel} (click to change)` : 'More colour shades'}
          className={`pen-swatch pen-palette-btn ${isCustomColor ? 'is-active is-custom' : ''} ${paletteOpen ? 'is-open' : ''}`}
          style={isCustomColor ? { backgroundColor: value } : undefined}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setPaletteOpen((open) => !open);
          }}
        >
          <Palette
            size={compact ? 12 : 14}
            strokeWidth={2.2}
            className={isCustomColor ? 'pen-palette-icon-custom' : ''}
          />
        </button>
      </div>

      {showLabel && (
        <span className="pen-active-label" aria-live="polite">
          {activeLabel}
        </span>
      )}

      {/* Clean grid of colors across different shades */}
      {paletteOpen && (
        <div
          className="pen-palette-popover"
          role="dialog"
          aria-label="Colour palette"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="pen-palette-header">
            <span className="pen-palette-title">Colour shades</span>
            <span className="pen-palette-selected-label">{activeLabel}</span>
          </div>

          <div className="pen-palette-grid">
            {COLOR_SHADE_GROUPS.map((group) => (
              <div key={group.name} className="pen-palette-col" title={group.name}>
                {group.shades.map((shade) => {
                  const isActive = shade.value.toLowerCase() === normalizedValue;
                  return (
                    <button
                      key={shade.value}
                      type="button"
                      className={`pen-grid-swatch ${isActive ? 'is-active' : ''}`}
                      style={{ backgroundColor: shade.value }}
                      title={`${group.name}: ${shade.label} (${shade.value})`}
                      aria-label={`${group.name}: ${shade.label}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        onChange(shade.value);
                        setPaletteOpen(false);
                      }}
                    >
                      {isActive && <Check size={11} strokeWidth={3.2} />}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
