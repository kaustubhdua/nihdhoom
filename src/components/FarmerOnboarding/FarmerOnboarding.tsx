import React, { useEffect, useState } from 'react';
import CodeSlots from './CodeSlots';
import LatticeLoader from '../LatticeLoader/LatticeLoader';
import Stepper, { Step } from './Stepper';
import { supabase } from '../../lib/supabase';
import { describeAuthError } from '../../lib/liveStatus';
import { useAppLanguage } from '../../i18n/LanguageContext';
import type { ActiveTab } from '../Header';
import {
  UserCheck,
  Phone,
  MapPin,
  Shield,
  CreditCard,
  CheckCircle2,
  Sparkles,
  Fingerprint,
  Landmark,
  Smartphone,
  Camera,
  Wheat,
  Loader2,
} from 'lucide-react';

type KYCStep = 'PHONE' | 'OTP' | 'CONSENT' | 'AADHAAR' | 'FACE_SCAN' | 'BANK' | 'LAND_RECORDS' | 'DONE';

const STEPS: { id: KYCStep; label: string; sublabel: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'PHONE', label: 'Mobile Verification', sublabel: 'Enter registered mobile', icon: Phone },
  { id: 'OTP', label: 'OTP Confirm', sublabel: '6-digit SMS code', icon: Smartphone },
  { id: 'CONSENT', label: 'Farmer consent', sublabel: 'Operational data agreement', icon: Shield },
  { id: 'AADHAAR', label: 'Identity verification (demo)', sublabel: 'Demo only — no external identity API', icon: Fingerprint },
  { id: 'FACE_SCAN', label: 'Selfie match (demo)', sublabel: 'Demo state — no biometric processing', icon: Camera },
  { id: 'BANK', label: 'Bank link (demo)', sublabel: 'Demo state — no bank verification', icon: Landmark },
  { id: 'LAND_RECORDS', label: 'Land records (demo)', sublabel: 'Demo state — no registry lookup', icon: Wheat },
  { id: 'DONE', label: 'Demo profile created', sublabel: 'Not registered in a live system', icon: CheckCircle2 },
];

const STEP_ORDER: KYCStep[] = ['PHONE', 'OTP', 'CONSENT', 'AADHAAR', 'FACE_SCAN', 'BANK', 'LAND_RECORDS', 'DONE'];
const DEMO_MODE = import.meta.env.VITE_NIRDHOOM_DEMO_MODE === 'true';

// Live accounts only use steps that talk to real services: phone, OTP, consent,
// then a real field. The identity, selfie and bank adapters stay demo-only.
const LIVE_ORDER: KYCStep[] = ['PHONE', 'OTP', 'CONSENT', 'LAND_RECORDS', 'DONE'];
const LIVE_LABELS: Partial<Record<KYCStep, { label: string; sublabel: string }>> = {
  LAND_RECORDS: { label: 'Register your field', sublabel: 'Where the machine should go' },
  DONE: { label: 'Account ready', sublabel: 'Book a pickup or open Telegram' },
};
const FLOW: KYCStep[] = DEMO_MODE ? STEP_ORDER : LIVE_ORDER;
const VISIBLE_STEPS = FLOW.map((id) => {
  const base = STEPS.find((step) => step.id === id) as (typeof STEPS)[number];
  return DEMO_MODE ? base : { ...base, ...(LIVE_LABELS[id] || {}) };
});
const VARIETIES = ['PR-126', 'PR-131', 'Pusa-44', 'Basmati-1509', 'Basmati-1121'] as const;
const DISTRICTS = ['Sangrur', 'Patiala', 'Ludhiana', 'Bathinda', 'Moga', 'Barnala', 'Fatehgarh Sahib', 'Ferozepur', 'Mansa', 'Muktsar', 'Faridkot', 'Jalandhar', 'Kapurthala', 'Amritsar', 'Tarn Taran', 'Gurdaspur', 'Hoshiarpur', 'Mohali', 'Rupnagar', 'Fazilka', 'Pathankot', 'Malerkotla', 'Nawanshahr'];

type OwnedField = { id: string; khasra_no: string; village: string; acreage: number; status: string };

type Props = {
  onNavigate?: (tab: ActiveTab) => void;
  onFieldsChanged?: () => void;
};

export const FarmerOnboarding: React.FC<Props> = ({ onNavigate, onFieldsChanged }) => {
  const { t } = useAppLanguage();
  const [currentStep, setCurrentStep] = useState<KYCStep>('PHONE');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [aadhaarLast4, setAadhaarLast4] = useState('');
  const [name, setName] = useState('');
  const [village, setVillage] = useState('');
  const [block, setBlock] = useState('');
  const [khasra, setKhasra] = useState('');
  const [acreage, setAcreage] = useState('');
  const [loading, setLoading] = useState(false);
  const [faceScanned, setFaceScanned] = useState(false);
  const [bankVerified, setBankVerified] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [otpStatus, setOtpStatus] = useState<'idle' | 'error' | 'success'>('idle');
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [activeConsent, setActiveConsent] = useState(false);
  const [withdrawBusy, setWithdrawBusy] = useState(false);
  const [withdrawMessage, setWithdrawMessage] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [myFields, setMyFields] = useState<OwnedField[]>([]);
  const [district, setDistrict] = useState('Sangrur');
  const [variety, setVariety] = useState<string>('PR-126');
  const [harvestDate, setHarvestDate] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [locating, setLocating] = useState(false);
  const [fieldBusy, setFieldBusy] = useState(false);
  const [fieldError, setFieldError] = useState('');
  const [savedField, setSavedField] = useState<OwnedField | null>(null);

  // Load everything we know about the signed-in farmer. Returns whether an
  // active consent exists so callers can skip steps the farmer already did.
  const loadAccount = async (uid: string): Promise<boolean> => {
    if (!supabase) return false;
    const client = supabase;
    const [consentRes, profileRes, fieldsRes] = await Promise.all([
      client.from('consents').select('id').eq('profile_id', uid).eq('consent_type', 'farmer_network').is('revoked_at', null).order('accepted_at', { ascending: false }).limit(1).maybeSingle(),
      client.from('profiles').select('full_name,phone,village').eq('id', uid).maybeSingle(),
      client.from('fields').select('id,khasra_no,village,acreage,status').eq('owner_id', uid).order('created_at', { ascending: false }),
    ]);
    const hasConsent = Boolean(consentRes.data);
    setUserId(uid);
    setActiveConsent(hasConsent);
    setMyFields((fieldsRes.data as OwnedField[] | null) || []);
    const profile = profileRes.data as { full_name?: string | null; phone?: string | null; village?: string | null } | null;
    if (profile) {
      setName((value) => value || profile.full_name || '');
      setVillage((value) => value || profile.village || '');
      setPhone((value) => value || String(profile.phone || '').replace(/^\+?91/, ''));
    }
    return hasConsent;
  };

  useEffect(() => {
    if (DEMO_MODE || !supabase) return;
    const client = supabase;
    let cancelled = false;
    void client.auth.getUser().then(async ({ data }) => {
      if (!data.user || cancelled) return;
      const hasConsent = await loadAccount(data.user.id);
      if (cancelled) return;
      setCurrentStep((step) => (step === 'PHONE' ? (hasConsent ? 'LAND_RECORDS' : 'CONSENT') : step));
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUserId(null);
    setMyFields([]);
    setActiveConsent(false);
    reset();
  };

  const useMyLocation = () => {
    setFieldError('');
    if (!navigator.geolocation) {
      setFieldError('This browser cannot share a location. Type the latitude and longitude instead.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        setFieldError(err.code === err.PERMISSION_DENIED
          ? 'Location permission was blocked. Allow location for this site, or type the latitude and longitude.'
          : 'Could not read your location. Try again outdoors, or type the latitude and longitude.');
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  };

  const registerField = async () => {
    setFieldError('');
    const acres = Number(acreage);
    const latitude = Number(lat);
    const longitude = Number(lng);
    if (!supabase) { setFieldError('Live database is not configured.'); return; }
    if (!khasra.trim()) { setFieldError('Enter the Khasra or survey number from your land record.'); return; }
    if (!village.trim()) { setFieldError('Enter the village.'); return; }
    if (!Number.isFinite(acres) || acres <= 0 || acres > 500) { setFieldError('Enter the area in acres, between 0.01 and 500.'); return; }
    if (!lat || !lng || !Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < 6 || latitude > 38 || longitude < 68 || longitude > 98) {
      setFieldError('Add the field location with the button, or type a valid latitude and longitude.');
      return;
    }
    setFieldBusy(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setFieldBusy(false);
      setFieldError('Your session expired. Please verify your phone again.');
      return;
    }
    const { data, error } = await supabase
      .from('fields')
      .insert({
        owner_id: userData.user.id,
        khasra_no: khasra.trim(),
        village: village.trim(),
        block: block || null,
        district,
        crop: 'Paddy',
        variety,
        acreage: Math.round(acres * 100) / 100,
        expected_harvest_date: harvestDate || null,
        center_lat: latitude,
        center_lng: longitude,
        status: 'REGISTERED',
      })
      .select('id,khasra_no,village,acreage,status')
      .single();
    setFieldBusy(false);
    if (error || !data) {
      setFieldError(error?.message || 'The field could not be saved. Please try again.');
      return;
    }
    const saved = data as OwnedField;
    setSavedField(saved);
    setMyFields((list) => [saved, ...list]);
    setKhasra(''); setAcreage(''); setHarvestDate(''); setLat(''); setLng('');
    onFieldsChanged?.();
    setCurrentStep('DONE');
  };

  const withdrawConsent = async () => {
    if (DEMO_MODE || !supabase || withdrawBusy) return;
    const confirmed = window.confirm('Withdraw NIRDHOOM operational consent? Future booking actions will require consent again.');
    if (!confirmed) return;
    setWithdrawBusy(true);
    setWithdrawMessage('');
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      setWithdrawBusy(false);
      setWithdrawMessage('Your session has expired. Sign in again to manage consent.');
      return;
    }
    const now = new Date().toISOString();
    const { error: consentError } = await supabase
      .from('consents')
      .update({ revoked_at: now })
      .eq('profile_id', data.user.id)
      .eq('consent_type', 'farmer_network')
      .is('revoked_at', null);
    if (consentError) {
      setWithdrawBusy(false);
      setWithdrawMessage(consentError.message || 'Consent could not be withdrawn.');
      return;
    }
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ consent_status: 'REVOKED' })
      .eq('id', data.user.id);
    setWithdrawBusy(false);
    if (profileError) {
      setWithdrawMessage(profileError.message || 'Consent was revoked, but profile status could not be updated.');
      return;
    }
    setActiveConsent(false);
    setConsentAccepted(false);
    setWithdrawMessage('Consent withdrawn. New booking actions will require fresh consent.');
  };

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setInterval(() => setResendSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [resendSeconds]);

  const stepIndex = FLOW.indexOf(currentStep);

  const advance = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      const next = FLOW[stepIndex + 1];
      if (next) setCurrentStep(next);
    }, 900);
  };

  // Normalize a 10-digit Indian mobile number to E.164. The input strips
  // punctuation, so this also protects against a pasted country code.
  const phoneDigits = phone.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
  const normalizedPhone = phoneDigits ? `+91${phoneDigits}` : '';

  const sendLiveOtp = async () => {
    if (loading) return;
    if (DEMO_MODE) {
      if (currentStep === 'PHONE') {
        advance();
      } else {
        setOtp('');
        setOtpStatus('idle');
        setOtpError('');
      }
      return;
    }
    if (!supabase) {
      setOtpError(t('Live authentication is not configured. Check the Supabase URL and publishable key for this deployment.'));
      setOtpStatus('error');
      return;
    }
    if (phoneDigits.length !== 10 || !name.trim()) {
      setOtpError(t('Enter your name and a valid 10-digit Indian mobile number.'));
      setOtpStatus('error');
      return;
    }

    setLoading(true);
    setOtpError('');
    setOtpStatus('idle');
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: normalizedPhone,
        options: { shouldCreateUser: true },
      });
      if (error) {
        setOtpError(describeAuthError(error.message, t('Unable to send OTP. Check phone authentication and SMS provider settings.')));
        setOtpStatus('error');
        return;
      }
      setOtp('');
      setResendSeconds(45);
      setCurrentStep('OTP');
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setOtpError(t('OTP request failed before Supabase returned a response. Check your connection and try again.') + ` (${detail.slice(0, 180)})`);
      setOtpStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const verifyLiveOtp = async (code: string) => {
    if (code.length !== 6 || loading) return;
    if (DEMO_MODE) {
      if (code !== '842613') {
        setOtpError('That demo code is incorrect. Try 842613.');
        setOtpStatus('error');
        return;
      }
      setOtpStatus('success');
      window.setTimeout(() => setCurrentStep('CONSENT'), 650);
      return;
    }
    if (!supabase) {
      setOtpError(t('Live authentication is not configured. Check the Supabase URL and publishable key for this deployment.'));
      setOtpStatus('error');
      return;
    }
    setLoading(true);
    setOtpError('');
    setOtpStatus('idle');
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone: normalizedPhone,
        token: code,
        type: 'sms',
      });
      if (error || !data.user) {
        setOtpError(describeAuthError(error?.message, t('OTP verification failed. Please try again.')));
        setOtpStatus('error');
        return;
      }
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: data.user.id,
        full_name: name.trim(),
        phone: normalizedPhone,
      }, { onConflict: 'id' });
      if (profileError) {
        setOtpError(profileError.message || t('Your phone was verified, but your farmer profile could not be saved.'));
        setOtpStatus('error');
        return;
      }
      setOtpStatus('success');
      const hasConsent = await loadAccount(data.user.id);
      window.setTimeout(() => setCurrentStep(hasConsent ? 'LAND_RECORDS' : 'CONSENT'), 650);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setOtpError(t('OTP verification request failed. Check your connection and try again.') + ` (${detail.slice(0, 180)})`);
      setOtpStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setCurrentStep('PHONE');
    setPhone(''); setOtp(''); setAadhaarLast4(''); setName(''); setVillage('');
    setBlock(''); setKhasra(''); setAcreage('');
    setLat(''); setLng(''); setHarvestDate(''); setFieldError(''); setSavedField(null);
    setFaceScanned(false); setBankVerified(false); setOtpError(''); setOtpStatus('idle'); setConsentAccepted(false);
  };

  return (
    <div className="tone-adapt farmer-onboarding-surface flex flex-col gap-6 max-w-6xl mx-auto p-2">
      {/* Banner */}
      <div className="tone-native relative overflow-hidden rounded-3xl border border-emerald-900/10 bg-gradient-to-br from-[#f5faef] via-white to-[#fff5dc] p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-400/15 text-amber-700 border border-amber-300/30 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/10">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-lg text-emerald-950 font-['DM_Sans']">
                {t('Create your farmer account')}
              </h3>
              <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-2.5 py-1 text-[11px] font-black text-amber-800">{DEMO_MODE ? 'SIMULATION' : 'LIVE OTP'}</span>
            </div>
            <p className="text-sm text-emerald-950/70 mt-2 max-w-2xl leading-6">
              Verify your mobile number first. We’ll ask for consent and field details only when you need those services. SMS delivery depends on the configured Supabase phone provider.
            </p>
          </div>
        </div>
      </div>

      {!DEMO_MODE && activeConsent && (
        <div className="tone-native flex flex-col gap-2 rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <strong className="block text-xs font-black uppercase tracking-wide">Operational consent is active</strong>
            <span className="text-xs text-amber-900/75">You can withdraw it at any time. Booking will require fresh consent afterwards.</span>
          </div>
          <button type="button" onClick={() => void withdrawConsent()} disabled={withdrawBusy}
            className="min-h-10 rounded-xl border border-amber-300 bg-white px-3 text-xs font-bold text-amber-900 transition hover:bg-amber-100 disabled:opacity-50">
            {withdrawBusy ? 'Withdrawing…' : t('Withdraw consent')}
          </button>
        </div>
      )}
      {withdrawMessage && <div role="status" className="tone-native rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-700">{withdrawMessage}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Animated React Bits progress stepper */}
        <div className="lg:col-span-4">
          <div className="farmer-onboarding-stepper tone-native ui-card lg:sticky lg:top-24">
            <div className="px-1 pb-3">
              <h4 className="ui-eyebrow">Onboarding progress</h4>
              <p className="mt-2 font-[family-name:var(--font-display)] text-[22px] font-bold leading-tight text-[var(--ink)]">{VISIBLE_STEPS[stepIndex]?.label}</p>
              <p className="mt-1 text-[13px] text-[var(--muted)]">{VISIBLE_STEPS[stepIndex]?.sublabel}</p>
            </div>
            <Stepper
              key={stepIndex}
              initialStep={stepIndex + 1}
              disableStepIndicators
              stepCircleContainerClassName="farmer-stepper-container"
              stepContainerClassName="farmer-stepper-indicators"
              contentClassName="farmer-stepper-hidden-content"
              footerClassName="farmer-stepper-hidden-footer"
              onStepChange={() => undefined}
              onFinalStepCompleted={() => undefined}
            >
              {VISIBLE_STEPS.map((step) => (
                <Step key={step.id}>
                  <span className="sr-only">{t(step.label)}: {t(step.sublabel)}</span>
                </Step>
              ))}
            </Stepper>
            <ol className="kyc-steps" aria-hidden="true">
              {VISIBLE_STEPS.map((step, index) => {
                const StepIcon = step.icon;
                const state = index < stepIndex ? 'is-done' : index === stepIndex ? 'is-current' : '';
                return (
                  <li key={step.id} className={state}>
                    <span className="kyc-step-icon">{index < stepIndex ? <CheckCircle2 className="h-4 w-4" /> : <StepIcon className="h-4 w-4" />}</span>
                    <span className="min-w-0">
                      <strong>{t(step.label)}</strong>
                      <small>{t(step.sublabel)}</small>
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>

        {/* Active Step Form */}
        <div className="lg:col-span-8">
          <div className="ui-card flex min-h-[400px] flex-col gap-4 !p-6">
            {(loading || fieldBusy) && (
              <div className="flex justify-center rounded-xl bg-amber-50 px-4 py-3 text-amber-900" role="status" aria-live="polite">
                <LatticeLoader label={fieldBusy ? 'Saving field' : currentStep === 'OTP' ? 'Verifying phone' : 'Sending secure code'} color="#92400e" doneColor="#16a34a" cellSize={7} gap={2} fontSize={13} step={80} />
              </div>
            )}
            {currentStep === 'PHONE' && (
              <>
                <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                  <Phone className="w-4 h-4 text-emerald-400" />
                  <h4 className="font-bold text-sm text-white">{t('Step 1: Mobile Number Verification')}</h4>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Start with just your name and mobile number. We ask for village, district and field location later, when you register a specific field—not during login.
                </p>
                <div className="flex flex-col gap-4">
                  <div>
                    <label htmlFor="farmer-full-name" className="text-sm font-semibold text-slate-700 block mb-1.5">Full name</label>
                    <input
                      id="farmer-full-name"
                      autoComplete="name"
                      className="ui-input"
                      placeholder="Enter your name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="farmer-mobile-number" className="text-sm font-semibold text-slate-700 block mb-1.5">{t('Mobile Number (+91)')}</label>
                    <div className="flex items-center rounded-xl border border-slate-200 bg-white focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-100">
                      <span className="px-3 py-3 text-sm font-bold text-slate-500 border-r border-slate-200">+91</span>
                      <input
                        id="farmer-mobile-number"
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel-national"
                        maxLength={10}
                        className="min-w-0 flex-1 bg-transparent px-3 py-3 text-base text-slate-900 outline-none"
                        placeholder="98765 43210"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-slate-500">We’ll send a one-time code to verify this number.</p>
                    {!DEMO_MODE && <p className="mt-1 text-xs text-slate-500">Phone sign-in and an SMS provider must be enabled in Supabase before a real code can be delivered.</p>}
                  </div>
                </div>
                {!DEMO_MODE && !supabase && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-950/30 p-3 text-sm text-amber-100" role="alert">
                    {t('Live login is unavailable because this deployment is missing its Supabase URL or publishable key.')}
                  </div>
                )}
                {otpError && (
                  <div className="rounded-lg border border-red-500/30 bg-red-950/30 p-3 text-sm text-red-200" role="alert" aria-live="assertive">
                    {otpError}
                  </div>
                )}
                <button
                  type="button"
                  onClick={sendLiveOtp}
                  disabled={phoneDigits.length !== 10 || !name.trim() || loading || (!DEMO_MODE && !supabase)}
                  className="ui-btn is-primary is-lg is-block mt-auto"
                >
                  {loading ? <LatticeLoader label="Sending OTP" color="#ffffff" cellSize={4} gap={1} fontSize={12} showTimer={false} /> : <Sparkles className="w-4 h-4" />}
                  {DEMO_MODE ? t('Send Demo OTP') : t('Send OTP via SMS')}
                </button>
              </>
            )}

            {currentStep === 'OTP' && (
              <>
                <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                  <Smartphone className="w-4 h-4 text-emerald-400" />
                  <h4 className="font-bold text-sm text-white">{t('Step 2: OTP Verification')}</h4>
                </div>
                <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800 text-xs text-slate-400">
                  <div className="flex items-center justify-between gap-3">
                    <span>{t('OTP sent to')} <strong className="text-white">+91 {phone}</strong> SMS के माध्यम से।</span>
                    <button
                      type="button"
                      onClick={() => { setCurrentStep('PHONE'); setOtp(''); setOtpStatus('idle'); setOtpError(''); }}
                      className="shrink-0 text-amber-700 font-bold hover:text-amber-300"
                    >
                      Edit
                    </button>
                  </div>
                  {DEMO_MODE && (
                    <>
                      <br />
                      <span className="text-emerald-400 font-semibold">Demo OTP: 8 4 2 6 1 3</span>
                    </>
                  )}
                </div>

                <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <label className="text-sm font-bold text-slate-200">{t('Enter 6-digit OTP')}</label>
                    <span className="text-[11px] font-semibold text-slate-500">{t('Secure SMS code')}</span>
                  </div>
                  <div className="flex justify-center overflow-x-auto py-2">
                    <CodeSlots
                      length={6}
                      value={otp}
                      status={otpStatus}
                      onChange={(code) => {
                        setOtp(code);
                        if (otpStatus !== 'idle' && code.length < 6) setOtpStatus('idle');
                      }}
                      onComplete={verifyLiveOtp}
                      autoFocus
                      accentColor="#F2A900"
                      inkColor="#4A3600"
                      slotColor="#FFF7E6"
                      digitColor="#2B2115"
                      dangerColor="#DC2626"
                      slotSize={44}
                      gap={8}
                      radius={12}
                      ariaLabel="Six digit farmer verification code"
                      disabled={loading}
                    />
                  </div>
                  <p className="mt-3 text-xs text-slate-500 text-center">
                    Enter the code from the SMS. It verifies only this phone number; never share it with anyone.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <button
                    type="button"
                    disabled={resendSeconds > 0 || loading}
                    onClick={sendLiveOtp}
                    className="min-h-11 text-sm font-bold text-amber-700 disabled:text-slate-600"
                  >
                    {resendSeconds > 0 ? `${t('Resend OTP')} ${t('in')} ${resendSeconds}s` : t('Resend OTP')}
                  </button>
                  <span className="text-xs text-slate-500">Verification runs automatically when all 6 digits are entered.</span>
                </div>

                {loading && (
                  <div className="text-xs text-emerald-300 bg-emerald-950/30 border border-emerald-500/30 rounded-lg p-2" role="status">
                    {t('Verifying your OTP securely…')}
                  </div>
                )}
                {otpError && (
                  <div className="text-xs text-red-300 bg-red-950/30 border border-red-500/30 rounded-lg p-2" role="alert">
                    {otpError}
                  </div>
                )}
              </>
            )}

            {currentStep === 'CONSENT' && (
              <>
                <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  <h4 className="font-bold text-sm text-white">{t('Step 3: Farmer consent')}</h4>
                </div>
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-xs text-slate-400 leading-relaxed">
                  NIRDHOOM may use your field, booking, machine-operation, evidence and residue-lot records to coordinate clearance and produce an auditable operational record. Identity-provider, bank and registry services are separate integrations and are not implied by this consent.
                </div>
                <label className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentAccepted}
                    onChange={(e) => setConsentAccepted(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-emerald-500"
                  />
                  <span className="text-xs text-slate-400">
                    I consent to the NIRDHOOM operational record workflow and understand that this prototype does not perform Aadhaar, biometric, bank or payment processing.
                  </span>
                </label>
                <button
                  onClick={async () => {
                    if (!consentAccepted) return;
                    if (DEMO_MODE) { advance(); return; }
                    if (!supabase) { setOtpError('Live authentication is not configured.'); return; }
                    setLoading(true);
                    setOtpError('');
                    const { data: userData } = await supabase.auth.getUser();
                    if (!userData.user) {
                      setLoading(false);
                      setOtpError('Your session expired. Please verify your phone again.');
                      return;
                    }
                    const { error: consentError } = await supabase.from('consents').insert({
                      profile_id: userData.user.id,
                      consent_type: 'farmer_network',
                      version: '2026-10-04',
                      source: 'WEB_OTP_ONBOARDING',
                    });
                    if (consentError) {
                      setLoading(false);
                      setOtpError(consentError.message || 'Consent could not be recorded.');
                      return;
                    }
                    const { error: profileError } = await supabase.from('profiles').update({ consent_status: 'GRANTED' }).eq('id', userData.user.id);
                    setLoading(false);
                    if (profileError) {
                      setOtpError(profileError.message || 'Consent was recorded but profile status could not be updated.');
                      return;
                    }
                    setActiveConsent(true);
                    setCurrentStep(DEMO_MODE ? 'AADHAAR' : 'LAND_RECORDS');
                  }}
                  disabled={!consentAccepted || loading}
                  className="ui-btn is-primary is-lg is-block mt-auto"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                  {DEMO_MODE ? t('Accept demo consent') : t('Record consent & continue')}
                </button>
                {otpError && <div className="text-xs text-red-300 bg-red-950/30 border border-red-500/30 rounded-lg p-2">{otpError}</div>}
              </>
            )}

            {DEMO_MODE && currentStep === 'AADHAAR' && (
              <>
                <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                  <Fingerprint className="w-4 h-4 text-emerald-400" />
                  <h4 className="font-bold text-sm text-white">Step 3: Identity-provider adapter (demo)</h4>
                </div>
                <div className="p-3 bg-amber-950/30 border border-amber-500/30 rounded-lg text-xs text-amber-200">
                  <strong>Demo consent screen:</strong> No UIDAI/Digilocker request is made by this prototype.
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Aadhaar last 4 digits (demo reference only)</label>
                  <input
                    type="text"
                    maxLength={4}
                    className="ui-input font-mono tracking-widest"
                    placeholder="1234"
                    value={aadhaarLast4}
                    onChange={(e) => {
                      setAadhaarLast4(e.target.value.replace(/\D/g, '').slice(0, 4));
                    }}
                  />
                </div>
                <div className="flex items-start gap-2 text-xs text-slate-400 bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                  <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Live identity verification requires an authorized identity provider. This prototype does not collect or store a full Aadhaar number; only a four-digit demo reference is accepted.</span>
                </div>
                <button
                  onClick={advance}
                  disabled={!DEMO_MODE || aadhaarLast4.length < 4 || loading}
                  className="ui-btn is-primary is-lg is-block mt-auto"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Fingerprint className="w-4 h-4" />}
                  {DEMO_MODE ? 'Simulate identity-provider handoff' : 'Identity provider not configured'}
                </button>
              </>
            )}

            {DEMO_MODE && currentStep === 'FACE_SCAN' && (
              <>
                <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                  <Camera className="w-4 h-4 text-cyan-400" />
                  <h4 className="font-bold text-sm text-white">Step 4: Biometric provider adapter (demo)</h4>
                </div>
                <p className="text-xs text-slate-400">Demo-only biometric state. No face image is uploaded, matched, or scored by NIRDHOOM.</p>
                
                {!faceScanned ? (
                  <div
                    onClick={() => { setFaceScanned(true); }}
                    className="flex-1 min-h-[200px] rounded-2xl border-2 border-dashed border-slate-700 hover:border-emerald-500/60 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all group bg-slate-900/50"
                  >
                    <div className="w-24 h-24 rounded-full border-2 border-slate-600 group-hover:border-emerald-500/60 flex items-center justify-center bg-slate-800 transition-all">
                      <Camera className="w-10 h-10 text-slate-500 group-hover:text-emerald-400 transition-colors" />
                    </div>
                    <div className="text-xs text-slate-400 text-center">
                      <div className="font-semibold text-white">Click to simulate selfie capture</div>
                      <div>Position face in the oval frame</div>
                    </div>
                    <div className="flex gap-2 text-[10px] text-slate-500">
                      <span>• Look straight</span>
                      <span>• Good lighting</span>
                      <span>• No glasses</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 min-h-[220px] rounded-2xl bg-emerald-950/40 border border-emerald-500/50 flex flex-col items-center justify-center gap-3 p-3">
                    <div className="relative w-28 h-28 rounded-full overflow-hidden border-2 border-emerald-400 shadow-lg shadow-emerald-500/30">
                      <img 
                        src="/images/farmer_gurpreet.jpg" 
                        alt="Farmer Verified Selfie" 
                        className="w-full h-full object-cover"
                       loading="lazy" decoding="async" />
                      <div className="absolute inset-0 bg-emerald-500/10 pointer-events-none" />
                      <div className="absolute bottom-1 right-1 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-[#03060f]">
                        <CheckCircle2 className="w-4 h-4 text-slate-950 font-bold" />
                      </div>
                    </div>
                    <div className="text-center text-xs">
                      <div className="font-bold text-emerald-400 text-sm">Demo biometric state ✓</div>
                      <div className="text-slate-400 mt-0.5">No external identity match was performed</div>
                      <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded bg-emerald-900/60 text-emerald-300 font-mono">
                        Liveness: Active Pulse Detected
                      </span>
                    </div>
                  </div>
                )}
                
                <button
                  onClick={advance}
                  disabled={!DEMO_MODE || !faceScanned || loading}
                  className="ui-btn is-primary is-lg is-block"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {DEMO_MODE ? 'Confirm demo biometric state' : 'Biometric provider not configured'}
                </button>
              </>
            )}

            {DEMO_MODE && currentStep === 'BANK' && (
              <>
                <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                  <Landmark className="w-4 h-4 text-amber-400" />
                  <h4 className="font-bold text-sm text-white">Step 5: Bank details (demo)</h4>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Bank and payment-provider verification are not connected in this release. We do not ask for a real UPI ID or bank account here.
                </p>
                {!bankVerified ? (
                  <button
                    onClick={() => { if (DEMO_MODE) setBankVerified(true); }}
                    disabled={!DEMO_MODE || loading}
                    className="py-2.5 rounded-lg bg-amber-600/80 hover:bg-amber-500 disabled:opacity-40 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow transition-all"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    {DEMO_MODE ? 'Mark demo bank step complete' : 'Bank provider not configured'}
                  </button>
                ) : (
                  <div className="p-3 bg-emerald-950/50 border border-emerald-500/40 rounded-lg text-sm text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Demo bank step complete — no financial details were collected and no transaction was performed.
                  </div>
                )}
                <button
                  onClick={advance}
                  disabled={!DEMO_MODE || !bankVerified || loading}
                  className="ui-btn is-primary is-lg is-block mt-auto"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                  {DEMO_MODE ? t('Continue') : t('Bank verification unavailable')}
                </button>
              </>
            )}

            {!DEMO_MODE && currentStep === 'LAND_RECORDS' && (
              <>
                <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                  <Wheat className="w-4 h-4 text-emerald-400" />
                  <h4 className="font-bold text-sm text-white">Step 4: Register your field</h4>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Enter the field as it appears in your land record, and capture its location while you stand at the field. It is saved as farmer-declared until a verifier checks the boundary.
                </p>

                {myFields.length > 0 && (
                  <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-400">
                    <strong className="block text-[11px] font-black uppercase tracking-wide text-slate-300">Your registered fields ({myFields.length})</strong>
                    <ul className="mt-2 space-y-1">
                      {myFields.slice(0, 5).map((f) => (
                        <li key={f.id} className="flex items-center justify-between gap-3">
                          <span className="truncate">{f.khasra_no} · {f.village} · {Number(f.acreage).toFixed(2)} ac</span>
                          <span className="shrink-0 font-mono text-[10px] text-slate-500">{f.status.replace(/_/g, ' ')}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" className="ui-btn is-primary" onClick={() => onNavigate?.('FARMER_ONBOARDING')}>Book a pickup</button>
                      <button type="button" className="ui-btn" onClick={() => onNavigate?.('FARMER_SURFACE')}>{t('Connect Telegram')}</button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1" htmlFor="live-khasra">Khasra / Survey number</label>
                    <input id="live-khasra" className="ui-input font-mono" placeholder="412/1-2" value={khasra} onChange={(e) => setKhasra(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1" htmlFor="live-acres">Area (acres)</label>
                    <input id="live-acres" type="number" inputMode="decimal" min={0.01} max={500} step={0.01} className="ui-input font-mono" placeholder="3.5" value={acreage} onChange={(e) => setAcreage(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-600 block mb-1.5" htmlFor="live-village">Village</label>
                    <input id="live-village" className="ui-input" autoComplete="address-level3" placeholder="Enter field village" value={village} onChange={(e) => setVillage(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-600 block mb-1.5" htmlFor="live-block">Block / Tehsil (optional)</label>
                    <select id="live-block" className="ui-select" value={block} onChange={(e) => setBlock(e.target.value)}>
                      <option value="">Select block / tehsil</option>
                      <option>Sangrur</option><option>Sunam</option><option>Dhuri</option><option>Bhawanigarh</option><option>Dirba</option><option>Lehragaga</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-600 block mb-1.5" htmlFor="live-district">District</label>
                    <select id="live-district" className="ui-select" value={district} onChange={(e) => setDistrict(e.target.value)}>
                      {DISTRICTS.map((d) => <option key={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1" htmlFor="live-variety">Paddy variety</label>
                    <select id="live-variety" className="ui-select" value={variety} onChange={(e) => setVariety(e.target.value)}>
                      {VARIETIES.map((v) => <option key={v}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1" htmlFor="live-harvest">Expected harvest date (optional)</label>
                    <input id="live-harvest" type="date" className="ui-input" value={harvestDate} onChange={(e) => setHarvestDate(e.target.value)} />
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-300"><MapPin className="mr-1 inline h-3.5 w-3.5 text-emerald-400" />Field location</span>
                    <button type="button" className="ui-btn" onClick={useMyLocation} disabled={locating}>
                      {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                      {locating ? t('Finding location…') : t('Use my current location')}
                    </button>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <input aria-label="Latitude" inputMode="decimal" className="ui-input font-mono" placeholder="Latitude" value={lat} onChange={(e) => setLat(e.target.value)} />
                    <input aria-label="Longitude" inputMode="decimal" className="ui-input font-mono" placeholder="Longitude" value={lng} onChange={(e) => setLng(e.target.value)} />
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500">Stand inside or at the edge of the field. The location cannot be edited later, so it should match the field.</p>
                </div>

                {fieldError && <div className="text-xs text-red-300 bg-red-950/30 border border-red-500/30 rounded-lg p-2" role="alert">{fieldError}</div>}

                <button
                  type="button"
                  onClick={() => void registerField()}
                  disabled={fieldBusy || !khasra || !acreage || !lat || !lng}
                  className="ui-btn is-primary is-lg is-block mt-auto"
                >
                  {fieldBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                  {fieldBusy ? 'Saving field…' : 'Save my field'}
                </button>
              </>
            )}

            {!DEMO_MODE && currentStep === 'DONE' && (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 py-4 text-center">
                <div className="grid h-16 w-16 place-items-center rounded-full bg-emerald-500/15 text-emerald-500">
                  <CheckCircle2 className="h-9 w-9" />
                </div>
                <div>
                  <div className="text-2xl font-black text-emerald-400 font-['Outfit']">Your NIRDHOOM account is ready</div>
                  <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-slate-400">
                    {name || 'Your'} account is linked to +91 {phone}.{savedField ? ` Field ${savedField.khasra_no} (${Number(savedField.acreage).toFixed(2)} acres, ${savedField.village}) is registered and waiting for a verifier to check its boundary.` : ''}
                  </p>
                </div>
                <div className="flex w-full max-w-sm flex-col gap-2">
                  <button type="button" className="ui-btn is-primary is-lg is-block" onClick={() => onNavigate?.('FARMER_ONBOARDING')}>Book a pickup</button>
                  <button type="button" className="ui-btn is-lg is-block" onClick={() => onNavigate?.('FARMER_SURFACE')}>Connect Telegram</button>
                  <button type="button" className="ui-btn is-block" onClick={() => setCurrentStep('LAND_RECORDS')}>Add another field</button>
                </div>
              </div>
            )}

            {DEMO_MODE && currentStep === 'LAND_RECORDS' && (
              <>
                <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                  <Wheat className="w-4 h-4 text-emerald-400" />
                  <h4 className="font-bold text-sm text-white">Step 6: Land Record & Khasra Linking</h4>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">Nirdhoom links Fasal Bima (PMFBY) Khasra records to auto-populate field polygon. The farmer simply confirms their Khasra number from the village patwari register.</p>
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Khasra / Survey Number</label>
                    <input
                      className="ui-input font-mono"
                      placeholder="412/1-2"
                      value={khasra}
                      onChange={(e) => setKhasra(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Acreage (acres)</label>
                    <input
                      type="number"
                      min={0.5}
                      max={50}
                      step={0.5}
                      className="ui-input font-mono"
                      placeholder="3.5"
                      value={acreage}
                      onChange={(e) => setAcreage(e.target.value)}
                    />
                  </div>
                  <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800 text-xs text-slate-400">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400 inline mr-1.5" />
                    {DEMO_MODE ? 'Demo polygon placeholder only; no authoritative land record is queried.' : 'Live mode requires an authorized Punjab land-records data feed before a field can be created.'}
                  </div>
                </div>
                <button
                  onClick={advance}
                  disabled={!DEMO_MODE || !khasra || !acreage || loading}
                  className="ui-btn is-primary is-lg is-block mt-auto"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                  {DEMO_MODE ? 'Simulate land-record link' : 'Official cadastral provider required'}
                </button>
              </>
            )}

            {DEMO_MODE && currentStep === 'DONE' && (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 py-4">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-emerald-400 shadow-xl shadow-emerald-500/20">
                    <img 
                      src="/images/farmer_gurpreet.jpg" 
                      alt="Gurpreet Singh Brar" 
                      className="w-full h-full object-cover"
                     loading="lazy" decoding="async" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-emerald-500 border-2 border-[#03060f] flex items-center justify-center shadow">
                    <CheckCircle2 className="w-5 h-5 text-slate-950 font-black" />
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-black text-emerald-400 font-['Outfit']">ਗੁਰਪ੍ਰੀਤ ਸਿੰਘ ਰਜਿਸਟਰ ਹੋ ਗਏ!</div>
                  <p className="text-white font-bold mt-1">{name || 'Gurpreet Singh Brar'} is now registered on Nirdhoom!</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm">
                    Demo profile created · OTP verified · Khasra {khasra || '412/1-2'} ({acreage || '3.5'} ac) Mapped
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 w-full max-w-sm text-xs">
                  {[
                    { label: 'Farmer ID', value: `NRD-FMR-${Date.now().toString().slice(-6)}` },
                    { label: 'Phone verified', value: `+91 ${phone || '••••••••••'}` },
                    { label: 'Khasra', value: khasra || '412/1-2' },
                    { label: 'Acreage', value: `${acreage || '3.5'} acres` },
                  ].map((item) => (
                    <div key={item.label} className="bg-slate-900/80 border border-slate-800 rounded-lg p-2.5">
                      <div className="text-slate-400 text-[10px] uppercase font-bold">{item.label}</div>
                      <div className="text-white font-mono text-xs mt-0.5 truncate">{item.value}</div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={reset}
                  className="ui-btn is-lg"
                >
                  Register Another Farmer
                </button>
              </div>
            )}
          </div>
          {!DEMO_MODE && userId && (
            <p className="mt-3 text-center text-xs text-slate-500">
              Signed in{phone ? ` as +91 ${phone}` : ''}.{' '}
              <button type="button" className="font-bold underline" onClick={() => void signOut()}>Sign out</button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};