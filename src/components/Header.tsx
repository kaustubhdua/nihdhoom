import { useEffect, useRef, useState, startTransition } from 'react';
import { prefetchWorkspace } from '../lib/workspacePrefetch';
import { farmerLanguageLabels } from '../i18n/farmerLabels';
import { useAppLanguage } from '../i18n/LanguageContext';
import {
  Activity, BarChart3, ChevronDown, ClipboardList, Leaf, Map,
  Menu, MessageSquare, ShieldCheck, Smartphone, TrendingUp, UserCheck, Wheat,
  X, Tractor
} from 'lucide-react';

export type ActiveTab =
  | 'OVERVIEW' | 'RESIDUE_POOLS' | 'IMPACT_RESEARCH' | 'HARVEST_INTELLIGENCE'
  | 'FIELD_PROVENANCE' | 'FIELD_JOBS' | 'OPS_CONSOLE' | 'FARMER_SURFACE'
  | 'BALER_OPERATOR' | 'SATELLITE_AUDIT' | 'OFFTAKE_AUCTION'
  | 'FARMER_ONBOARDING' | 'FARMER_KYC';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  demoMode: boolean;
}

type NavItem = {
  id: ActiveTab;
  label: string;
  short?: string;
  icon: typeof Activity;
  description: string;
};

const primaryNav: NavItem[] = [
  { id: 'OVERVIEW', label: 'Home', short: 'Home', icon: Activity, description: 'Farmer-first overview and today\'s activity' },
  { id: 'FIELD_JOBS', label: 'My Fields', short: 'Fields', icon: ClipboardList, description: 'Fields, bookings and clearance jobs' },
  { id: 'FARMER_ONBOARDING', label: 'Book Parali Pickup', short: 'Book', icon: Tractor, description: 'Choose your field and book machine pickup' },
  { id: 'OPS_CONSOLE', label: 'Track My Machine', short: 'Track', icon: Map, description: 'See where the machine is and what happens next' },
  { id: 'RESIDUE_POOLS', label: 'Parali Market', short: 'Market', icon: Leaf, description: 'See where collected parali can go' },
];

const secondaryNav: NavItem[] = [
  { id: 'HARVEST_INTELLIGENCE', label: 'Harvest Timing', icon: Wheat, description: 'Know when to prepare for harvest and pickup' },
  { id: 'FIELD_PROVENANCE', label: 'Field Details', icon: ShieldCheck, description: 'Field boundary, consent and history' },
  { id: 'SATELLITE_AUDIT', label: 'Check My Proof', icon: ShieldCheck, description: 'Photos, field proof and verification' },
  { id: 'IMPACT_RESEARCH', label: 'Why It Matters', icon: BarChart3, description: 'Evidence and context for crop-residue management' },
  { id: 'BALER_OPERATOR', label: 'Machine Worker', icon: Smartphone, description: 'Tools for the person driving the machine' },
  { id: 'FARMER_SURFACE', label: 'Telegram Help', icon: MessageSquare, description: 'Get updates and help on Telegram' },
  { id: 'FARMER_KYC', label: 'My Profile', icon: UserCheck, description: 'Phone verification and farmer consent' },
  { id: 'OFFTAKE_AUCTION', label: 'Buyers', icon: TrendingUp, description: 'See buyer needs for collected parali' },

];

export function Header({ activeTab, setActiveTab, demoMode }: HeaderProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const { language: farmerLanguage, setLanguage, t } = useAppLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setMoreOpen(false); setMobileOpen(false); }
    };
    const onPointer = (event: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(event.target as Node)) setMoreOpen(false);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
    };
  }, []);

  const navigate = (id: ActiveTab) => {
    startTransition(() => setActiveTab(id));
    setMoreOpen(false);
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const activeSecondary = secondaryNav.some((item) => item.id === activeTab);
  const farmerLabels = farmerLanguageLabels[farmerLanguage];


  return (
    <>
      <header className="nirdhoom-field-header sticky top-0 z-50 backdrop-blur-xl">
      <div className="mx-auto max-w-[1480px]">
        <div className="flex min-h-[68px] items-center gap-3">
          <button
            onClick={() => navigate('OVERVIEW')} onMouseEnter={() => prefetchWorkspace('OVERVIEW')}
            className="group flex min-w-0 shrink-0 items-center gap-3 rounded-xl py-1.5 text-left"
            aria-label="Go to NIRDHOOM Home"
          >
            <span className="brand-mark" aria-hidden="true">नि</span>
            <span className="hidden min-w-0 sm:block">
              <span className="flex items-center gap-2">
                <span className="brand-name">NIRDHOOM</span>
                <span className="brand-chip">
                  {t('Field network')}
                </span>
              </span>
              <span className="brand-tag">{t('Crop-residue field network')}</span>
            </span>
          </button>

          <div className="hidden h-7 w-px bg-[var(--line)] xl:block" />

          <nav className="hidden min-w-0 flex-1 items-center gap-0.5 lg:flex" aria-label="Primary navigation">
            {primaryNav.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button key={item.id} onClick={() => navigate(item.id)} onMouseEnter={() => prefetchWorkspace(item.id)} onFocus={() => prefetchWorkspace(item.id)} title={t(item.description)}
                  className={`field-nav-item ${active ? 'is-active' : ''}`}>
                  <Icon className="h-4 w-4" />
                  <span>{item.id === 'OVERVIEW' ? farmerLabels.home : item.id === 'FIELD_JOBS' ? farmerLabels.fields : item.id === 'FARMER_ONBOARDING' ? farmerLabels.book : item.id === 'OPS_CONSOLE' ? farmerLabels.track : item.id === 'RESIDUE_POOLS' ? farmerLabels.market : t(item.label)}</span>
                </button>
              );
            })}

            <div className="relative ml-auto" ref={moreRef}>
              <button onClick={() => setMoreOpen((value) => !value)} aria-expanded={moreOpen} aria-haspopup="menu"
                className={`field-more-button ${activeSecondary ? 'is-active' : ''}`}>
                <Menu className="h-4 w-4" /> {farmerLabels.more} <ChevronDown className={`h-3.5 w-3.5 transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
              </button>
              {moreOpen && (
                <>
                  <button
                    type="button"
                    aria-label="Close More menu"
                    className="field-more-backdrop"
                    onClick={() => setMoreOpen(false)}
                  />
                  <div className="field-more-menu" role="menu" aria-label="More navigation">
                    <div className="flex items-start justify-between gap-4 px-4 pb-3 pt-1">
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--brand)]">{t('Explore NIRDHOOM')}</div>
                        <div className="mt-1 text-[13px] text-[var(--muted)]">{t('Machines, proof, buyers and account tools.')}</div>
                      </div>
                      <button
                        type="button"
                        aria-label="Close More menu"
                        onClick={() => setMoreOpen(false)}
                        className="field-more-close"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                    {secondaryNav.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button key={item.id} role="menuitem" onClick={() => navigate(item.id)} onMouseEnter={() => prefetchWorkspace(item.id)} onFocus={() => prefetchWorkspace(item.id)}
                          className={`field-more-item ${activeTab === item.id ? 'is-active' : ''}`}>
                          <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                          <span className="min-w-0"><span className="block truncate text-[13px] font-semibold">{t(item.label)}</span><span className="mt-0.5 block text-[11.5px] leading-snug text-[var(--muted)]">{t(item.description)}</span></span>
                        </button>
                      );
                    })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <div className="header-status hidden 2xl:inline-flex">
              <span className={`header-status-dot ${demoMode ? 'is-sample' : ''}`} />
              <span>{demoMode ? t('Sample records') : t('Connected records')}</span>
            </div>
            <button
              type="button"
              onClick={() => setLanguage(farmerLanguage === 'en' ? 'hi' : 'en')}
              className="lang-toggle hidden lg:inline-flex"
              aria-label={farmerLabels.language}
              title={farmerLabels.language}
            >
              <span className={farmerLanguage === 'en' ? 'is-on' : ''}>EN</span>
              <span className="sr-only">/</span>
              <span className={farmerLanguage === 'hi' ? 'is-on' : ''}>हिंदी</span>
            </button>
            <button
              type="button"
              onClick={() => setLanguage(farmerLanguage === 'en' ? 'hi' : 'en')}
              className="icon-button lg:hidden"
              aria-label={farmerLabels.language}
            >
              {farmerLanguage === 'en' ? 'हिंदी' : 'EN'}
            </button>
            <button onClick={() => setMobileOpen((value) => !value)} className="field-menu-button icon-button lg:hidden" aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={mobileOpen}>
              {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>



        {mobileOpen && (
          <div className="field-mobile-panel lg:hidden">
            <div className="mb-3 px-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--brand)]">All NIRDHOOM surfaces</div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {secondaryNav.map((item) => {
                const Icon = item.icon;
                return <button key={item.id} onClick={() => navigate(item.id)} className={`field-mobile-item ${activeTab === item.id ? 'is-active' : ''}`}><Icon className="h-4 w-4" />{item.label}</button>;
              })}
            </div>
          </div>
        )}
      </div>
      </header>

      <nav className="field-mobile-bottom-nav lg:hidden" aria-label="Farmer quick navigation">
      {[
        ['OVERVIEW', farmerLabels.home, Activity],
        ['FIELD_JOBS', farmerLabels.fields, ClipboardList],
        ['FARMER_ONBOARDING', farmerLabels.book, Tractor],
        ['OPS_CONSOLE', farmerLabels.track, Map],
        ['RESIDUE_POOLS', farmerLabels.market, Leaf],
      ].map(([id, label, Icon]) => {
        const NavIcon = Icon as typeof Activity;
        return (
          <button
            key={String(id)}
            type="button"
            onClick={() => navigate(id as ActiveTab)}
            className={activeTab === id ? 'is-active' : ''}
            aria-current={activeTab === id ? 'page' : undefined}
          >
            <NavIcon className="h-4 w-4" />
            <span>{String(label)}</span>
          </button>
        );
      })}
      </nav>
    </>
  );
}
