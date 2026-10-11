import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type AppLanguage = 'en' | 'hi';
type LanguageContextValue = { language: AppLanguage; setLanguage: (language: AppLanguage) => void; t: (english: string) => string };

const translations: Record<string, string> = {
  'Home':'होम','My Fields':'मेरे खेत','Book Parali Pickup':'पराली उठवाएँ','Track My Machine':'मशीन ट्रैक करें','Parali Market':'पराली बाज़ार','More':'और विकल्प','Language':'भाषा',
  'Harvest Timing':'फसल कटाई का समय','Field Details':'खेत का विवरण','Check My Proof':'मेरे प्रमाण देखें','Why It Matters':'यह क्यों ज़रूरी है','Machine Worker':'मशीन ऑपरेटर','Telegram Help':'टेलीग्राम सहायता','My Profile':'मेरी प्रोफ़ाइल','Buyers':'खरीदार',
  'Field network':'खेत नेटवर्क','Crop-residue field network':'फसल अवशेष नेटवर्क','Sample records':'नमूना रिकॉर्ड','Connected records':'जुड़े हुए रिकॉर्ड','Explore NIRDHOOM':'NIRDHOOM देखें','Machines, proof, buyers and account tools.':'मशीनें, प्रमाण, खरीदार और खाते के विकल्प।',
  'Pool verified residue for offtake':'सत्यापित पराली को बिक्री के लिए समूहित करें','Residue-first marketplace':'पराली बाज़ार','Field-derived supply':'खेत से उपलब्ध आपूर्ति','Buyer demand':'खरीदार की माँग','Residue Supply & Deal Pools':'पराली आपूर्ति और सौदे के समूह','No verified field supply yet':'अभी तक कोई सत्यापित पराली उपलब्ध नहीं','Verified residue lots will appear here when they are ready for pooling.':'सत्यापित पराली उपलब्ध होने पर यहाँ दिखाई जाएगी।','No buyer demand published yet':'अभी खरीदार की माँग उपलब्ध नहीं है','Open buyer requirements will appear here with quantity, pickup window and radius.':'खरीदार की मात्रा, उठाने की तारीख और दूरी की जानकारी यहाँ दिखाई जाएगी।','Create pool':'समूह बनाएँ','Join pool':'समूह में शामिल हों','Pool full':'समूह पूरा है','Quantity to commit (tonnes)':'जोड़ने की मात्रा (टन)','Price not established':'कीमत उपलब्ध नहीं','not verified':'सत्यापित नहीं','not set':'तय नहीं','No sale or payment was executed.':'कोई बिक्री या भुगतान नहीं हुआ।',
  'Harvest pressure planning — illustrative':'फसल कटाई योजना — उदाहरण','Planning model • provider data required':'योजना मॉडल • स्रोत डेटा आवश्यक','Harvest Horizon Slider:':'फसल कटाई की समय-सीमा:','Automated Fleet Pre-Positioning Advisory':'मशीनों की अग्रिम तैनाती सलाह','illustrative planning records':'उदाहरण के लिए योजना डेटा',
  'Multi-offtake planning simulator':'कई खरीदारों के लिए योजना सिम्युलेटर','Interactive Lot Offtake Router':'पराली खरीदार मिलान','Demo quality-matching simulator':'उदाहरण आधारित गुणवत्ता मिलान','Straw Moisture Level:':'पराली में नमी:','Demo comparison only':'केवल उदाहरण की तुलना','ILLUSTRATIVE SCENARIO':'उदाहरण परिदृश्य',
  'Field-derived supply':'खेत से उपलब्ध आपूर्ति','Pool':'समूह','FIELD':'खेत','BUYER':'खरीदार','POOL':'समूह','Pickup by':'उठाने की अंतिम तारीख','Moisture:':'नमी:','Ready':'तैयार','Refresh':'रीफ़्रेश करें','Search fields':'खेत खोजें','Layers':'मानचित्र परतें','Machines':'मशीनें','Fields':'खेत','Buyers':'खरीदार','Storage yards':'भंडारण केंद्र','Route':'मार्ग','Weather':'मौसम','Locate me':'मेरी स्थिति दिखाएँ',
  'Book clearance':'पराली उठाने की बुकिंग','Track the operation':'काम की स्थिति देखें','Capture evidence':'प्रमाण दर्ज करें','READY':'तैयार','NOT CONFIGURED':'सेट नहीं है','CHECKING':'जाँच जारी है',
  'Reload NIRDHOOM':'NIRDHOOM फिर से खोलें','The dashboard could not render.':'डैशबोर्ड नहीं खुल पाया।','Refresh once. If the problem persists, send this error to the developer:':'एक बार रीफ़्रेश करें। समस्या बनी रहे तो यह त्रुटि डेवलपर को भेजें:',
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(() => {
    if (typeof window === 'undefined') return 'en';
    return window.localStorage.getItem('nirdhoom.farmer.language') === 'hi' ? 'hi' : 'en';
  });

  const setLanguage = useCallback((next: AppLanguage) => {
    setLanguageState(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('nirdhoom.farmer.language', next);
      window.dispatchEvent(new CustomEvent('nirdhoom:language-change', { detail: next }));
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.setAttribute('data-app-language', language);
  }, [language]);

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage,
    t: (english: string) => language === 'hi' ? (translations[english] || english) : english,
  }), [language, setLanguage]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useAppLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error('useAppLanguage must be used inside LanguageProvider');
  return value;
}
