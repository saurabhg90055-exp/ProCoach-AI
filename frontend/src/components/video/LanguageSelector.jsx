import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Globe, Check, ChevronDown, Languages, Search, X 
} from 'lucide-react';
import './LanguageSelector.css';

// Supported languages with their codes and native names
export const SUPPORTED_LANGUAGES = [
    { code: 'en-US', name: 'English', native: 'English', flag: '🇺🇸' },
    { code: 'en-GB', name: 'English (UK)', native: 'English', flag: '🇬🇧' },
    { code: 'es-ES', name: 'Spanish', native: 'Español', flag: '🇪🇸' },
    { code: 'es-MX', name: 'Spanish (Mexico)', native: 'Español', flag: '🇲🇽' },
    { code: 'fr-FR', name: 'French', native: 'Français', flag: '🇫🇷' },
    { code: 'de-DE', name: 'German', native: 'Deutsch', flag: '🇩🇪' },
    { code: 'it-IT', name: 'Italian', native: 'Italiano', flag: '🇮🇹' },
    { code: 'pt-BR', name: 'Portuguese (Brazil)', native: 'Português', flag: '🇧🇷' },
    { code: 'pt-PT', name: 'Portuguese', native: 'Português', flag: '🇵🇹' },
    { code: 'ru-RU', name: 'Russian', native: 'Русский', flag: '🇷🇺' },
    { code: 'ja-JP', name: 'Japanese', native: '日本語', flag: '🇯🇵' },
    { code: 'ko-KR', name: 'Korean', native: '한국어', flag: '🇰🇷' },
    { code: 'zh-CN', name: 'Chinese (Simplified)', native: '简体中文', flag: '🇨🇳' },
    { code: 'zh-TW', name: 'Chinese (Traditional)', native: '繁體中文', flag: '🇹🇼' },
    { code: 'ar-SA', name: 'Arabic', native: 'العربية', flag: '🇸🇦' },
    { code: 'hi-IN', name: 'Hindi', native: 'हिन्दी', flag: '🇮🇳' },
    { code: 'nl-NL', name: 'Dutch', native: 'Nederlands', flag: '🇳🇱' },
    { code: 'pl-PL', name: 'Polish', native: 'Polski', flag: '🇵🇱' },
    { code: 'tr-TR', name: 'Turkish', native: 'Türkçe', flag: '🇹🇷' },
    { code: 'vi-VN', name: 'Vietnamese', native: 'Tiếng Việt', flag: '🇻🇳' },
    { code: 'th-TH', name: 'Thai', native: 'ไทย', flag: '🇹🇭' },
    { code: 'id-ID', name: 'Indonesian', native: 'Bahasa Indonesia', flag: '🇮🇩' },
    { code: 'ms-MY', name: 'Malay', native: 'Bahasa Melayu', flag: '🇲🇾' },
    { code: 'he-IL', name: 'Hebrew', native: 'עברית', flag: '🇮🇱' },
    { code: 'sv-SE', name: 'Swedish', native: 'Svenska', flag: '🇸🇪' },
    { code: 'da-DK', name: 'Danish', native: 'Dansk', flag: '🇩🇰' },
    { code: 'fi-FI', name: 'Finnish', native: 'Suomi', flag: '🇫🇮' },
    { code: 'no-NO', name: 'Norwegian', native: 'Norsk', flag: '🇳🇴' },
    { code: 'uk-UA', name: 'Ukrainian', native: 'Українська', flag: '🇺🇦' },
    { code: 'cs-CZ', name: 'Czech', native: 'Čeština', flag: '🇨🇿' }
];

// UI translations for common elements
export const UI_TRANSLATIONS = {
    'en-US': {
        selectLanguage: 'Select Language',
        interviewLanguage: 'Interview Language',
        search: 'Search languages...',
        start: 'Start Interview',
        stop: 'Stop Recording',
        endInterview: 'End Interview',
        pushToTalk: 'Push to Talk',
        processing: 'Processing...',
        listening: 'Listening...',
        speaking: 'Speaking...',
        yourAnswer: 'Your Answer',
        score: 'Score',
        confidence: 'Confidence',
        eyeContact: 'Eye Contact',
        emotion: 'Emotion'
    },
    'es-ES': {
        selectLanguage: 'Seleccionar Idioma',
        interviewLanguage: 'Idioma de la Entrevista',
        search: 'Buscar idiomas...',
        start: 'Iniciar Entrevista',
        stop: 'Detener Grabación',
        endInterview: 'Finalizar Entrevista',
        pushToTalk: 'Mantener para Hablar',
        processing: 'Procesando...',
        listening: 'Escuchando...',
        speaking: 'Hablando...',
        yourAnswer: 'Tu Respuesta',
        score: 'Puntuación',
        confidence: 'Confianza',
        eyeContact: 'Contacto Visual',
        emotion: 'Emoción'
    },
    'fr-FR': {
        selectLanguage: 'Sélectionner la Langue',
        interviewLanguage: "Langue de l'Entretien",
        search: 'Rechercher des langues...',
        start: "Commencer l'Entretien",
        stop: "Arrêter l'Enregistrement",
        endInterview: "Terminer l'Entretien",
        pushToTalk: 'Appuyer pour Parler',
        processing: 'Traitement...',
        listening: 'Écoute...',
        speaking: 'Parle...',
        yourAnswer: 'Votre Réponse',
        score: 'Note',
        confidence: 'Confiance',
        eyeContact: 'Contact Visuel',
        emotion: 'Émotion'
    },
    'de-DE': {
        selectLanguage: 'Sprache Auswählen',
        interviewLanguage: 'Interview-Sprache',
        search: 'Sprachen suchen...',
        start: 'Interview Starten',
        stop: 'Aufnahme Stoppen',
        endInterview: 'Interview Beenden',
        pushToTalk: 'Zum Sprechen Drücken',
        processing: 'Verarbeitung...',
        listening: 'Hört zu...',
        speaking: 'Spricht...',
        yourAnswer: 'Ihre Antwort',
        score: 'Punktzahl',
        confidence: 'Vertrauen',
        eyeContact: 'Augenkontakt',
        emotion: 'Emotion'
    },
    'ja-JP': {
        selectLanguage: '言語を選択',
        interviewLanguage: '面接言語',
        search: '言語を検索...',
        start: '面接を開始',
        stop: '録音を停止',
        endInterview: '面接を終了',
        pushToTalk: '押して話す',
        processing: '処理中...',
        listening: '聞いています...',
        speaking: '話しています...',
        yourAnswer: 'あなたの回答',
        score: 'スコア',
        confidence: '自信',
        eyeContact: 'アイコンタクト',
        emotion: '感情'
    },
    'zh-CN': {
        selectLanguage: '选择语言',
        interviewLanguage: '面试语言',
        search: '搜索语言...',
        start: '开始面试',
        stop: '停止录制',
        endInterview: '结束面试',
        pushToTalk: '按住说话',
        processing: '处理中...',
        listening: '正在听...',
        speaking: '正在说...',
        yourAnswer: '你的回答',
        score: '分数',
        confidence: '自信',
        eyeContact: '眼神交流',
        emotion: '情绪'
    },
    'hi-IN': {
        selectLanguage: 'भाषा चुनें',
        interviewLanguage: 'साक्षात्कार भाषा',
        search: 'भाषाएं खोजें...',
        start: 'साक्षात्कार शुरू करें',
        stop: 'रिकॉर्डिंग बंद करें',
        endInterview: 'साक्षात्कार समाप्त करें',
        pushToTalk: 'बोलने के लिए दबाएं',
        processing: 'प्रसंस्करण...',
        listening: 'सुन रहा है...',
        speaking: 'बोल रहा है...',
        yourAnswer: 'आपका जवाब',
        score: 'स्कोर',
        confidence: 'आत्मविश्वास',
        eyeContact: 'आंख संपर्क',
        emotion: 'भावना'
    },
    'ko-KR': {
        selectLanguage: '언어 선택',
        interviewLanguage: '인터뷰 언어',
        search: '언어 검색...',
        start: '인터뷰 시작',
        stop: '녹음 중지',
        endInterview: '인터뷰 종료',
        pushToTalk: '눌러서 말하기',
        processing: '처리 중...',
        listening: '듣는 중...',
        speaking: '말하는 중...',
        yourAnswer: '당신의 대답',
        score: '점수',
        confidence: '자신감',
        eyeContact: '눈 맞춤',
        emotion: '감정'
    },
    'ar-SA': {
        selectLanguage: 'اختر اللغة',
        interviewLanguage: 'لغة المقابلة',
        search: 'البحث عن اللغات...',
        start: 'بدء المقابلة',
        stop: 'إيقاف التسجيل',
        endInterview: 'إنهاء المقابلة',
        pushToTalk: 'اضغط للتحدث',
        processing: 'جاري المعالجة...',
        listening: 'الاستماع...',
        speaking: 'يتحدث...',
        yourAnswer: 'إجابتك',
        score: 'النتيجة',
        confidence: 'الثقة',
        eyeContact: 'التواصل البصري',
        emotion: 'العاطفة'
    }
};

// Language Context
const LanguageContext = createContext();

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};

// Language Provider
export const LanguageProvider = ({ children, defaultLanguage = 'en-US' }) => {
    const [language, setLanguage] = useState(() => {
        const saved = localStorage.getItem('interview-language');
        return saved || defaultLanguage;
    });

    // Get translation
    const t = useCallback((key) => {
        const baseLang = language.split('-')[0] + '-' + language.split('-')[1];
        const translations = UI_TRANSLATIONS[baseLang] || UI_TRANSLATIONS[language.split('-')[0]] || UI_TRANSLATIONS['en-US'];
        return translations[key] || UI_TRANSLATIONS['en-US'][key] || key;
    }, [language]);

    // Get language info
    const getLanguageInfo = useCallback((code = language) => {
        return SUPPORTED_LANGUAGES.find(l => l.code === code) || SUPPORTED_LANGUAGES[0];
    }, [language]);

    // Change language
    const changeLanguage = useCallback((code) => {
        setLanguage(code);
        localStorage.setItem('interview-language', code);
    }, []);

    // Detect browser language
    useEffect(() => {
        if (!localStorage.getItem('interview-language')) {
            const browserLang = navigator.language;
            const supported = SUPPORTED_LANGUAGES.find(
                l => l.code === browserLang || l.code.startsWith(browserLang.split('-')[0])
            );
            if (supported) {
                setLanguage(supported.code);
            }
        }
    }, []);

    return (
        <LanguageContext.Provider value={{
            language,
            setLanguage: changeLanguage,
            t,
            getLanguageInfo,
            supportedLanguages: SUPPORTED_LANGUAGES
        }}>
            {children}
        </LanguageContext.Provider>
    );
};

/**
 * Language Selector Component
 */
const LanguageSelector = ({
    value,
    onChange,
    position = 'bottom',
    showFlag = true,
    showNative = false,
    compact = false,
    disabled = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    
    const currentLanguage = SUPPORTED_LANGUAGES.find(l => l.code === value) || SUPPORTED_LANGUAGES[0];

    // Filter languages based on search
    const filteredLanguages = SUPPORTED_LANGUAGES.filter(lang =>
        lang.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lang.native.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lang.code.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleSelect = (code) => {
        onChange(code);
        setIsOpen(false);
        setSearchQuery('');
    };

    return (
        <div className={`language-selector ${compact ? 'compact' : ''}`}>
            <motion.button
                className={`selector-trigger ${isOpen ? 'open' : ''}`}
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                whileHover={{ scale: disabled ? 1 : 1.02 }}
                whileTap={{ scale: disabled ? 1 : 0.98 }}
            >
                {showFlag && <span className="language-flag">{currentLanguage.flag}</span>}
                <span className="language-name">
                    {showNative ? currentLanguage.native : currentLanguage.name}
                </span>
                <ChevronDown size={16} className={`chevron ${isOpen ? 'rotated' : ''}`} />
            </motion.button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        className={`language-dropdown ${position}`}
                        initial={{ opacity: 0, y: position === 'top' ? 10 : -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: position === 'top' ? 10 : -10, scale: 0.95 }}
                    >
                        <div className="dropdown-header">
                            <Languages size={16} />
                            <span>Select Language</span>
                            <button className="close-dropdown" onClick={() => setIsOpen(false)}>
                                <X size={14} />
                            </button>
                        </div>

                        <div className="search-container">
                            <Search size={14} />
                            <input
                                type="text"
                                placeholder="Search languages..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                autoFocus
                            />
                            {searchQuery && (
                                <button 
                                    className="clear-search"
                                    onClick={() => setSearchQuery('')}
                                >
                                    <X size={12} />
                                </button>
                            )}
                        </div>

                        <div className="languages-list">
                            {filteredLanguages.length > 0 ? (
                                filteredLanguages.map((lang) => (
                                    <button
                                        key={lang.code}
                                        className={`language-option ${value === lang.code ? 'selected' : ''}`}
                                        onClick={() => handleSelect(lang.code)}
                                    >
                                        <span className="option-flag">{lang.flag}</span>
                                        <div className="option-names">
                                            <span className="option-name">{lang.name}</span>
                                            {lang.name !== lang.native && (
                                                <span className="option-native">{lang.native}</span>
                                            )}
                                        </div>
                                        {value === lang.code && <Check size={16} className="check-icon" />}
                                    </button>
                                ))
                            ) : (
                                <div className="no-results">
                                    <Globe size={24} />
                                    <span>No languages found</span>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Backdrop */}
            {isOpen && <div className="dropdown-backdrop" onClick={() => setIsOpen(false)} />}
        </div>
    );
};

export default LanguageSelector;
