import React, { useState } from 'react';
import { 
  Calendar, 
  Sparkles, 
  MapPin, 
  TrendingUp, 
  Truck, 
  Layers, 
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

interface BlockForecast {
  name: string;
  pr126Acres: number;
  pusa44Acres: number;
  basmatiAcres: number;
  totalAcres: number;
  peakWindow: string;
  recommendedBalerCount: number;
}

const BLOCK_DATA: BlockForecast[] = [
  {
    name: 'Sangrur Central',
    pr126Acres: 14200,
    pusa44Acres: 28500,
    basmatiAcres: 9400,
    totalAcres: 52100,
    peakWindow: 'Oct 22 - Nov 02',
    recommendedBalerCount: 42,
  },
  {
    name: 'Sunam',
    pr126Acres: 9800,
    pusa44Acres: 34100,
    basmatiAcres: 6200,
    totalAcres: 50100,
    peakWindow: 'Oct 26 - Nov 06',
    recommendedBalerCount: 48,
  },
  {
    name: 'Dhuri',
    pr126Acres: 18400,
    pusa44Acres: 16200,
    basmatiAcres: 12500,
    totalAcres: 47100,
    peakWindow: 'Oct 10 - Oct 24',
    recommendedBalerCount: 36,
  },
  {
    name: 'Bhawanigarh',
    pr126Acres: 12100,
    pusa44Acres: 21300,
    basmatiAcres: 7800,
    totalAcres: 41200,
    peakWindow: 'Oct 18 - Oct 30',
    recommendedBalerCount: 32,
  },
  {
    name: 'Dirba / Lehragaga',
    pr126Acres: 8500,
    pusa44Acres: 36800,
    basmatiAcres: 5400,
    totalAcres: 50700,
    peakWindow: 'Oct 28 - Nov 08',
    recommendedBalerCount: 52,
  },
];

export const HarvestForecast: React.FC = () => {
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(14); // Mid-October
  const [selectedBlock, setSelectedBlock] = useState<string>('Sangrur Central');

  const currentBlock = BLOCK_DATA.find((b) => b.name === selectedBlock) || BLOCK_DATA[0];

  // Simulated day of month (October 5 to November 15)
  const currentDate = new Date(2026, 9, 5 + selectedDayIndex);
  const formattedDate = currentDate.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="ui-stack">
      {/* Top Banner */}
      <div className="ui-card relative overflow-hidden">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--wheat-soft)] text-[var(--wheat-ink)]">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-[family-name:var(--font-display)] text-[24px] font-bold leading-tight text-[var(--ink)]">
                Harvest pressure planning — illustrative
              </h3>
              <span className="badge badge-emerald text-xs">
                Planning model • provider data required
              </span>
            </div>
            <p className="ui-card-sub max-w-2xl !text-[14px]">
              This workspace demonstrates how harvest timing could inform machine pre-positioning. The figures below are illustrative planning records unless a configured harvest-data provider supplies them.
            </p>
          </div>
        </div>
      </div>

      {/* Date Timeline Slider & Pre-positioning Engine */}
      <div className="ui-card flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-emerald-900/10 pb-3">
          <div>
            <span className="text-xs text-emerald-950/55 block">Harvest Horizon Slider:</span>
            <div className="text-xl font-black text-emerald-950 font-semibold">{formattedDate}</div>
          </div>

          <div className="bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-900/10 text-xs">
            <span className="text-emerald-950/55">Paddy Maturity Curve: </span>
            <span className="font-bold text-emerald-800">
              {selectedDayIndex < 12 ? 'PR-126 Early Wave' : selectedDayIndex < 24 ? 'Peak Pusa-44 Influx' : 'Late Harvest Tail'}
            </span>
          </div>
        </div>

        <div>
          <input
            type="range"
            min="0"
            max="35"
            value={selectedDayIndex}
            onChange={(e) => setSelectedDayIndex(Number(e.target.value))}
            className="w-full accent-emerald-500 cursor-pointer"
          />
          <div className="flex justify-between text-[11px] text-emerald-950/55 mt-1">
            <span>Oct 05 (PR-126 Start)</span>
            <span>Oct 20 (Early Transition)</span>
            <span>Oct 28 (Pusa-44 Peak Spike)</span>
            <span>Nov 10 (Wheat Sowing Deadline)</span>
          </div>
        </div>

        {/* Research context and planning assumptionsograph */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mt-1">
          <div className="md:col-span-8 p-3.5 rounded-xl bg-emerald-50/60 border border-cyan-500/30 flex items-start gap-3 text-xs">
            <Truck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-emerald-950 text-sm">
                Automated Fleet Pre-Positioning Advisory ({formattedDate})
              </div>
              <p className="text-emerald-950/65 mt-0.5 leading-relaxed">
                In this illustrative scenario, <strong>{currentBlock.name}</strong> is assigned a planning volume of{' '}
                <strong className="text-emerald-800">
                  {Math.round(currentBlock.totalAcres * (selectedDayIndex < 15 ? 0.04 : 0.08))} acres/day
                </strong>{' '}
                over the next 72 hours. The model suggests reviewing capacity for up to{' '}
                <strong className="text-emerald-800">{currentBlock.recommendedBalerCount} balers</strong>, but this is a static scenario—not a live NDVI signal, measured harvest forecast, or verified machine recommendation.
              </p>
            </div>
          </div>

          <div className="md:col-span-4 rounded-xl overflow-hidden border border-amber-500/30 relative bg-white min-h-[90px]">
            <img 
              src="/images/punjab_farm_hero.jpg" 
              alt="PAU PR-126 Golden Harvest" 
              className="w-full h-full object-cover object-center max-h-24"
             loading="lazy" decoding="async" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
            <div className="absolute bottom-1.5 left-2.5 right-2.5 flex items-center justify-between text-[10px] font-mono">
              <span className="text-amber-800 font-bold">PAU LUDHIANA ADVISORY</span>
              <span className="text-emerald-800 font-semibold">PR-126 ~93 Days</span>
            </div>
          </div>
        </div>
      </div>

      {/* Block Breakdown Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {BLOCK_DATA.map((block) => {
          const isSelected = block.name === selectedBlock;
          return (
            <div
              key={block.name}
              onClick={() => setSelectedBlock(block.name)}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-emerald-50/95 border-emerald-500 ring-1 ring-emerald-500 shadow-lg'
                  : 'bg-emerald-50/70 border-emerald-900/10 hover:border-slate-700'
              }`}
            >
              <div className="font-bold text-sm text-emerald-950">{block.name}</div>
              <div className="text-[11px] text-emerald-950/55 mt-0.5">Peak: {block.peakWindow}</div>

              <div className="mt-3 flex flex-col gap-1 text-xs">
                <div className="flex justify-between text-emerald-950/55">
                  <span>PR-126:</span>
                  <span className="font-mono text-emerald-800">{block.pr126Acres.toLocaleString()} ac</span>
                </div>
                <div className="flex justify-between text-emerald-950/55">
                  <span>Pusa-44:</span>
                  <span className="font-mono text-amber-700">{block.pusa44Acres.toLocaleString()} ac</span>
                </div>
                <div className="flex justify-between text-emerald-950/55">
                  <span>Basmati:</span>
                  <span className="font-mono text-emerald-800">{block.basmatiAcres.toLocaleString()} ac</span>
                </div>
              </div>

              <div className="pt-2 mt-2 border-t border-emerald-900/10 flex justify-between items-center text-xs">
                <span className="text-emerald-950/55">Total Crop:</span>
                <span className="font-mono font-bold text-emerald-950">{block.totalAcres.toLocaleString()} ac</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
