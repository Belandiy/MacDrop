import React, { useState } from 'react';
import { Palette, Maximize2, ChevronUp, ChevronDown } from 'lucide-react';
import { availableDesigns, DesignModule } from '../designs';

interface DevToolbarProps {
  currentDesignId: string;
  onSelectDesign: (designId: string) => void;
}

export const DevToolbar: React.FC<DevToolbarProps> = ({ currentDesignId, onSelectDesign }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const currentDesign = availableDesigns.find((d) => d.id === currentDesignId) || availableDesigns[0];

  const handleDesignChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextId = e.target.value;
    onSelectDesign(nextId);

    const nextDesign = availableDesigns.find((d) => d.id === nextId);
    if (nextDesign?.windowSize && window.macdrop?.resizeWindow) {
      window.macdrop.resizeWindow(nextDesign.windowSize.width, nextDesign.windowSize.height);
    }
  };

  const handleResize = () => {
    if (currentDesign?.windowSize && window.macdrop?.resizeWindow) {
      window.macdrop.resizeWindow(currentDesign.windowSize.width, currentDesign.windowSize.height);
    }
  };

  return (
    <div
      style={{ WebkitAppRegion: 'no-drag' } as any}
      className="bg-[#121318] border-b border-indigo-500/30 text-slate-300 text-xs px-3 py-1.5 flex items-center justify-between select-none z-50 shrink-0"
    >
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-1.5 text-indigo-400 font-semibold text-[11px]">
          <Palette className="w-3.5 h-3.5" />
          <span>Тест дизайнов:</span>
        </div>

        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <select
              value={currentDesignId}
              onChange={handleDesignChange}
              className="bg-[#1b1e2a] hover:bg-[#222738] text-white text-[11px] font-medium px-2 py-0.5 rounded border border-indigo-500/40 focus:outline-none focus:ring-1 focus:ring-indigo-400 cursor-pointer transition-colors"
            >
              {availableDesigns.map((design) => (
                <option key={design.id} value={design.id}>
                  {design.name} ({design.id})
                </option>
              ))}
            </select>

            {currentDesign?.windowSize && (
              <button
                onClick={handleResize}
                title="Установить рекомендуемый размер окна"
                className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/[0.06] hover:bg-white/[0.12] text-slate-300 text-[10px] font-mono border border-white/10 transition-colors"
              >
                <Maximize2 className="w-2.5 h-2.5 text-indigo-400" />
                <span>
                  {currentDesign.windowSize.width}×{currentDesign.windowSize.height}
                </span>
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[10px] text-slate-500 font-mono">
          {availableDesigns.length} вариант(а) в /designs
        </span>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? 'Развернуть панель тестов' : 'Свернуть'}
          className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors"
        >
          {isCollapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
        </button>
      </div>
    </div>
  );
};
