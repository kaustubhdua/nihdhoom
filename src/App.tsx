import { describeLiveError } from './lib/liveStatus';
import { useAppLanguage } from './i18n/LanguageContext';
import { lazy, Suspense, useEffect, useCallback, startTransition } from 'react';
import { Header, ActiveTab } from './components/Header';
const OpsMap = lazy(() => import('./components/OpsConsole/OpsMap').then((m) => ({ default: m.OpsMap })));
const VRPDispatchPanel = lazy(() => import('./components/OpsConsole/VRPDispatchPanel').then((m) => ({ default: m.VRPDispatchPanel })));
const FieldDetailDrawer = lazy(() => import('./components/OpsConsole/FieldDetailDrawer').then((m) => ({ default: m.FieldDetailDrawer })));
const TelegramChannel = lazy(() => import('./components/FarmerSurface/TelegramChannel').then((m) => ({ default: m.TelegramChannel })));
const BalerPWA = lazy(() => import('./components/FieldOperator/BalerPWA').then((m) => ({ default: m.BalerPWA })));
const SatelliteAudit = lazy(() => import('./components/VerificationLayer/SatelliteAudit').then((m) => ({ default: m.SatelliteAudit })));
const CarbonCertificate = lazy(() => import('./components/VerificationLayer/CarbonCertificate').then((m) => ({ default: m.CarbonCertificate })));
const MultiOfftakeAuction = lazy(() => import('./components/OfftakeAndForecast/MultiOfftakeAuction').then((m) => ({ default: m.MultiOfftakeAuction })));
const HarvestForecast = lazy(() => import('./components/OfftakeAndForecast/HarvestForecast').then((m) => ({ default: m.HarvestForecast })));
const FarmerOnboarding = lazy(() => import('./components/FarmerOnboarding/FarmerOnboarding').then((m) => ({ default: m.FarmerOnboarding })));
import { CommandCenter } from './components/CommandCenter/CommandCenter';
const ResiduePooling = lazy(() => import('./components/ResiduePooling/ResiduePooling').then((m) => ({ default: m.ResiduePooling })));
const ImpactResearch = lazy(() => import('./components/ImpactResearch/ImpactResearch').then((m) => ({ default: m.ImpactResearch })));
const HarvestIntelligence = lazy(() => import('./components/HarvestIntelligence/HarvestIntelligence').then((m) => ({ default: m.HarvestIntelligence })));
const FieldProvenancePanel = lazy(() => import('./components/FieldProvenance/FieldProvenancePanel').then((m) => ({ default: m.FieldProvenancePanel })));
const FieldJobBoard = lazy(() => import('./components/FieldJobs/FieldJobBoard').then((m) => ({ default: m.FieldJobBoard })));
const FieldEvidenceTimeline = lazy(() => import('./components/ResidueNetwork/FieldEvidenceTimeline').then((m) => ({ default: m.FieldEvidenceTimeline })));
const ClearanceBooking = lazy(() => import('./components/ClearanceBooking/ClearanceBooking').then((m) => ({ default: m.ClearanceBooking })));
const ResidueControlTower = lazy(() => import('./components/ResidueNetwork/ResidueControlTower').then((m) => ({ default: m.ResidueControlTower })));
const DemoScenarioJourney = lazy(() => import('./components/DemoScenarioJourney/DemoScenarioJourney').then((m) => ({ default: m.DemoScenarioJourney })));


import { INITIAL_STORAGE_YARDS, INITIAL_BUYERS, INITIAL_RESIDUE_LOTS } from './data/mockData';
import { Field } from './types';
import { prefetchWorkspace } from './lib/workspacePrefetch';
import { WorkspaceLoading } from './components/WorkspaceLoading';
import { useAppController } from './state/useAppController';
import { generateNonBurnCertificate } from './utils/spatialVerification';
import { Map, ShieldCheck, Zap, UserCheck, Leaf } from 'lucide-react';

type WorkspaceHeaderProps = {
  activeTab: ActiveTab;
  demoMode: boolean;
  onNavigate: (tab: ActiveTab) => void;
};

const WORKSPACE_META: Partial<Record<ActiveTab, {
  eyebrow: string;
  title: string;
  description: string;
  image: string;
  accent: string;
  action?: { label: string; tab: ActiveTab };
}>> = {
  FIELD_JOBS: {
    eyebrow: 'FIELD OPERATIONS',
    title: 'My Fields & Clearance Jobs',
    description: 'See every registered field, its current state, evidence, machine assignment and next action in one readable workspace.',
    image: '/images/punjab_farmer_hero.jpg',
    accent: 'green',
    action: { label: 'Book a clearance', tab: 'FARMER_ONBOARDING' },
  },
  FARMER_ONBOARDING: {
    eyebrow: 'CLEARANCE',
    title: 'Book crop-residue clearance',
    description: 'Choose a field, confirm consent and request a clearance slot. Quotes and status are authoritative only when returned by the connected workflow.',
    image: '/images/farmer_phone.jpg',
    accent: 'amber',
    action: { label: 'View my fields', tab: 'FIELD_JOBS' },
  },
  FARMER_KYC: {
    eyebrow: 'FARMER ACCESS',
    title: 'Farmer onboarding',
    description: 'Set up your profile with phone OTP and consent before connecting field records or farmer communications.',
    image: '/images/farmer_manpreet.jpg',
    accent: 'green',
    action: { label: 'Open Telegram', tab: 'FARMER_SURFACE' },
  },
  OPS_CONSOLE: {
    eyebrow: 'LIVE OPERATIONS',
    title: 'Track clearance',
    description: 'Follow fields, machines, routes and operational evidence on the map. Live mode only shows records available from connected services.',
    image: '/images/baling_dispatch_fleet_1790447115856.jpg',
    accent: 'sky',
    action: { label: 'Open operator PWA', tab: 'BALER_OPERATOR' },
  },
  BALER_OPERATOR: {
    eyebrow: 'FIELD OPERATOR',
    title: 'Operator field workspace',
    description: 'Capture GPS, job progress and evidence from the field, including an offline queue when connectivity drops.',
    image: '/images/baler_machine.jpg',
    accent: 'sky',
    action: { label: 'Track machines', tab: 'OPS_CONSOLE' },
  },
  RESIDUE_POOLS: {
    eyebrow: 'RESIDUE MARKET',
    title: 'Pool verified residue for offtake',
    description: 'Group verified residue lots around real buyer demand, pickup constraints and quality requirements instead of showing speculative sales.',
    image: '/images/offtake_facility.jpg',
    accent: 'amber',
    action: { label: 'Explore buyer offtake', tab: 'OFFTAKE_AUCTION' },
  },
  SATELLITE_AUDIT: {
    eyebrow: 'FIELD TRUST',
    title: 'Evidence & verification',
    description: 'Review field evidence and remote-sensing observations as separate layers. Satellite observations support verification; they do not become proof by themselves.',
    image: '/images/satellite_firms.jpg',
    accent: 'sky',
    action: { label: 'Open field trust', tab: 'FIELD_PROVENANCE' },
  },
  IMPACT_RESEARCH: {
    eyebrow: 'IMPACT',
    title: 'Impact & research',
    description: 'Understand the evidence behind the residue problem, operational outcomes and methodology boundaries without mixing research statistics with live records.',
    image: '/images/parali_burning.jpg',
    accent: 'green',
    action: { label: 'Harvest intelligence', tab: 'HARVEST_INTELLIGENCE' },
  },
  HARVEST_INTELLIGENCE: {
    eyebrow: 'HARVEST INTELLIGENCE',
    title: 'Harvest pressure & timing',
    description: 'Turn harvest windows, field readiness and machine capacity into a clearer operational picture for the next few days.',
    image: '/images/punjab_farm_hero.jpg',
    accent: 'amber',
    action: { label: 'Open dispatch', tab: 'OPS_CONSOLE' },
  },
  FIELD_PROVENANCE: {
    eyebrow: 'FIELD TRUST',
    title: 'Field provenance',
    description: 'Trace the field record, boundary source, consent, evidence and verification state so every operational decision has a visible reason.',
    image: '/images/farmer_phone.jpg',
    accent: 'green',
    action: { label: 'Verify fields', tab: 'SATELLITE_AUDIT' },
  },
  FARMER_SURFACE: {
    eyebrow: 'FARMER CHANNEL',
    title: 'NIRDHOOM on Telegram',
    description: 'Connect a farmer account securely, use local-language messaging and move between booking, tracking and evidence without exposing secrets.',
    image: '/images/farmer_phone.jpg',
    accent: 'sky',
    action: { label: 'Book clearance', tab: 'FARMER_ONBOARDING' },
  },
  OFFTAKE_AUCTION: {
    eyebrow: 'BUYER NETWORK',
    title: 'Buyer offtake & demand',
    description: 'Compare conditional buyer requirements, residue quality and harvest forecasts. Nothing is presented as a confirmed contract until a real contract exists.',
    image: '/images/cbg_mushroom_offtake_1790447167269.jpg',
    accent: 'amber',
    action: { label: 'Open residue pools', tab: 'RESIDUE_POOLS' },
  },
};

function WorkspaceHeader({ activeTab, demoMode, onNavigate }: WorkspaceHeaderProps) {
  const meta = WORKSPACE_META[activeTab];
  if (!meta) return null;
  const accentClass = meta.accent === 'amber' ? 'is-amber' : meta.accent === 'sky' ? 'is-sky' : 'is-green';
  const journey = [
    { label: 'Field', tab: 'FIELD_JOBS' as ActiveTab },
    { label: 'Book', tab: 'FARMER_ONBOARDING' as ActiveTab },
    { label: 'Machine', tab: 'OPS_CONSOLE' as ActiveTab },
    { label: 'Proof', tab: 'SATELLITE_AUDIT' as ActiveTab },
    { label: 'Parali', tab: 'RESIDUE_POOLS' as ActiveTab },
  ];
  const activeJourney = journey.findIndex((item) => item.tab === activeTab);
  const journeyIndex = activeJourney >= 0 ? activeJourney : activeTab === 'BALER_OPERATOR' ? 2 : activeTab === 'FIELD_PROVENANCE' ? 0 : activeTab === 'OFFTAKE_AUCTION' ? 4 : 0;

  return (
    <section className={`workspace-hero ${accentClass}`} aria-labelledby="workspace-title">
      <div className="workspace-hero-copy">
        <div className="workspace-eyebrow">
          <span className="workspace-eyebrow-dot" />
          {meta.eyebrow}
          <span className="workspace-mode">{demoMode ? 'Demo records' : 'Live records'}</span>
        </div>
        <h1 id="workspace-title">{meta.title}</h1>
        <p>{meta.description}</p>
        {meta.action && (
          <button type="button" onClick={() => onNavigate(meta.action!.tab)} onMouseEnter={() => prefetchWorkspace(meta.action!.tab)} onFocus={() => prefetchWorkspace(meta.action!.tab)} className="workspace-action">
            {meta.action.label} <span aria-hidden="true">→</span>
          </button>
        )}

        <div className="workspace-journey" aria-label="NIRDHOOM journey">
          {journey.map((item, index) => (
            <button
              key={item.label}
              type="button"
              className={`workspace-journey-step ${index === journeyIndex ? 'is-current' : ''} ${index < journeyIndex ? 'is-done' : ''}`}
              onClick={() => onNavigate(item.tab)}
              onMouseEnter={() => prefetchWorkspace(item.tab)}
              onFocus={() => prefetchWorkspace(item.tab)}
              title={item.label}
            >
              <span className="workspace-journey-number">{index + 1}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="workspace-hero-image" aria-hidden="true">
        <img src={meta.image} alt="" loading="lazy" decoding="async" />
        <div className="workspace-hero-image-scrim" />
      </div>
    </section>
  );
}

export function App() {
  const { t } = useAppLanguage();
  const {
    activeTab,
    setActiveTab,
    fields,
    machines,
    fireEvents,
    selectedField,
    setSelectedField,
    activeRoutePolyline,
    setActiveRoutePolyline,
    certificateField,
    setCertificateField,
    handleUpdateFieldStatus,
    refreshLiveData,
    demoMode,
    loadingLiveData,
    liveDataError,
    liveSignedOut,
    liveConfigured,
    residueLots,
    buyers: liveBuyers,
    storageYards: liveStorageYards,
  } = useAppController();

  const navigate = useCallback((tab: ActiveTab) => {
    startTransition(() => setActiveTab(tab));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [setActiveTab]);

  const handleSelectField = (field: Field) => {
    setSelectedField(field);
  };

  return (
    <div data-active-tab={activeTab} className="nirdhoom-field-app min-h-screen flex flex-col font-sans relative overflow-x-clip">
      <a href="#main-content" className="skip-link">{t('Skip to main content')}</a>
      {/* Top Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        demoMode={demoMode}
      />

      {!demoMode && !liveConfigured && (
        <div className="live-state-banner live-state-banner-error" role="alert">
          <strong>{t('This deployment is not connected to a database.')}</strong>
          <span>Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in Vercel for the environment that built this page, then redeploy.</span>
        </div>
      )}
      {!demoMode && liveConfigured && loadingLiveData && <div className="live-state-banner live-state-banner-loading" role="status">{t('Loading live operational records…')}</div>}
      {!demoMode && liveConfigured && !loadingLiveData && liveSignedOut && (
        <div className="live-state-banner live-state-banner-info" role="status">
          <strong>{t('Sign in to see live fields.')}</strong>
          <span>Field and machine records are private. Use your mobile number to create or open your NIRDHOOM account.</span>
          <button type="button" onClick={() => navigate('FARMER_KYC')}>{t('Sign in or create account')}</button>
        </div>
      )}
      {!demoMode && liveDataError && (() => {
        const problem = describeLiveError(liveDataError);
        return (
          <div className="live-state-banner live-state-banner-error" role="alert">
            <strong>Live data unavailable: {problem.summary}</strong>
            <span>{problem.hint}</span>
            <small>Technical detail: {liveDataError}</small>
          </div>
        );
      })()}

      {/* Main Content Area */}
      <main id="main-content" className="field-main flex-1 relative z-10">
        <Suspense fallback={<WorkspaceLoading />}>
        {activeTab !== 'OVERVIEW' && <WorkspaceHeader activeTab={activeTab} demoMode={demoMode} onNavigate={navigate} />}

        {/* PRIMARY PRODUCT SURFACE: RESIDUE-FIRST COMMAND CENTER */}
        {activeTab === 'OVERVIEW' && (
          <CommandCenter
            fields={fields}
            machines={machines}
            fireEvents={fireEvents}
            storageYards={demoMode ? INITIAL_STORAGE_YARDS : liveStorageYards}
            buyers={demoMode ? INITIAL_BUYERS : liveBuyers}
            onSelectField={handleSelectField}
            onOpenResidue={() => navigate('RESIDUE_POOLS')}
            onOpenImpact={() => navigate('IMPACT_RESEARCH')}
            onNavigate={(tab) => navigate(tab as ActiveTab)}
            demoMode={demoMode}
          />
        )}
        {activeTab === 'OVERVIEW' && demoMode && (
          <div className="px-4 pb-6 sm:px-6 lg:px-8">
            <DemoScenarioJourney onOpenMap={() => navigate('OPS_CONSOLE')} />
          </div>
        )}

        {activeTab === 'FARMER_ONBOARDING' && (
          <ClearanceBooking fields={fields} demoMode={demoMode} onBooked={(fieldId, amount) => handleUpdateFieldStatus(fieldId, 'BOOKED', amount)} onBookingChanged={() => { void refreshLiveData(); }} />
        )}

        {activeTab === 'FARMER_KYC' && (
          <FarmerOnboarding onNavigate={navigate} onFieldsChanged={() => void refreshLiveData()} />
        )}

        {activeTab === 'RESIDUE_POOLS' && (
          <ResiduePooling fields={fields} demoMode={demoMode} />
        )}

        {activeTab === 'IMPACT_RESEARCH' && (
          <ImpactResearch fields={fields} demoMode={demoMode} />
        )}

        {activeTab === 'FIELD_JOBS' && (
          <>
            <FieldJobBoard
              fields={fields}
              machines={machines}
              demoMode={demoMode}
              onSelectField={handleSelectField}
              onOpenDispatch={() => navigate('OPS_CONSOLE')}
              onOpenResidue={() => navigate('RESIDUE_POOLS')}
              onOpenImpact={() => navigate('IMPACT_RESEARCH')}
            />
            {(selectedField || fields[0]) && (
            <FieldEvidenceTimeline
              field={(selectedField || fields[0])!}
              machine={machines.find((machine) => machine.id === (selectedField || fields[0])?.assigned_machine_id) || machines[0] || null}
              demoMode={demoMode}
            />
            )}
          </>
        )}

        {activeTab === 'FIELD_PROVENANCE' && (
          <FieldProvenancePanel fields={fields} demoMode={demoMode} />
        )}

        {activeTab === 'HARVEST_INTELLIGENCE' && (
          <HarvestIntelligence fields={fields} machines={machines} demoMode={demoMode} />
        )}

        {activeTab === 'OPS_CONSOLE' && (
          <div className="workspace-stack">
            <ResidueControlTower
              fields={fields}
              machines={machines}
              buyers={demoMode ? INITIAL_BUYERS : liveBuyers}
              storageYards={demoMode ? INITIAL_STORAGE_YARDS : liveStorageYards}
              residueLots={demoMode ? INITIAL_RESIDUE_LOTS : residueLots}
              demoMode={demoMode}
              onSelectField={handleSelectField}
              onNavigate={(tab) => navigate(tab as ActiveTab)}
            />

            <section className="ops-console" aria-labelledby="ops-console-title">
              <div className="section-bar">
                <div>
                  <h2 id="ops-console-title" className="section-bar-title">
                    <Map className="h-4 w-4" aria-hidden="true" />
                    {t('Central Ops & VRP Dispatch Console')}
                  </h2>
                  <p className="section-bar-sub">
                    {t('GIS operations prototype for a Sangrur cluster using demo machinery and FIRMS-style event data')}
                  </p>
                </div>
                <div className="section-bar-meta">
                  <span className="pill pill-green">{demoMode ? 'Demo GPS feed' : 'Live operator telemetry'}</span>
                  <span className="pill">{fields.length} Farms • {machines.length} Balers</span>
                </div>
              </div>

              <div className="ops-console-grid">
                <div className="ops-console-map">
                  <OpsMap
                    fields={fields}
                    machines={machines}
                    fireEvents={fireEvents}
                    storageYards={demoMode ? INITIAL_STORAGE_YARDS : liveStorageYards}
                    buyers={demoMode ? INITIAL_BUYERS : liveBuyers}
                    selectedField={selectedField}
                    demoMode={demoMode}
                    onSelectField={handleSelectField}
                    activeRoutePolyline={activeRoutePolyline}
                    defaultFieldListOpen
                  />

                  {selectedField && (
                    <FieldDetailDrawer
                      demoMode={demoMode}
                      field={selectedField}
                      onClose={() => setSelectedField(null)}
                      onTriggerUpiPayout={(f) => handleUpdateFieldStatus(f.id, 'CLEARED_PENDING_AUDIT')}
                      onViewCertificate={(f) => setCertificateField(f)}
                    />
                  )}
                </div>

                <div className="ops-console-side">
                  <VRPDispatchPanel
                    fields={fields}
                    machines={machines}
                    onRouteSelected={(route) => setActiveRoutePolyline(route)}
                    onSelectField={handleSelectField}
                  />
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'FARMER_SURFACE' && (
          <TelegramChannel />
        )}

        {activeTab === 'BALER_OPERATOR' && (
          machines[0] ? (
            <BalerPWA
              fields={fields}
              activeMachine={machines[0]}
              demoMode={demoMode}
              onJobCompleted={(fId, amt) => demoMode ? handleUpdateFieldStatus(fId, 'CLEARED_PENDING_AUDIT', amt) : void refreshLiveData()}
            />
          ) : (
            <section className="empty-workspace">
              <span className="empty-workspace-icon"><Zap className="h-5 w-5" aria-hidden="true" /></span>
              <h2>{t('Field Operator PWA')}</h2>
              <p>
                {t('No live machine is assigned yet. Connect an operator machine record before starting field operations.')}
              </p>
              <div className="empty-workspace-stats">
                <div>
                  <span>{t('Live fields')}</span>
                  <strong>{fields.length}</strong>
                </div>
                <div>
                  <span>{t('Assigned machines')}</span>
                  <strong>{machines.length}</strong>
                </div>
              </div>
            </section>
          )
        )}

        {activeTab === 'SATELLITE_AUDIT' && (
          <SatelliteAudit
            fields={fields}
            fireEvents={fireEvents}
            demoMode={demoMode}
            onVerified={(fieldId) => { if (demoMode) handleUpdateFieldStatus(fieldId, 'VERIFIED_NON_BURN'); else void refreshLiveData(); }}
          />
        )}

        {activeTab === 'OFFTAKE_AUCTION' && (
          <div className="workspace-stack">
            <MultiOfftakeAuction buyers={liveBuyers} demoMode={demoMode} />
            <HarvestForecast fields={fields} demoMode={demoMode} />
          </div>
        )}
        </Suspense>
      </main>

      {/* Global Modals */}
      {/* 1. Illustrative internal verification record modal */}
      {certificateField && (
        <CarbonCertificate
          certificate={generateNonBurnCertificate(certificateField)}
          onClose={() => setCertificateField(null)}
        />
      )}

      {/* Modern Footer */}
      <footer className="site-footer">
        <div className="site-footer-inner">
          <div className="site-footer-brand">
            <strong>NIRDHOOM (ਨਿਰਧੂਮ)</strong>
            <span className="sep">•</span>
            <span className="tag">The Parali Reframe</span>
          </div>

          <div className="site-footer-links">
            {t('Field operations • Evidence • Residue • Buyer pathways')}
          </div>

          <span className="site-footer-badge">{t('Evidence-first prototype')}</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
