// src/components/ui/ManualDataEditor.tsx
// Manual data editor modal for resume data correction and display settings

import React, { useState, useEffect } from 'react';
import { X, Save, User, Briefcase, GraduationCap, Wrench, FolderKanban, Award, Languages, Type, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { GlassCard } from './GlassCard';
import { GlassButton } from './GlassButton';
import { useResumeStore } from '../../lib/stores/resumeStore';
import type { ResumeSchema } from '../../types/resume';

interface ManualDataEditorProps {
    isOpen: boolean;
    onClose: () => void;
}

type TabId = 'basics' | 'experience' | 'education' | 'skills' | 'projects' | 'certifications' | 'languages' | 'display';

interface TabConfig {
    id: TabId;
    labelEn: string;
    labelAr: string;
    icon: React.ElementType;
}

const TABS: TabConfig[] = [
    { id: 'basics', labelEn: 'Basics', labelAr: 'الأساسيات', icon: User },
    { id: 'experience', labelEn: 'Experience', labelAr: 'الخبرة', icon: Briefcase },
    { id: 'education', labelEn: 'Education', labelAr: 'التعليم', icon: GraduationCap },
    { id: 'skills', labelEn: 'Skills', labelAr: 'المهارات', icon: Wrench },
    { id: 'projects', labelEn: 'Projects', labelAr: 'المشاريع', icon: FolderKanban },
    { id: 'certifications', labelEn: 'Certifications', labelAr: 'الشهادات', icon: Award },
    { id: 'languages', labelEn: 'Languages', labelAr: 'اللغات', icon: Languages },
    { id: 'display', labelEn: 'Display', labelAr: 'العرض', icon: Type },
];

export function ManualDataEditor({ isOpen, onClose }: ManualDataEditorProps) {
    const { i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';

    const {
        originalResume,
        setOriginalResume,
        displayOptions,
        setDisplayOptions,
    } = useResumeStore();

    const [activeTab, setActiveTab] = useState<TabId>('basics');
    const [localResume, setLocalResume] = useState<ResumeSchema | null>(null);
    const [localFontSize, setLocalFontSize] = useState(1);
    const [hasChanges, setHasChanges] = useState(false);
    const [currentWorkIndex, setCurrentWorkIndex] = useState(0);

    // Initialize local state when modal opens
    useEffect(() => {
        if (isOpen && originalResume) {
            setLocalResume(JSON.parse(JSON.stringify(originalResume)));
            setLocalFontSize(displayOptions.fontSize);
            setHasChanges(false);
        }
    }, [isOpen, originalResume, displayOptions.fontSize]);

    if (!isOpen) return null;

    const handleSave = () => {
        if (localResume) {
            setOriginalResume(localResume);
        }
        setDisplayOptions({ fontSize: localFontSize });
        setHasChanges(false);
        onClose();
    };

    const updateBasics = (field: keyof NonNullable<ResumeSchema['basics']>, value: string) => {
        if (!localResume) return;
        setLocalResume({
            ...localResume,
            basics: {
                ...localResume.basics,
                [field]: value,
            },
        });
        setHasChanges(true);
    };

    const updateWork = (index: number, field: string, value: string | string[]) => {
        if (!localResume?.work) return;
        const updated = [...localResume.work];
        updated[index] = { ...updated[index], [field]: value };
        setLocalResume({ ...localResume, work: updated });
        setHasChanges(true);
    };

    const updateEducation = (index: number, field: string, value: string) => {
        if (!localResume?.education) return;
        const updated = [...localResume.education];
        updated[index] = { ...updated[index], [field]: value };
        setLocalResume({ ...localResume, education: updated });
        setHasChanges(true);
    };

    const updateSkillKeywords = (skillIndex: number, keywords: string) => {
        if (!localResume?.skills) return;
        const updated = [...localResume.skills];
        updated[skillIndex] = {
            ...updated[skillIndex],
            keywords: keywords.split(',').map(k => k.trim()).filter(Boolean),
        };
        setLocalResume({ ...localResume, skills: updated });
        setHasChanges(true);
    };

    const updateProject = (index: number, field: string, value: string) => {
        if (!localResume?.projects) return;
        const updated = [...localResume.projects];
        updated[index] = { ...updated[index], [field]: value };
        setLocalResume({ ...localResume, projects: updated });
        setHasChanges(true);
    };

    const updateCertificate = (index: number, field: string, value: string) => {
        if (!localResume?.certificates) return;
        const updated = [...localResume.certificates];
        updated[index] = { ...updated[index], [field]: value };
        setLocalResume({ ...localResume, certificates: updated });
        setHasChanges(true);
    };

    const updateLanguage = (index: number, field: string, value: string) => {
        if (!localResume?.languages) return;
        const updated = [...localResume.languages];
        updated[index] = { ...updated[index], [field]: value };
        setLocalResume({ ...localResume, languages: updated });
        setHasChanges(true);
    };

    const inputClass = "w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent";
    const labelClass = "block text-sm font-medium text-white/80 mb-1";

    const renderBasicsTab = () => (
        <div className="space-y-4">
            <div>
                <label className={labelClass}>{isArabic ? 'الاسم' : 'Name'}</label>
                <input
                    type="text"
                    className={inputClass}
                    value={localResume?.basics?.name || ''}
                    onChange={(e) => updateBasics('name', e.target.value)}
                />
            </div>
            <div>
                <label className={labelClass}>{isArabic ? 'العنوان المهني' : 'Professional Title'}</label>
                <input
                    type="text"
                    className={inputClass}
                    value={localResume?.basics?.label || ''}
                    onChange={(e) => updateBasics('label', e.target.value)}
                />
            </div>
            <div>
                <label className={labelClass}>{isArabic ? 'البريد الإلكتروني' : 'Email'}</label>
                <input
                    type="email"
                    className={inputClass}
                    value={localResume?.basics?.email || ''}
                    onChange={(e) => updateBasics('email', e.target.value)}
                />
            </div>
            <div>
                <label className={labelClass}>{isArabic ? 'الهاتف' : 'Phone'}</label>
                <input
                    type="text"
                    className={inputClass}
                    value={localResume?.basics?.phone || ''}
                    onChange={(e) => updateBasics('phone', e.target.value)}
                />
            </div>
            <div>
                <label className={labelClass}>{isArabic ? 'الملخص' : 'Summary'}</label>
                <textarea
                    className={`${inputClass} min-h-[100px]`}
                    value={localResume?.basics?.summary || ''}
                    onChange={(e) => updateBasics('summary', e.target.value)}
                />
            </div>
        </div>
    );

    const workCount = localResume?.work?.length || 0;

    const renderExperienceTab = () => (
        <div className="space-y-4">
            {/* Navigation Header */}
            {workCount > 0 && (
                <div className="flex items-center justify-between mb-4">
                    <span className="text-sm text-white/60">
                        {isArabic
                            ? `الخبرة ${currentWorkIndex + 1} من ${workCount}`
                            : `Experience ${currentWorkIndex + 1} of ${workCount}`}
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setCurrentWorkIndex(Math.max(0, currentWorkIndex - 1))}
                            disabled={currentWorkIndex === 0}
                            className="p-2 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            title={isArabic ? 'السابق' : 'Previous'}
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setCurrentWorkIndex(Math.min(workCount - 1, currentWorkIndex + 1))}
                            disabled={currentWorkIndex >= workCount - 1}
                            className="p-2 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            title={isArabic ? 'التالي' : 'Next'}
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            )}

            {/* Current Experience Entry */}
            {localResume?.work && localResume.work[currentWorkIndex] && (
                <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className={labelClass}>{isArabic ? 'المنصب' : 'Position'}</label>
                            <input
                                type="text"
                                className={inputClass}
                                value={localResume.work[currentWorkIndex].position || ''}
                                onChange={(e) => updateWork(currentWorkIndex, 'position', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className={labelClass}>{isArabic ? 'الشركة' : 'Company'}</label>
                            <input
                                type="text"
                                className={inputClass}
                                value={localResume.work[currentWorkIndex].name || ''}
                                onChange={(e) => updateWork(currentWorkIndex, 'name', e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className={labelClass}>{isArabic ? 'تاريخ البدء' : 'Start Date'}</label>
                            <input
                                type="text"
                                className={inputClass}
                                placeholder="YYYY-MM"
                                value={localResume.work[currentWorkIndex].startDate || ''}
                                onChange={(e) => updateWork(currentWorkIndex, 'startDate', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className={labelClass}>{isArabic ? 'تاريخ الانتهاء' : 'End Date'}</label>
                            <input
                                type="text"
                                className={inputClass}
                                placeholder={isArabic ? 'حتى الآن أو YYYY-MM' : 'Present or YYYY-MM'}
                                value={localResume.work[currentWorkIndex].endDate || ''}
                                onChange={(e) => updateWork(currentWorkIndex, 'endDate', e.target.value)}
                            />
                        </div>
                    </div>
                    <div>
                        <label className={labelClass}>{isArabic ? 'الإنجازات (سطر لكل إنجاز)' : 'Highlights (one per line)'}</label>
                        <textarea
                            className={`${inputClass} min-h-[120px]`}
                            value={(localResume.work[currentWorkIndex].highlights || []).join('\n')}
                            onChange={(e) => updateWork(currentWorkIndex, 'highlights', e.target.value.split('\n').filter(Boolean))}
                        />
                    </div>
                </div>
            )}

            {/* Quick Jump Pills */}
            {workCount > 1 && (
                <div className="flex flex-wrap gap-2 pt-2">
                    {(localResume?.work || []).map((job, index) => (
                        <button
                            key={index}
                            type="button"
                            onClick={() => setCurrentWorkIndex(index)}
                            className={`px-3 py-1.5 text-xs rounded-full border transition-all ${index === currentWorkIndex
                                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                                : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white'
                                }`}
                        >
                            {job.position?.substring(0, 20) || job.name?.substring(0, 20) || `#${index + 1}`}
                        </button>
                    ))}
                </div>
            )}

            {(!localResume?.work || localResume.work.length === 0) && (
                <p className="text-white/50 text-center py-4">{isArabic ? 'لا توجد خبرات مضافة' : 'No experience entries'}</p>
            )}
        </div>
    );

    const renderEducationTab = () => (
        <div className="space-y-6">
            {(localResume?.education || []).map((edu, index) => (
                <div key={index} className="p-4 bg-white/5 rounded-lg border border-white/10">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className={labelClass}>{isArabic ? 'المؤسسة' : 'Institution'}</label>
                            <input
                                type="text"
                                className={inputClass}
                                value={edu.institution || ''}
                                onChange={(e) => updateEducation(index, 'institution', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className={labelClass}>{isArabic ? 'الدرجة' : 'Degree'}</label>
                            <input
                                type="text"
                                className={inputClass}
                                value={edu.studyType || ''}
                                onChange={(e) => updateEducation(index, 'studyType', e.target.value)}
                            />
                        </div>
                    </div>
                    <div>
                        <label className={labelClass}>{isArabic ? 'التخصص' : 'Field of Study'}</label>
                        <input
                            type="text"
                            className={inputClass}
                            value={edu.area || ''}
                            onChange={(e) => updateEducation(index, 'area', e.target.value)}
                        />
                    </div>
                </div>
            ))}
            {(!localResume?.education || localResume.education.length === 0) && (
                <p className="text-white/50 text-center py-4">{isArabic ? 'لا يوجد تعليم مضاف' : 'No education entries'}</p>
            )}
        </div>
    );

    const renderSkillsTab = () => (
        <div className="space-y-4">
            {(localResume?.skills || []).map((skill, index) => (
                <div key={index} className="p-4 bg-white/5 rounded-lg border border-white/10">
                    <div>
                        <label className={labelClass}>{skill.name || (isArabic ? 'فئة المهارات' : 'Skill Category')}</label>
                        <input
                            type="text"
                            className={inputClass}
                            placeholder={isArabic ? 'مهارة 1، مهارة 2، مهارة 3' : 'Skill 1, Skill 2, Skill 3'}
                            value={(skill.keywords || []).join(', ')}
                            onChange={(e) => updateSkillKeywords(index, e.target.value)}
                        />
                    </div>
                </div>
            ))}
            {(!localResume?.skills || localResume.skills.length === 0) && (
                <p className="text-white/50 text-center py-4">{isArabic ? 'لا توجد مهارات مضافة' : 'No skills entries'}</p>
            )}
        </div>
    );

    const renderProjectsTab = () => (
        <div className="space-y-6">
            {(localResume?.projects || []).map((project, index) => (
                <div key={index} className="p-4 bg-white/5 rounded-lg border border-white/10">
                    <div>
                        <label className={labelClass}>{isArabic ? 'اسم المشروع' : 'Project Name'}</label>
                        <input
                            type="text"
                            className={inputClass}
                            value={project.name || ''}
                            onChange={(e) => updateProject(index, 'name', e.target.value)}
                        />
                    </div>
                    <div className="mt-4">
                        <label className={labelClass}>{isArabic ? 'الوصف' : 'Description'}</label>
                        <textarea
                            className={`${inputClass} min-h-[60px]`}
                            value={project.description || ''}
                            onChange={(e) => updateProject(index, 'description', e.target.value)}
                        />
                    </div>
                </div>
            ))}
            {(!localResume?.projects || localResume.projects.length === 0) && (
                <p className="text-white/50 text-center py-4">{isArabic ? 'لا توجد مشاريع مضافة' : 'No project entries'}</p>
            )}
        </div>
    );

    const renderCertificationsTab = () => (
        <div className="space-y-4">
            {(localResume?.certificates || []).map((cert, index) => (
                <div key={index} className="p-4 bg-white/5 rounded-lg border border-white/10">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>{isArabic ? 'اسم الشهادة' : 'Certificate Name'}</label>
                            <input
                                type="text"
                                className={inputClass}
                                value={cert.name || ''}
                                onChange={(e) => updateCertificate(index, 'name', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className={labelClass}>{isArabic ? 'جهة الإصدار' : 'Issuer'}</label>
                            <input
                                type="text"
                                className={inputClass}
                                value={cert.issuer || ''}
                                onChange={(e) => updateCertificate(index, 'issuer', e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            ))}
            {(!localResume?.certificates || localResume.certificates.length === 0) && (
                <p className="text-white/50 text-center py-4">{isArabic ? 'لا توجد شهادات مضافة' : 'No certification entries'}</p>
            )}
        </div>
    );

    const renderLanguagesTab = () => (
        <div className="space-y-4">
            {(localResume?.languages || []).map((lang, index) => (
                <div key={index} className="p-4 bg-white/5 rounded-lg border border-white/10">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>{isArabic ? 'اللغة' : 'Language'}</label>
                            <input
                                type="text"
                                className={inputClass}
                                value={lang.language || ''}
                                onChange={(e) => updateLanguage(index, 'language', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className={labelClass}>{isArabic ? 'المستوى' : 'Fluency'}</label>
                            <input
                                type="text"
                                className={inputClass}
                                value={lang.fluency || ''}
                                onChange={(e) => updateLanguage(index, 'fluency', e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            ))}
            {(!localResume?.languages || localResume.languages.length === 0) && (
                <p className="text-white/50 text-center py-4">{isArabic ? 'لا توجد لغات مضافة' : 'No language entries'}</p>
            )}
        </div>
    );

    const renderDisplayTab = () => (
        <div className="space-y-6">
            <div>
                <label className={labelClass}>
                    {isArabic ? 'حجم الخط' : 'Font Size'}: {Math.round(localFontSize * 100)}%
                </label>
                <input
                    type="range"
                    min="0.8"
                    max="1.2"
                    step="0.05"
                    value={localFontSize}
                    onChange={(e) => {
                        setLocalFontSize(parseFloat(e.target.value));
                        setHasChanges(true);
                    }}
                    className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <div className="flex justify-between text-xs text-white/50 mt-1">
                    <span>80%</span>
                    <span>100%</span>
                    <span>120%</span>
                </div>
            </div>
            <p className="text-white/60 text-sm">
                {isArabic
                    ? 'استخدم هذا الإعداد لتكبير أو تصغير النص في السيرة الذاتية.'
                    : 'Use this setting to scale text size in your resume preview and PDF.'}
            </p>
        </div>
    );

    const renderTabContent = () => {
        switch (activeTab) {
            case 'basics': return renderBasicsTab();
            case 'experience': return renderExperienceTab();
            case 'education': return renderEducationTab();
            case 'skills': return renderSkillsTab();
            case 'projects': return renderProjectsTab();
            case 'certifications': return renderCertificationsTab();
            case 'languages': return renderLanguagesTab();
            case 'display': return renderDisplayTab();
            default: return null;
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <GlassCard className="w-full max-w-4xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <h2 className="text-xl font-bold text-white">
                        {isArabic ? 'تعديل بيانات السيرة الذاتية' : 'Edit Resume Data'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-white/60 hover:text-white transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex overflow-x-auto border-b border-white/10 px-4">
                    {TABS.map((tab) => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${activeTab === tab.id
                                    ? 'text-emerald-400 border-emerald-400'
                                    : 'text-white/60 border-transparent hover:text-white/80'
                                    }`}
                            >
                                <Icon className="w-4 h-4" />
                                {isArabic ? tab.labelAr : tab.labelEn}
                            </button>
                        );
                    })}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {renderTabContent()}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-4 border-t border-white/10">
                    <p className="text-sm text-white/50">
                        {hasChanges
                            ? (isArabic ? 'لديك تغييرات غير محفوظة' : 'You have unsaved changes')
                            : (isArabic ? 'لا توجد تغييرات' : 'No changes')}
                    </p>
                    <div className="flex gap-3">
                        <GlassButton variant="secondary" onClick={onClose}>
                            {isArabic ? 'إلغاء' : 'Cancel'}
                        </GlassButton>
                        <GlassButton
                            variant="primary"
                            onClick={handleSave}
                            disabled={!hasChanges}
                            className="bg-gradient-to-r from-emerald-500 to-teal-500"
                        >
                            <Save className="w-4 h-4 me-2" />
                            {isArabic ? 'حفظ' : 'Save'}
                        </GlassButton>
                    </div>
                </div>
            </GlassCard>
        </div>
    );
}
