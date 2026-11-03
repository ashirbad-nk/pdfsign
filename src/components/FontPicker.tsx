import { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { FONTS, FONT_BY_ID, cssFont } from '../lib/fonts';
import type { FontId } from '../lib/types';

interface FontPickerProps {
  value: FontId;
  onChange: (fontId: FontId) => void;
}

export default function FontPicker({ value, onChange }: FontPickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentFont = FONT_BY_ID[value] || FONTS[0];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const handwritingFonts = FONTS.filter((f) => f.category === 'handwriting');
  const standardFonts = FONTS.filter((f) => f.category === 'standard');

  return (
    <div className="font-picker" ref={containerRef}>
      <button
        type="button"
        className={`font-picker-trigger ${open ? 'open' : ''}`}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Choose font family"
      >
        <div className="font-picker-trigger-content">
          <span
            className="font-picker-current-name"
            style={{ fontFamily: cssFont(currentFont.id) }}
          >
            {currentFont.name}
          </span>
          <span className="font-picker-current-desc">{currentFont.description}</span>
        </div>
        <ChevronDown size={16} className={`font-picker-chevron ${open ? 'rotated' : ''}`} />
      </button>

      {open && (
        <div className="font-picker-dropdown" role="listbox">
          <div className="font-picker-group">
            <div className="font-picker-group-title">✍️ Fine Handwriting (No bold)</div>
            {handwritingFonts.map((font) => {
              const isSelected = font.id === value;
              return (
                <button
                  key={font.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`font-picker-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => {
                    onChange(font.id);
                    setOpen(false);
                  }}
                >
                  <div className="font-picker-item-info">
                    <span
                      className="font-picker-sample handwriting-sample"
                      style={{ fontFamily: cssFont(font.id) }}
                    >
                      {font.name}
                    </span>
                    <span className="font-picker-item-desc">{font.description}</span>
                  </div>
                  {isSelected && <Check size={16} className="font-picker-check" />}
                </button>
              );
            })}
          </div>

          <div className="font-picker-group">
            <div className="font-picker-group-title">📄 Standard Document Print</div>
            {standardFonts.map((font) => {
              const isSelected = font.id === value;
              return (
                <button
                  key={font.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`font-picker-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => {
                    onChange(font.id);
                    setOpen(false);
                  }}
                >
                  <div className="font-picker-item-info">
                    <span
                      className="font-picker-sample standard-sample"
                      style={{ fontFamily: cssFont(font.id) }}
                    >
                      {font.name}
                    </span>
                    <span className="font-picker-item-desc">{font.description}</span>
                  </div>
                  {isSelected && <Check size={16} className="font-picker-check" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
