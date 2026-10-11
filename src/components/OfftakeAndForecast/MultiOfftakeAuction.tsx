import React, { useState } from 'react';
import { useAppLanguage } from '../../i18n/LanguageContext';
import { Buyer, BuyerType } from '../../types';
import { INITIAL_BUYERS } from '../../data/mockData';
import { 
  TrendingUp, 
  Sparkles, 
  ArrowRight, 
  Droplet, 
  Factory, 
  Flame, 
  CircleDollarSign,
  Layers,
  Scale
} from 'lucide-react';

interface MultiOfftakeAuctionProps {
  buyers: Buyer[];
  demoMode: boolean;
}

export const MultiOfftakeAuction: React.FC<MultiOfftakeAuctionProps> = ({ buyers: liveBuyers, demoMode }) => {
  const { t } = useAppLanguage();
  const buyers = demoMode ? INITIAL_BUYERS : liveBuyers;
  const [testMoisture, setTestMoisture] = useState<number>(14.0);
  const [testSilica, setTestSilica] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('LOW');
  const [lotTonnage, setLotTonnage] = useState<number>(12); // e.g. 5 acres @ 2.4 t/ac

  // Live buyer_demands do not currently contain validated prices or quality thresholds.
  // Never run the illustrative optimizer against zero-filled fields or present a demand as an offer.
  if (!demoMode) {
    return (
      <section className="ui-stack" aria-labelledby="live-offtake-title">
        <div className="ui-card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 id="live-offtake-title" className="text-xl font-bold text-[var(--ink)]">{t('Connected buyer demand')}</h3>
              <p className="ui-card-sub mt-1">{t('These records come from the connected buyer-demand table. They are demand requests, not verified buyers, price quotes, accepted offers or contracts.')}</p>
            </div>
            <span className="badge">{t('LIVE RECORDS')}</span>
          </div>
        </div>
        {liveBuyers.length === 0 ? (
          <div className="ui-card" role="status">
            <h4 className="font-semibold text-[var(--ink)]">{t('No buyer demand records available')}</h4>
            <p className="ui-card-sub mt-1">{t('No connected buyer-demand records were returned for this account. No sample buyers or prices are shown in live mode.')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {liveBuyers.map((buyer) => (
              <article key={buyer.id} className="ui-card">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-[var(--ink)]">{buyer.name}</h4>
                    <p className="text-xs text-[var(--muted)]">{t('Demand record')} · {buyer.id}</p>
                  </div>
                  <span className="badge">{t('Demand only')}</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div>
                    <span className="ui-kv-label block">{t('Target quantity')}</span>
                    <strong className="text-lg text-[var(--ink)]">{Number.isFinite(buyer.demand_tonnes) ? buyer.demand_tonnes.toLocaleString() : '—'} t</strong>
                  </div>
                  <div>
                    <span className="ui-kv-label block">{t('Price')}</span>
                    <strong className="text-lg text-[var(--ink)]">{t('Not supplied')}</strong>
                  </div>
                </div>
                <p className="mt-3 text-sm text-[var(--muted)]">{buyer.description}</p>
              </article>
            ))}
          </div>
        )}
        <p className="text-xs text-[var(--muted)]">{t('Live price comparison is disabled until buyer identity, quote validity, price, quality limits and pickup terms are persisted and validated. No contract or sale is created here.')}</p>
      </section>
    );
  }

  // Auction router logic: finds the highest-paying eligible buyer based on moisture and silica constraints
  const eligibleBuyers = buyers.filter((buyer) => {
    if (testMoisture > buyer.moisture_ceiling) return false;
    if (testSilica === 'HIGH' && buyer.type === 'MUSHROOM') return false;
    return true;
  });

  const topBuyer = eligibleBuyers.sort((a, b) => b.price_per_tonne - a.price_per_tonne)[0] || buyers[buyers.length - 1];
  const cbgBaseline = buyers.find((b) => b.type === 'CBG')!;
  const premiumOverBiogas = topBuyer.price_per_tonne - cbgBaseline.price_per_tonne;

  return (
    <div className="ui-stack">
      {/* Top Framing Card */}
      <div className="ui-card relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--wheat-soft)] text-[var(--wheat-ink)]">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-[family-name:var(--font-display)] text-[24px] font-bold leading-tight text-[var(--ink)]">
                  {t('Multi-offtake planning simulator')}
                </h3>
                <span className="badge badge-emerald text-xs">
                  {t('ILLUSTRATIVE SCENARIO')}
                </span>
              </div>
              <p className="ui-card-sub max-w-2xl !text-[14px]">
                {t('This simulator demonstrates how residue lots could be compared against buyer requirements using moisture, quality and logistics. Prices below are mock records; no live offer or contract is created.')}
              </p>
            </div>
          </div>
        </div>

        {/* Real Industry Circular Economy Facility Visual */}
        <div className="mt-4 rounded-xl overflow-hidden border border-emerald-900/10 relative max-h-52 bg-white">
          <img 
            src="/images/offtake_facility.jpg" 
            alt="Punjab CBG Plant & Gourmet Mushroom Cultivation from Paddy Straw"
            className="w-full h-48 object-cover object-center"
           loading="lazy" decoding="async" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
          <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                PUNJAB AGRO-PROCESSING CIRCULAR ECONOMY
              </span>
              <p className="text-xs font-bold text-emerald-950 mt-1">
                Lehragaga CBG (Verbio) + Patiala Gourmet Mushroom Substrate Cluster
              </p>
            </div>
            <div className="text-right hidden sm:block">
              <span className="text-xs font-mono text-emerald-800 font-bold block">{t('Illustrative price spread')}</span>
              <span className="text-[10px] text-emerald-950/55">{t('Demo comparison only')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive quality-matching simulator */}
      <div className="glass-panel p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-emerald-900/10 pb-3">
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-amber-700" />
            <h4 className="font-bold text-base text-emerald-950">
              {t('Interactive Lot Offtake Router')}
            </h4>
          </div>
          <span className="text-xs text-emerald-950/55">
            {t('Demo quality-matching simulator')}
          </span>
        </div>

        {/* Quality Input Parameters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-emerald-50/60 p-4 rounded-xl border border-emerald-900/10">
          <div>
            <label className="text-xs text-emerald-950/55 block mb-1">
              {t('Straw Moisture Level:')} <strong className="text-emerald-800 font-mono">{testMoisture}%</strong>
            </label>
            <input
              type="range"
              min="11"
              max="24"
              step="0.5"
              value={testMoisture}
              onChange={(e) => setTestMoisture(Number(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-emerald-950/45 mt-0.5">
              <span>Dry (&lt;15%)</span>
              <span>Standard (18%)</span>
              <span>Damp (&gt;20%)</span>
            </div>
          </div>

          <div>
            <label className="text-xs text-emerald-950/55 block mb-1">
              Silica Fraction: <strong className="text-amber-800 font-mono">{testSilica} SILICA</strong>
            </label>
            <div className="flex gap-1.5 mt-1">
              {(['LOW', 'MEDIUM', 'HIGH'] as const).map((tier) => (
                <button
                  key={tier}
                  onClick={() => setTestSilica(tier)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    testSilica === tier
                      ? 'bg-amber-400 text-emerald-950'
                      : 'bg-slate-100 text-emerald-950/55 hover:text-emerald-950'
                  }`}
                >
                  {tier}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-emerald-950/55 block mb-1">
              Harvest Lot Size: <strong className="text-emerald-800 font-mono">{lotTonnage} Tonnes</strong>
            </label>
            <input
              type="range"
              min="4"
              max="50"
              step="2"
              value={lotTonnage}
              onChange={(e) => setLotTonnage(Number(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <div className="text-[10px] text-emerald-950/45 mt-0.5 text-right">
              Approx. {Math.round(lotTonnage / 2.3)} Acres equivalent
            </div>
          </div>
        </div>

        {/* Optimal Match Outcome Banner */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-50 via-white to-amber-50/60 border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <span className="badge badge-emerald text-[10px] mb-1">
              Scenario recommendation
            </span>
            <div className="text-lg font-black text-emerald-950 flex items-center gap-2">
              <span>Possible pathway: {topBuyer.name}</span>
            </div>
            <p className="text-xs text-emerald-950/65 mt-0.5">
              {topBuyer.description}
            </p>
          </div>

          <div className="flex items-center gap-4 bg-white/80 px-4 py-2.5 rounded-xl border border-emerald-900/10 shrink-0">
            <div>
              <span className="text-[10px] text-emerald-950/55 uppercase font-bold block">Illustrative price</span>
              <div className="text-xl font-extrabold text-emerald-800 font-mono">
                ₹{topBuyer.price_per_tonne.toLocaleString()} / t
              </div>
            </div>
            <div className="border-l border-emerald-900/10 pl-3">
              <span className="text-[10px] text-emerald-950/55 uppercase font-bold block">Illustrative lot value</span>
              <div className="text-xl font-extrabold text-emerald-950 font-mono">
                ₹{(topBuyer.price_per_tonne * lotTonnage).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Multi-Offtake Buyer Comparison Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {buyers.map((buyer) => {
          const isOptimal = buyer.id === topBuyer.id;
          const isEligible = eligibleBuyers.some((b) => b.id === buyer.id);
          const diffVsBiogas = buyer.price_per_tonne - 1850;

          return (
            <div
              key={buyer.id}
              className={`p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                isOptimal
                  ? 'bg-white border-emerald-500 ring-2 ring-emerald-500/40 shadow-xl'
                  : isEligible
                  ? 'bg-white border-emerald-900/10'
                  : 'bg-white/60 border-slate-900 opacity-50'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-xl">
                    {buyer.type === 'MUSHROOM' && '🍄'}
                    {buyer.type === 'PACKAGING' && '📦'}
                    {buyer.type === 'BIOCHAR' && '🌱'}
                    {buyer.type === 'FODDER' && '🐄'}
                    {buyer.type === 'CBG' && '⚡'}
                  </span>
                  <span
                    className={`badge text-[10px] ${
                      buyer.margin_tier === 'ULTRA_HIGH'
                        ? 'badge-emerald'
                        : buyer.margin_tier === 'HIGH'
                        ? 'badge-cyan'
                        : buyer.margin_tier === 'MEDIUM'
                        ? 'badge-amber'
                        : 'badge-crimson'
                    }`}
                  >
                    {buyer.margin_tier.replace('_', ' ')}
                  </span>
                </div>

                <h5 className="font-bold text-sm text-emerald-950">{buyer.name}</h5>
                <p className="text-[11px] text-emerald-950/55 mt-0.5">{buyer.location_name}</p>

                <p className="text-xs text-emerald-950/65 mt-2 leading-relaxed">
                  {buyer.description}
                </p>
              </div>

              <div className="pt-3 border-t border-emerald-900/10/80 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] text-emerald-950/55 block">Rate / Tonne</span>
                  <span className="text-base font-extrabold text-emerald-950 font-mono">
                    ₹{buyer.price_per_tonne.toLocaleString()}
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-emerald-950/55 block">Vs CBG Baseline</span>
                  <span
                    className={`font-mono font-bold ${
                      diffVsBiogas > 0 ? 'text-emerald-800' : 'text-emerald-950/45'
                    }`}
                  >
                    {diffVsBiogas > 0 ? `+₹${diffVsBiogas.toLocaleString()}` : 'Baseline'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
