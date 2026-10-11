import { motion } from 'motion/react';
import { useAppLanguage } from '../../i18n/LanguageContext';
import {
  Activity, ArrowRight, CalendarDays, CheckCircle2, Factory, Leaf, Map,
  MapPinned, ShieldCheck, Truck, Wheat, Users, CircleDollarSign, Camera,
  Satellite, ChevronRight
} from 'lucide-react';
import { Field, Machine, BurnEvent, StorageYard, Buyer } from '../../types';
import { OpsMap } from '../OpsConsole/OpsMap';
import { Spotlight } from '../Animated/Spotlight';

interface Props {
  fields: Field[];
  machines: Machine[];
  fireEvents: BurnEvent[];
  storageYards: StorageYard[];
  buyers: Buyer[];
  onSelectField: (field: Field) => void;
  onOpenResidue: () => void;
  onOpenImpact: () => void;
  onNavigate: (tab: string) => void;
  demoMode?: boolean;
}

const heroImage = '/images/punjab_farm_hero.jpg';
const farmImage = '/images/punjab_farm_hero.jpg';
const balerImage = '/images/baler_machine.jpg';
const fleetImage = '/images/baling_dispatch_fleet_1790447115856.jpg';
const offtakeImage = '/images/offtake_facility.jpg';
const satelliteImage = '/images/satellite_firms.jpg';
const farmerPhoneImage = '/images/farmer_phone.jpg';
const circularUseImage = '/images/cbg_mushroom_offtake_1790447167269.jpg';
const monsoonImage = '/images/farmer_manpreet.jpg';

export function CommandCenter({
  fields, machines, fireEvents, storageYards, buyers, onSelectField, onOpenResidue, onOpenImpact, onNavigate, demoMode = false
}: Props) {
  const { t } = useAppLanguage();
  const activeJobs = fields.filter(f => ['SCHEDULED', 'BALING_IN_PROGRESS'].includes(f.status)).length;
  const verified = fields.filter(f => f.status === 'VERIFIED_NON_BURN' || f.is_verified_non_burn).length;
  const machineActive = machines.filter(m => m.status !== 'MAINTENANCE').length;
  const residueLots = fields.filter((f) => Boolean(f.residue_lot_id)).length;
  const cleared = fields.filter(f => ['CLEARED_PENDING_AUDIT', 'VERIFIED_NON_BURN'].includes(f.status)).length;

  // Open Check My Proof and scroll to one evidence panel once it has rendered.
  const openReview = (anchor: string) => {
    onNavigate('SATELLITE_AUDIT');
    let tries = 0;
    const timer = window.setInterval(() => {
      const target = document.getElementById(anchor);
      tries += 1;
      if (target) {
        window.clearInterval(timer);
        window.setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 250);
      } else if (tries > 40) {
        window.clearInterval(timer);
      }
    }, 100);
  };

  const workflow = [
    { n: '01', title: 'Register the field', text: 'Add the field, location and consent once.', icon: MapPinned, image: farmImage, imageAlt: 'Paddy fields in Batala, Gurdaspur, Punjab', tab: 'My Fields' },
    { n: '02', title: 'Book clearance', text: 'Request a machine and plan the job around the field deadline.', icon: CalendarDays, image: balerImage, imageAlt: 'Tractor and baler in agricultural work', tab: 'Book Clearance' },
    { n: '03', title: 'Track the operation', text: 'Follow assignment, route, machine status and field evidence.', icon: Truck, image: fleetImage, imageAlt: 'Tractor preparing a Punjab field', tab: 'Track Clearance' },
    { n: '04', title: 'Verify the work', text: 'Review field evidence and supporting remote-sensing observations separately.', icon: ShieldCheck, image: satelliteImage, imageAlt: 'Satellite observation used as supporting evidence', tab: 'Verify' },
    { n: '05', title: 'Move the residue', text: 'Carry verified lots into pooling and buyer demand when the gates are met.', icon: Leaf, image: circularUseImage, imageAlt: 'Biomass utilisation facility', tab: 'Parali Market' },
  ];

  const audiences = [
    { title: 'Farmers', text: 'Register a field, request clearance and follow the next action.', icon: Wheat, accent: 'green', tab: 'FARMER_ONBOARDING' },
    { title: 'Operators', text: 'Work assigned jobs, report progress and attach field evidence.', icon: Factory, accent: 'sky', tab: 'BALER_OPERATOR' },
    { title: 'Buyers', text: 'See verified supply and demand without treating a lead as a contract.', icon: CircleDollarSign, accent: 'wheat', tab: 'OFFTAKE_AUCTION' },
    { title: 'Verification teams', text: 'Review evidence with provenance before downstream impact is counted.', icon: Satellite, accent: 'soil', tab: 'SATELLITE_AUDIT' },
  ];

  return (
    <div className="field-page field-home pb-12">
      <section className="home-hero">
        <Spotlight className="home-hero-spotlight" fill="#f2a900" />
        <img src={heroImage} alt="Punjab agricultural field context" className="home-hero-image" decoding="async" fetchPriority="high" />
        <div className="home-hero-overlay" />
        <div className="home-hero-content">
          <div className="home-eyebrow"><Leaf className="h-4 w-4" /> {t('FIELD OPERATIONS • NIRDHOOM')}</div>
          <h1>{t('Clear the field.')}<br /><span>{t('Keep the chain visible.')}</span></h1>
          <p>{t('NIRDHOOM connects a farmer request to machine capacity, field evidence and the next residue pathway without turning uncertain information into a promise.')}</p>
          <div className="home-actions">
            <button onClick={() => onNavigate('FARMER_ONBOARDING')} className="home-primary">{t('Book parali pickup')} <ArrowRight className="h-4 w-4" /></button>
            <button onClick={() => onNavigate('OPS_CONSOLE')} className="home-secondary"><Map className="h-4 w-4" /> {t('Track today’s operation')}</button>
          </div>
          <div className="home-trust-row">
            <span><CheckCircle2 /> {t('Evidence before impact')}</span>
            <span><Map /> {t('Field-level provenance')}</span>
            <span><Truck /> {t('Machine-linked operations')}</span>
          </div>
          <span className="home-photo-credit">Photo: project photography · source attribution documented in docs/IMAGE-LICENSES.md</span>
        </div>
      </section>

      <section className="home-product-status" aria-label="Operational status">
        <div>
          <span className="home-section-kicker">{t('Today')}</span>
          <strong>{t('Start with the next field action.')}</strong>
          <small>{t('These numbers are derived from the records currently loaded in NIRDHOOM.')}</small>
        </div>
        <div className="home-status-grid">
          {[
            { icon: MapPinned, value: fields.length, label: 'fields', tab: 'FIELD_JOBS' },
            { icon: Truck, value: activeJobs, label: 'active jobs', tab: 'OPS_CONSOLE' },
            { icon: Leaf, value: residueLots, label: 'residue lots', tab: 'RESIDUE_POOLS' },
            { icon: ShieldCheck, value: verified, label: 'verified fields', tab: 'SATELLITE_AUDIT' },
          ].map(({ icon: Icon, value, label, tab }, index) => (
            <motion.button
              key={label}
              type="button"
              onClick={() => onNavigate(tab)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.3 }}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.98 }}
            >
              <Icon /><span><b>{value}</b><small>{t(label)}</small></span>
            </motion.button>
          ))}
        </div>
      </section>

      <section className="home-intro">
        <div>
          <div className="home-section-kicker">{t('One connected journey')}</div>
          <h2>{t('From field request to residue movement.')}</h2>
        </div>
        <p>{t('Keep the operational chain readable: who requested clearance, which machine is assigned, what evidence was captured, what residue was verified, and where it can go next.')}</p>
      </section>

      <section className="home-workflow" aria-label="NIRDHOOM workflow">
        {workflow.map((step) => {
          const Icon = step.icon;
          const target = step.tab === 'My Fields' ? 'FIELD_JOBS' : step.tab === 'Book Clearance' ? 'FARMER_ONBOARDING' : step.tab === 'Track Clearance' ? 'OPS_CONSOLE' : step.tab === 'Parali Market' ? 'RESIDUE_POOLS' : 'SATELLITE_AUDIT';
          return (
            <button type="button" key={step.n} onClick={() => onNavigate(target)} className="home-workflow-card text-left">
              <div className="home-workflow-image">
                <img src={step.image} alt={step.imageAlt} loading="lazy" decoding="async" />
                <span>{step.n}</span>
              </div>
              <div className="home-workflow-body">
                <Icon className="home-card-icon" />
                <h3>{t(step.title)}</h3>
                <p>{t(step.text)}</p>
                <span className="home-card-link">{t(step.tab)} <ChevronRight /></span>
              </div>
            </button>
          );
        })}
      </section>

      <section className="home-field-stories" aria-labelledby="field-stories-title">
        <div className="home-field-stories-heading">
          <div>
            <div className="home-section-kicker">{t('Field context')}</div>
            <h2>{t('Ground the product in the places it serves.')}</h2>
          </div>
          <p>{t('Curated public-domain and Creative Commons photography keeps the product grounded in real agricultural landscapes. Each image is credited and linked to its source.')}</p>
        </div>
        <div className="home-field-stories-grid">
          <figure>
            <img src={heroImage} alt="Punjab agricultural field context" loading="lazy" decoding="async" />
            <figcaption><span>Punjab field context</span><span>Project photography</span></figcaption>
          </figure>
          <figure>
            <img src={fleetImage} alt="Agricultural machinery working a Punjab field" loading="lazy" decoding="async" />
            <figcaption><span>Residue-aware field preparation</span><span>Project photography</span></figcaption>
          </figure>
          <figure>
            <img src={monsoonImage} alt="Punjab field landscape" loading="lazy" decoding="async" />
            <figcaption><span>Early-season field landscape</span><span>Project photography</span></figcaption>
          </figure>
          <figure>
            <img src="/images/farmer_phone.jpg" alt="Farmer using a phone for field coordination" loading="lazy" decoding="async" />
            <figcaption><span>Farmer coordination</span><span>Project photography</span></figcaption>
          </figure>
          <figure>
            <img src="/images/offtake_facility.jpg" alt="Residue offtake facility" loading="lazy" decoding="async" />
            <figcaption><span>Downstream pathway</span><span>Project photography</span></figcaption>
          </figure>
        </div>
      </section>

      <section className="home-product-layer">
        <div className="home-layer-copy">
          <div className="home-section-kicker">{t('Operational layer')}</div>
          <h2>{t('See the field, machine and evidence together.')}</h2>
          <p>The map is one layer of the workflow. It brings field geometry, machine state, residue and supporting observations into the same operational context.</p>
          <div className="home-mini-grid">
            <div><MapPinned /><strong>{fields.length}</strong><span>registered fields</span></div>
            <div><Truck /><strong>{activeJobs}</strong><span>active jobs</span></div>
            <div><Factory /><strong>{machineActive}</strong><span>non-maintenance machines</span></div>
            <div><ShieldCheck /><strong>{verified}</strong><span>verified fields</span></div>
          </div>
        </div>
        <div className="home-map-card">
          <div className="home-map-header">
            <div><span>FIELD VIEW</span><strong>Operations map</strong></div>
            <span className="home-live-pill"><i /> Loaded records</span>
          </div>
          <OpsMap fields={fields} machines={machines} fireEvents={fireEvents} storageYards={storageYards} buyers={buyers} selectedField={null} onSelectField={onSelectField} activeRoutePolyline={[]} demoMode={demoMode} />
        </div>
      </section>

      <section className="home-role-section">
        <div className="home-section-kicker">Built around real jobs</div>
        <div className="home-role-heading"><h2>{t('One network, different workspaces.')}</h2><p>Farmers get a short path. Operators, buyers and verification teams get the detail required for their part of the chain.</p></div>
        <div className="home-role-grid">
          {audiences.map(({ title, text, icon: Icon, accent, tab }) => (
            <button key={title} type="button" onClick={() => onNavigate(tab)} className={`home-role-card ${accent} text-left`}>
              <span className="home-role-icon"><Icon /></span>
              <h3>{title}</h3>
              <p>{text}</p>
              <span className="home-card-link">Open workspace <ChevronRight /></span>
            </button>
          ))}
        </div>
      </section>

      <section className="home-split-story">
        <div className="home-story-image"><img src={offtakeImage} alt="Residue offtake facility" loading="lazy" decoding="async" /></div>
        <div className="home-story-copy">
          <div className="home-section-kicker">Residue becomes supply</div>
          <h2>{t('Don’t stop at clearance.')}</h2>
          <p>When residue is actually verified, NIRDHOOM carries it into pooling, buyer demand and transport planning instead of treating the field job as the end of the workflow.</p>
          <div className="home-value-list">
            <div><Leaf /><span><b>Pool</b> by quality, location and readiness.</span></div>
            <div><Users /><span><b>Match</b> supply to buyer requirements.</span></div>
            <div><Truck /><span><b>Dispatch</b> with operational context.</span></div>
          </div>
          <button onClick={onOpenResidue} className="home-text-button">Open residue market <ArrowRight /></button>
        </div>
      </section>

      <section className="home-evidence">
        <div className="home-evidence-image"><img src={satelliteImage} alt="Satellite observation and field monitoring" loading="lazy" decoding="async" /></div>
        <div className="home-evidence-copy">
          <div className="home-section-kicker">Trust layer</div>
          <h2>{t('Evidence first. Impact second.')}</h2>
          <p>Planned residue is not treated as verified impact. NIRDHOOM keeps operator evidence, field status and supporting remote-sensing observations distinct before downstream claims are made.</p>
          <div className="home-evidence-points">
            <button type="button" onClick={() => openReview('review-photos')}><Camera /> Photo evidence</button>
            <button type="button" onClick={() => openReview('review-geometry')}><Map /> Field geometry</button>
            <button type="button" onClick={() => openReview('review-satellite')}><Satellite /> Satellite context</button>
            <button type="button" onClick={() => openReview('review-decision')}><CheckCircle2 /> Verification review</button>
          </div>
          <button onClick={onOpenImpact} className="home-text-button">Open impact & research <ArrowRight /></button>
        </div>
      </section>

      <section className="home-proof" aria-label="Current record counts">
        <div><span>FIELD NETWORK</span><strong>{fields.length}</strong><small>registered fields</small></div>
        <div><span>OPERATIONS</span><strong>{cleared}</strong><small>cleared fields</small></div>
        <div><span>RESIDUE</span><strong>{residueLots}</strong><small>linked residue lots</small></div>
        <div><span>VERIFIED</span><strong>{verified}</strong><small>verified non-burn fields</small></div>
      </section>

      <section className="home-data-note" aria-label="Data boundary">
        <Activity />
        <div>
          <strong>What you see is scoped to the records available here.</strong>
          <p>Sample records are labelled when the app is running without connected live data. Capacity, GPS, verification and commercial status are not inferred from public statistics.</p>
        </div>
      </section>
    </div>
  );
}
