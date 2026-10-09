import { useRef } from 'react';
import { AppIcon } from '@/components/AppIcon';
import { useTheme } from '@/theme/themeContext';
export function ThemeColorPicker() {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const { themeColor, setThemeColor, presets } = useTheme();
  const activePreset = presets.find((preset) => preset.id === themeColor) ?? presets[0];
  return (
    <details ref={detailsRef} className="relative">
      <summary
        aria-label="Cambiar color del tema"
        className="grid size-8 cursor-pointer list-none place-items-center rounded-md border border-slate-200 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
        title="Tema"
      >
        <AppIcon className="size-4" name="palette" />
      </summary>
      <div className="absolute right-0 top-10 z-[70] w-40 rounded-md border border-slate-200 bg-white p-2 text-slate-700 shadow-xl">
        <div className="grid grid-cols-4 gap-1.5">
          {presets.map((preset) => {
            const isActive = preset.id === themeColor;
            return (
              <button
                key={preset.id}
                type="button"
                aria-label={`Usar tema ${preset.label}`}
                title={preset.label}
                className={`grid size-7 place-items-center rounded-md border transition ${
                  isActive ? 'border-slate-500 bg-slate-50' : 'border-slate-200 hover:bg-slate-50'
                }`}
                onClick={() => {
                  setThemeColor(preset.id);
                  detailsRef.current?.removeAttribute('open');
                }}
              >
                <span
                  aria-hidden="true"
                  className="size-4 rounded-full border border-black/10"
                  style={{ backgroundColor: preset.primary }}
                />
              </button>
            );
          })}
        </div>
        {activePreset ? <p className="mt-1.5 truncate text-center text-[10px] text-slate-500">{activePreset.label}</p> : null}
      </div>
    </details>
  );
}
