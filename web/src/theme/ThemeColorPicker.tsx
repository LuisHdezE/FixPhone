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
        className="flex size-8 cursor-pointer list-none items-center justify-center rounded-md text-white/85 transition hover:bg-white/10 hover:text-white"
      >
        <AppIcon className="size-[18px]" name="palette" />
      </summary>
      <div className="absolute right-0 top-10 z-[70] w-56 rounded-md border border-slate-200 bg-white p-3 text-slate-700 shadow-xl">
        <p className="text-xs font-semibold text-slate-900">Color del tema</p>
        <p className="mt-0.5 text-[11px] leading-4 text-slate-500">El shell completo responde a estos tokens.</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {presets.map((preset) => {
            const isActive = preset.id === themeColor;
            return (
              <button
                key={preset.id}
                type="button"
                className={`flex flex-col items-center gap-1 rounded border px-1.5 py-2 text-[10px] font-medium transition ${
                  isActive ? 'border-slate-400 bg-slate-50 text-slate-900' : 'border-slate-200 hover:bg-slate-50'
                }`}
                onClick={() => {
                  setThemeColor(preset.id);
                  detailsRef.current?.removeAttribute('open');
                }}
              >
                <span
                  aria-hidden="true"
                  className="size-5 rounded-full border border-black/10"
                  style={{ backgroundColor: preset.primary }}
                />
                {preset.label}
              </button>
            );
          })}
        </div>
        {activePreset ? (
          <p className="mt-2 border-t border-slate-100 pt-2 text-[10px] text-slate-500">Activo: {activePreset.label}</p>
        ) : null}
      </div>
    </details>
  );
}
