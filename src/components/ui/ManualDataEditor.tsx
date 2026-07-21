import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    X, Save, User, Briefcase, GraduationCap, Wrench,
    FolderKanban, Award, Languages, Plus, Trash2,
    Edit2, LayoutTemplate, Palette
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { GlassCard } from './GlassCard';
import { GlassButton } from './GlassButton';
import { GlassInput } from './GlassInput';
import { useResumeStore } from '../../lib/stores/resumeStore';
import type { ResumeSchema } from '../../types/resume';
import { cn } from '../../lib/utils/cn';

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

const renderEmptyState = (message: string) => (
    <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-gray-300 dark:border-white/10 rounded-xl bg-gray-50/50 dark:bg-white/5">
        <LayoutTemplate className="w-12 h-12 text-gray-300 dark:text-white/20 mb-4" />
        <p className="text-gray-500 dark:text-white/50">{message}</p>
    </div>
);

const TABS: TabConfig[] = [
    { id: 'basics', labelEn: 'Basics', labelAr: 'الأساسيات', icon: User },
    { id: 'experience', labelEn: 'Experience', labelAr: 'الخبرة', icon: Briefcase },
    { id: 'education', labelEn: 'Education', labelAr: 'التعليم', icon: GraduationCap },
    { id: 'skills', labelEn: 'Skills', labelAr: 'المهارات', icon: Wrench },
    { id: 'projects', labelEn: 'Projects', labelAr: 'المشاريع', icon: FolderKanban },
    { id: 'certifications', labelEn: 'Certifications', labelAr: 'الشهادات', icon: Award },
    { id: 'languages', labelEn: 'Languages', labelAr: 'اللغات', icon: Languages },
    { id: 'display', labelEn: 'Display', labelAr: 'العرض', icon: Palette },
];

export function ManualDataEditor({ isOpen, onClose }: ManualDataEditorProps) {
    const { i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    const originalResume = useResumeStore((state) => state.originalResume);
    const setOriginalResume = useResumeStore((state) => state.setOriginalResume);
    const displayOptions = useResumeStore((state) => state.displayOptions);
    const setDisplayOptions = useResumeStore((state) => state.setDisplayOptions);

    const [activeTab, setActiveTab] = useState<TabId>('basics');
    const [localResume, setLocalResume] = useState<ResumeSchema | null>(null);
    const [localFontSize, setLocalFontSize] = useState(1);
    const [hasChanges, setHasChanges] = useState(false);

    // State for list management
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [_isAddingNew, setIsAddingNew] = useState(false);

    useEffect(() => {
        if (isOpen && originalResume) {
            setLocalResume(structuredClone(originalResume));
            setLocalFontSize(displayOptions.fontSize);
            setHasChanges(false);
            setEditingIndex(null);
            setIsAddingNew(false);
        }
    }, [isOpen, originalResume, displayOptions.fontSize]);

    // Reset editing state when tab changes
    useEffect(() => {
        setEditingIndex(null);
        setIsAddingNew(false);
    }, [activeTab]);

    if (!isOpen) return null;

    const handleSave = () => {
        if (localResume) {
            setOriginalResume(localResume);
        }
        setDisplayOptions({ fontSize: localFontSize });
        setHasChanges(false);
        onClose();
    };

    const updateNestedState = (path: string, value: any) => {
        if (!localResume) return;
        const newResume = structuredClone(localResume);

        const keys = path.split('.');
        let current = newResume;
        for (let i = 0; i < keys.length - 1; i++) {
            if (!current[keys[i]]) current[keys[i]] = {};
            current = current[keys[i]];
        }
        current[keys[keys.length - 1]] = value;

        setLocalResume(newResume);
        setHasChanges(true);
    };

    // --- List Management Helpers ---

    const addItem = (section: keyof ResumeSchema, newItem: any) => {
        if (!localResume) return;
        const list = (localResume[section] as any[]) || [];
        updateNestedState(section as string, [...list, newItem]);
        setEditingIndex(list.length); // Open the new item immediately
        setIsAddingNew(false);
    };

    const removeItem = (section: keyof ResumeSchema, index: number) => {
        if (!localResume) return;
        const list = (localResume[section] as any[]) || [];
        updateNestedState(section as string, list.filter((_, i) => i !== index));
        if (editingIndex === index) setEditingIndex(null);
    };

    const updateItem = (section: keyof ResumeSchema, index: number, field: string, value: any) => {
        updateNestedState(`${section}.${index}.${field}`, value);
    };

    // --- Renderers ---

    // Helper to get/set LinkedIn URL from profiles array
    const getLinkedInUrl = () => {
        const profiles = localResume?.basics?.profiles || [];
        return profiles.find((p: any) => p.network?.toLowerCase() === 'linkedin')?.url || '';
    };

    const setLinkedInUrl = (url: string) => {
        if (!localResume) return;
        const profiles = [...(localResume.basics?.profiles || [])];
        const idx = profiles.findIndex((p: any) => p.network?.toLowerCase() === 'linkedin');
        if (idx >= 0) {
            profiles[idx] = { ...profiles[idx], url };
        } else if (url) {
            profiles.push({ network: 'LinkedIn', username: '', url });
        }
        updateNestedState('basics.profiles', profiles);
    };

    const renderBasics = () => (
        <div className="space-y-6 animate-in fade-in duration-200 ease-out">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <GlassInput
                    label={isArabic ? 'الاسم' : 'Name'}
                    value={localResume?.basics?.name || ''}
                    onChange={(e) => updateNestedState('basics.name', e.target.value)}
                />
                <GlassInput
                    label={isArabic ? 'المسمى الوظيفي' : 'Title'}
                    value={localResume?.basics?.label || ''}
                    onChange={(e) => updateNestedState('basics.label', e.target.value)}
                />
                <GlassInput
                    label={isArabic ? 'البريد الإلكتروني' : 'Email'}
                    value={localResume?.basics?.email || ''}
                    onChange={(e) => updateNestedState('basics.email', e.target.value)}
                />
                <GlassInput
                    label={isArabic ? 'الهاتف' : 'Phone'}
                    value={localResume?.basics?.phone || ''}
                    onChange={(e) => updateNestedState('basics.phone', e.target.value)}
                />
                <GlassInput
                    label={isArabic ? 'المدينة' : 'Location (City)'}
                    value={localResume?.basics?.location?.city || ''}
                    onChange={(e) => updateNestedState('basics.location.city', e.target.value)}
                    placeholder={isArabic ? 'مثال: الرياض' : 'e.g., Riyadh'}
                />
            </div>

            {/* Links Section */}
            <div className="p-4 bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl space-y-4">
                <h3 className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                    🔗 {isArabic ? 'الروابط والملفات الشخصية' : 'Links & Profiles'}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <GlassInput
                        label={isArabic ? 'رابط LinkedIn' : 'LinkedIn URL'}
                        value={getLinkedInUrl()}
                        onChange={(e) => setLinkedInUrl(e.target.value)}
                        placeholder="https://linkedin.com/in/username"
                    />
                    <GlassInput
                        label={isArabic ? 'الموقع الشخصي / Portfolio' : 'Portfolio / Website URL'}
                        value={localResume?.basics?.url || ''}
                        onChange={(e) => updateNestedState('basics.url', e.target.value)}
                        placeholder="https://yourportfolio.com"
                    />
                </div>
            </div>

            <div>
                <label htmlFor="basics-summary" className="block text-sm font-medium text-gray-700 dark:text-white/80 mb-2">
                    {isArabic ? 'الملخص المهني' : 'Professional Summary'}
                </label>
                <textarea
                    id="basics-summary"
                    className="w-full h-32 px-4 py-3 bg-white/50 dark:bg-white/5 border border-gray-300/50 dark:border-white/10 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none transition-shadow"
                    value={localResume?.basics?.summary || ''}
                    onChange={(e) => updateNestedState('basics.summary', e.target.value)}
                />
            </div>
        </div>
    );

    const renderWork = () => {
        const items = localResume?.work || [];
        const isEditing = editingIndex !== null;

        if (isEditing && editingIndex !== null) {
            const item = items[editingIndex];
            if (!item) return null;

            return (
                <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                            {isArabic ? 'تعديل الخبرة' : 'Edit Experience'}
                        </h3>
                        <GlassButton variant="ghost" size="sm" onClick={() => setEditingIndex(null)}>
                            {isArabic ? 'انتهى' : 'Done'}
                        </GlassButton>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <GlassInput
                            label={isArabic ? 'الشركة' : 'Company'}
                            value={item.name || ''}
                            onChange={(e) => updateItem('work', editingIndex, 'name', e.target.value)}
                        />
                        <GlassInput
                            label={isArabic ? 'المنصب' : 'Position'}
                            value={item.position || ''}
                            onChange={(e) => updateItem('work', editingIndex, 'position', e.target.value)}
                        />
                        <GlassInput
                            label={isArabic ? 'تاريخ البدء' : 'Start Date'}
                            value={item.startDate || ''}
                            onChange={(e) => updateItem('work', editingIndex, 'startDate', e.target.value)}
                            placeholder="YYYY-MM"
                        />
                        <GlassInput
                            label={isArabic ? 'تاريخ الانتهاء' : 'End Date'}
                            value={item.endDate || ''}
                            onChange={(e) => updateItem('work', editingIndex, 'endDate', e.target.value)}
                            placeholder={isArabic ? 'حتى الآن أو YYYY-MM' : 'Present or YYYY-MM'}
                        />
                    </div>
                    <div>
                        <label htmlFor="work-highlights" className="block text-sm font-medium text-gray-700 dark:text-white/80 mb-2">
                            {isArabic ? 'الإنجازات (واحد في كل سطر)' : 'Highlights (one per line)'}
                        </label>
                        <textarea
                            id="work-highlights"
                            className="w-full h-32 px-4 py-3 bg-white/50 dark:bg-white/5 border border-gray-300/50 dark:border-white/10 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none"
                            value={(item.highlights || []).join('\n')}
                            onChange={(e) => updateItem('work', editingIndex, 'highlights', e.target.value.split('\n'))}
                        />
                    </div>
                    <div className="flex justify-end pt-2">
                        <GlassButton variant="primary" onClick={() => setEditingIndex(null)}>
                            {isArabic ? 'حفظ التغييرات' : 'Save Changes'}
                        </GlassButton>
                    </div>
                </div>
            );
        }

        return (
            <div className="space-y-4 animate-in fade-in duration-200 ease-out">
                {items.length === 0 ? (
                    renderEmptyState(isArabic ? 'لم تتم إضافة خبرات بعد' : 'No experience added yet')
                ) : (
                    items.map((item, idx) => (
                        <div key={idx} className="group flex items-center justify-between p-4 bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl hover:border-emerald-500/30 transition-colors">
                            <div>
                                <h4 className="font-semibold text-gray-900 dark:text-white">{item.position || (isArabic ? 'منصب غير محدد' : 'Untitled Position')}</h4>
                                <p className="text-sm text-gray-500 dark:text-white/60">{item.name} • {item.startDate} - {item.endDate}</p>
                            </div>
                            <div className="flex gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    type="button"
                                    onClick={() => setEditingIndex(idx)}
                                    className="p-2 rounded-lg bg-black/5 dark:bg-white/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                                    title={isArabic ? 'تعديل' : 'Edit'}
                                    aria-label={isArabic ? 'تعديل' : 'Edit'}
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => removeItem('work', idx)}
                                    className="p-2 rounded-lg bg-black/5 dark:bg-white/10 text-red-500 dark:text-red-400 hover:bg-red-500/20 transition-colors"
                                    title={isArabic ? 'حذف' : 'Delete'}
                                    aria-label={isArabic ? 'حذف' : 'Delete'}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
                <GlassButton
                    className="w-full border-dashed border-gray-300 dark:border-white/20 hover:border-emerald-500/50 hover:text-emerald-600 dark:hover:text-emerald-400 text-gray-600 dark:text-white"
                    variant="ghost"
                    onClick={() => addItem('work', { name: '', position: '', startDate: '', endDate: '', highlights: [] })}
                >
                    <Plus className="w-4 h-4 me-2" />
                    {isArabic ? 'إضافة خبرة' : 'Add Experience'}
                </GlassButton>
            </div>
        );
    };

    const renderEducation = () => {
        const items = localResume?.education || [];
        const isEditing = editingIndex !== null;

        if (isEditing && editingIndex !== null) {
            const item = items[editingIndex];
            if (!item) return null;

            return (
                <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                            {isArabic ? 'تعديل التعليم' : 'Edit Education'}
                        </h3>
                        <GlassButton variant="ghost" size="sm" onClick={() => setEditingIndex(null)}>
                            {isArabic ? 'انتهى' : 'Done'}
                        </GlassButton>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <GlassInput
                            label={isArabic ? 'المؤسسة' : 'Institution'}
                            value={item.institution || ''}
                            onChange={(e) => updateItem('education', editingIndex, 'institution', e.target.value)}
                        />
                        <GlassInput
                            label={isArabic ? 'الدرجة العلمية' : 'Degree'}
                            value={item.studyType || ''}
                            onChange={(e) => updateItem('education', editingIndex, 'studyType', e.target.value)}
                        />
                        <GlassInput
                            label={isArabic ? 'التخصص' : 'Area of Study'}
                            value={item.area || ''}
                            onChange={(e) => updateItem('education', editingIndex, 'area', e.target.value)}
                        />
                        <div className="grid grid-cols-2 gap-2">
                            <GlassInput
                                label={isArabic ? 'تاريخ البدء' : 'Start Date'}
                                value={item.startDate || ''}
                                onChange={(e) => updateItem('education', editingIndex, 'startDate', e.target.value)}
                                placeholder="YYYY-MM"
                            />
                            <GlassInput
                                label={isArabic ? 'تاريخ الانتهاء' : 'End Date'}
                                value={item.endDate || ''}
                                onChange={(e) => updateItem('education', editingIndex, 'endDate', e.target.value)}
                                placeholder="YYYY-MM"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end pt-2">
                        <GlassButton variant="primary" onClick={() => setEditingIndex(null)}>
                            {isArabic ? 'حفظ التغييرات' : 'Save Changes'}
                        </GlassButton>
                    </div>
                </div>
            );
        }

        return (
            <div className="space-y-4 animate-in fade-in duration-200 ease-out">
                {items.length === 0 ? renderEmptyState(isArabic ? 'لم تتم إضافة تعليم بعد' : 'No education added yet') : (
                    items.map((item, idx) => (
                        <div key={idx} className="group flex items-center justify-between p-4 bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl hover:border-emerald-500/30 transition-colors">
                            <div>
                                <h4 className="font-semibold text-gray-900 dark:text-white">{item.institution || (isArabic ? 'مؤسسة غير محددة' : 'Untitled Institution')}</h4>
                                <p className="text-sm text-gray-500 dark:text-white/60">{item.studyType} in {item.area}</p>
                            </div>
                            <div className="flex gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    type="button"
                                    onClick={() => setEditingIndex(idx)}
                                    className="p-2 rounded-lg bg-black/5 dark:bg-white/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                                    aria-label={isArabic ? 'تعديل' : 'Edit'}
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => removeItem('education', idx)}
                                    className="p-2 rounded-lg bg-black/5 dark:bg-white/10 text-red-500 dark:text-red-400 hover:bg-red-500/20 transition-colors"
                                    aria-label={isArabic ? 'حذف' : 'Delete'}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
                <GlassButton
                    className="w-full border-dashed border-gray-300 dark:border-white/20 hover:border-emerald-500/50 hover:text-emerald-600 dark:hover:text-emerald-400 text-gray-600 dark:text-white"
                    variant="ghost"
                    onClick={() => addItem('education', { institution: '', studyType: '', area: '', startDate: '', endDate: '' })}
                >
                    <Plus className="w-4 h-4 me-2" />
                    {isArabic ? 'إضافة تعليم' : 'Add Education'}
                </GlassButton>
            </div>
        );
    };

    const renderSkills = () => {
        const rawSkills = localResume?.skills || [];

        // Normalize skills: handle both flat strings and object arrays
        // Backend may return ["React", "Vue"] or [{ name: "Frontend", keywords: ["React"] }]
        const items: Array<{ name: string; keywords: string[] }> = rawSkills.map((item, idx) => {
            if (typeof item === 'string') {
                // Flat string: wrap in a default category
                return { name: '', keywords: [item] };
            }
            // Object format: ensure structure is correct
            return {
                name: item.name || '',
                keywords: Array.isArray(item.keywords) ? item.keywords : []
            };
        });

        // If we have multiple flat strings, consolidate into one category
        const hasOnlyFlatStrings = rawSkills.length > 0 && rawSkills.every(s => typeof s === 'string');
        const consolidatedItems = hasOnlyFlatStrings && items.length > 0
            ? [{ name: isArabic ? 'المهارات' : 'Skills', keywords: rawSkills as string[] }]
            : items;

        // Update localResume if we consolidated (only on first render when needed)
        if (hasOnlyFlatStrings && consolidatedItems.length !== rawSkills.length) {
            // Defer state update to avoid render loop
            setTimeout(() => {
                updateNestedState('skills', consolidatedItems);
            }, 0);
        }

        return (
            <div className="space-y-4 animate-in fade-in duration-200 ease-out">
                {consolidatedItems.length === 0 ? (
                    renderEmptyState(isArabic ? 'لم تتم إضافة مهارات بعد' : 'No skills added yet')
                ) : (
                    consolidatedItems.map((item, idx) => (
                        <div key={idx} className="p-4 bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl space-y-3">
                            <div className="flex items-center justify-between">
                                <label htmlFor={`skill-category-name-${idx}`} className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                                    {item.name || (isArabic ? `فئة ${idx + 1}` : `Category ${idx + 1}`)}
                                </label>
                                <button
                                    type="button"
                                    onClick={() => removeItem('skills', idx)}
                                    className="text-gray-400 dark:text-white/40 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                                    aria-label={isArabic ? 'حذف الفئة' : 'Remove category'}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                            <GlassInput
                                id={`skill-category-name-${idx}`}
                                value={item.name || ''}
                                onChange={(e) => updateItem('skills', idx, 'name', e.target.value)}
                                placeholder={isArabic ? 'اسم الفئة (مثال: لغات البرمجة)' : 'Category Name (e.g., Programming)'}
                            />
                            <textarea
                                className="w-full min-h-[160px] px-4 py-3 bg-white/50 dark:bg-white/5 border border-gray-300/50 dark:border-white/10 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-y"
                                value={(item.keywords || []).join(', ')}
                                onChange={(e) => {
                                    const keywords = e.target.value.split(/[,،]+/).map(k => k.trim()).filter(Boolean);
                                    updateItem('skills', idx, 'keywords', keywords);
                                }}
                                placeholder={isArabic ? 'المهارات (افصل بينها بفاصلة)' : 'Skills (comma separated)'}
                            />
                        </div>
                    ))
                )}
                <GlassButton
                    className="w-full border-dashed border-gray-300 dark:border-white/20 hover:border-emerald-500/50 hover:text-emerald-600 dark:hover:text-emerald-400 text-gray-600 dark:text-white"
                    variant="ghost"
                    onClick={() => addItem('skills', { name: '', keywords: [] })}
                >
                    <Plus className="w-4 h-4 me-2" />
                    {isArabic ? 'إضافة فئة مهارات' : 'Add Skill Category'}
                </GlassButton>
            </div>
        );
    };

    const renderProjects = () => {
        const items = localResume?.projects || [];
        const isEditing = editingIndex !== null;

        if (isEditing && editingIndex !== null) {
            const item = items[editingIndex];
            if (!item) return null;

            return (
                <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                            {isArabic ? 'تعديل المشروع' : 'Edit Project'}
                        </h3>
                        <GlassButton variant="ghost" size="sm" onClick={() => setEditingIndex(null)}>
                            {isArabic ? 'انتهى' : 'Done'}
                        </GlassButton>
                    </div>
                    <GlassInput
                        label={isArabic ? 'اسم المشروع' : 'Project Name'}
                        value={item.name || ''}
                        onChange={(e) => updateItem('projects', editingIndex, 'name', e.target.value)}
                    />
                    <div>
                        <label htmlFor="project-description" className="block text-sm font-medium text-gray-700 dark:text-white/80 mb-2">
                            {isArabic ? 'الوصف' : 'Description'}
                        </label>
                        <textarea
                            id="project-description"
                            className="w-full h-32 px-4 py-3 bg-white/50 dark:bg-white/5 border border-gray-300/50 dark:border-white/10 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none"
                            value={item.description || ''}
                            onChange={(e) => updateItem('projects', editingIndex, 'description', e.target.value)}
                        />
                    </div>
                    <GlassInput
                        label={isArabic ? 'رابط' : 'URL'}
                        value={item.url || ''}
                        onChange={(e) => updateItem('projects', editingIndex, 'url', e.target.value)}
                    />
                    <div className="flex justify-end pt-2">
                        <GlassButton variant="primary" onClick={() => setEditingIndex(null)}>
                            {isArabic ? 'حفظ التغييرات' : 'Save Changes'}
                        </GlassButton>
                    </div>
                </div>
            );
        }

        return (
            <div className="space-y-4 animate-in fade-in duration-200 ease-out">
                {items.length === 0 ? renderEmptyState(isArabic ? 'لم تتم إضافة مشاريع' : 'No projects added yet') : (
                    items.map((item, idx) => (
                        <div key={idx} className="group flex items-center justify-between p-4 bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl hover:border-emerald-500/30 transition-colors">
                            <div>
                            <h4 className="font-semibold text-gray-900 dark:text-white">{item.name || (isArabic ? 'مشروع بدون عنوان' : 'Untitled Project')}</h4>
                                <p className="text-sm text-gray-500 dark:text-white/60 line-clamp-1">{item.description}</p>
                            </div>
                            <div className="flex gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                <button type="button" onClick={() => setEditingIndex(idx)} className="p-2 rounded-lg bg-black/5 dark:bg-white/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20" aria-label={isArabic ? 'تعديل' : 'Edit'}><Edit2 className="w-4 h-4" /></button>
                                <button type="button" onClick={() => removeItem('projects', idx)} className="p-2 rounded-lg bg-black/5 dark:bg-white/10 text-red-500 dark:text-red-400 hover:bg-red-500/20" aria-label={isArabic ? 'حذف' : 'Delete'}><Trash2 className="w-4 h-4" /></button>
                            </div>
                        </div>
                    ))
                )}
                <GlassButton
                    className="w-full border-dashed border-gray-300 dark:border-white/20 hover:border-emerald-500/50 hover:text-emerald-600 dark:hover:text-emerald-400 text-gray-600 dark:text-white"
                    variant="ghost"
                    onClick={() => addItem('projects', { name: '', description: '', url: '' })}
                >
                    <Plus className="w-4 h-4 me-2" />
                    {isArabic ? 'إضافة مشروع' : 'Add Project'}
                </GlassButton>
            </div>
        );
    };

    const renderCertifications = () => {
        const items = localResume?.certificates || [];
        const isEditing = editingIndex !== null;

        if (isEditing && editingIndex !== null) {
            const item = items[editingIndex];
            if (!item) return null;

            return (
                <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                            {isArabic ? 'تعديل الشهادة' : 'Edit Certification'}
                        </h3>
                        <GlassButton variant="ghost" size="sm" onClick={() => setEditingIndex(null)}>
                            {isArabic ? 'انتهى' : 'Done'}
                        </GlassButton>
                    </div>
                    <GlassInput
                        label={isArabic ? 'اسم الشهادة' : 'Certification Name'}
                        value={item.name || ''}
                        onChange={(e) => updateItem('certificates', editingIndex, 'name', e.target.value)}
                    />
                    <GlassInput
                        label={isArabic ? 'جهة الإصدار' : 'Issuer'}
                        value={item.issuer || ''}
                        onChange={(e) => updateItem('certificates', editingIndex, 'issuer', e.target.value)}
                    />
                    <GlassInput
                        label={isArabic ? 'التاريخ' : 'Date'}
                        value={item.date || ''}
                        onChange={(e) => updateItem('certificates', editingIndex, 'date', e.target.value)}
                        placeholder="YYYY-MM"
                    />
                    <div className="flex justify-end pt-2">
                        <GlassButton variant="primary" onClick={() => setEditingIndex(null)}>
                            {isArabic ? 'حفظ التغييرات' : 'Save Changes'}
                        </GlassButton>
                    </div>
                </div>
            );
        }

        return (
            <div className="space-y-4 animate-in fade-in duration-200 ease-out">
                {items.length === 0 ? renderEmptyState(isArabic ? 'لا توجد شهادات' : 'No certifications added') : (
                    items.map((item, idx) => (
                        <div key={idx} className="group flex items-center justify-between p-4 bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl hover:border-emerald-500/30 transition-colors">
                            <div>
                                <h4 className="font-semibold text-gray-900 dark:text-white">{item.name || 'Untitled'}</h4>
                                <p className="text-sm text-gray-500 dark:text-white/60">{item.issuer}</p>
                            </div>
                            <div className="flex gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                <button type="button" onClick={() => setEditingIndex(idx)} className="p-2 rounded-lg bg-black/5 dark:bg-white/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20" aria-label={isArabic ? 'تعديل' : 'Edit'}><Edit2 className="w-4 h-4" /></button>
                                <button type="button" onClick={() => removeItem('certificates', idx)} className="p-2 rounded-lg bg-black/5 dark:bg-white/10 text-red-500 dark:text-red-400 hover:bg-red-500/20" aria-label={isArabic ? 'حذف' : 'Delete'}><Trash2 className="w-4 h-4" /></button>
                            </div>
                        </div>
                    ))
                )}
                <GlassButton
                    className="w-full border-dashed border-gray-300 dark:border-white/20 hover:border-emerald-500/50 hover:text-emerald-600 dark:hover:text-emerald-400 text-gray-600 dark:text-white"
                    variant="ghost"
                    onClick={() => addItem('certificates', { name: '', issuer: '', date: '' })}
                >
                    <Plus className="w-4 h-4 me-2" />
                    {isArabic ? 'إضافة شهادة' : 'Add Certification'}
                </GlassButton>
            </div>
        );
    };

    const renderLanguages = () => {
        const items = localResume?.languages || [];
        const isEditing = editingIndex !== null;

        if (isEditing && editingIndex !== null) {
            const item = items[editingIndex];
            if (!item) return null;

            return (
                <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                            {isArabic ? 'تعديل اللغة' : 'Edit Language'}
                        </h3>
                        <GlassButton variant="ghost" size="sm" onClick={() => setEditingIndex(null)}>
                            {isArabic ? 'انتهى' : 'Done'}
                        </GlassButton>
                    </div>
                    <GlassInput
                        label={isArabic ? 'اللغة' : 'Language'}
                        value={item.language || ''}
                        onChange={(e) => updateItem('languages', editingIndex, 'language', e.target.value)}
                    />
                    <GlassInput
                        label={isArabic ? 'المستوى' : 'Fluency'}
                        value={item.fluency || ''}
                        onChange={(e) => updateItem('languages', editingIndex, 'fluency', e.target.value)}
                        placeholder={isArabic ? 'لغة أم، متقدم، مبتدئ...' : 'Native, Fluent, Beginner...'}
                    />
                    <div className="flex justify-end pt-2">
                        <GlassButton variant="primary" onClick={() => setEditingIndex(null)}>
                            {isArabic ? 'حفظ التغييرات' : 'Save Changes'}
                        </GlassButton>
                    </div>
                </div>
            );
        }

        return (
            <div className="space-y-4 animate-in fade-in duration-200 ease-out">
                {items.length === 0 ? renderEmptyState(isArabic ? 'لا توجد لغات' : 'No languages added') : (
                    items.map((item, idx) => (
                        <div key={idx} className="group flex items-center justify-between p-4 bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl hover:border-emerald-500/30 transition-colors">
                            <div>
                                <h4 className="font-semibold text-gray-900 dark:text-white">{item.language || (isArabic ? 'غير محدد' : 'Unknown')}</h4>
                                <p className="text-sm text-gray-500 dark:text-white/60">{item.fluency}</p>
                            </div>
                            <div className="flex gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                <button type="button" onClick={() => setEditingIndex(idx)} className="p-2 rounded-lg bg-black/5 dark:bg-white/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20" aria-label={isArabic ? 'تعديل' : 'Edit'}><Edit2 className="w-4 h-4" /></button>
                                <button type="button" onClick={() => removeItem('languages', idx)} className="p-2 rounded-lg bg-black/5 dark:bg-white/10 text-red-500 dark:text-red-400 hover:bg-red-500/20" aria-label={isArabic ? 'حذف' : 'Delete'}><Trash2 className="w-4 h-4" /></button>
                            </div>
                        </div>
                    ))
                )}
                <GlassButton
                    className="w-full border-dashed border-gray-300 dark:border-white/20 hover:border-emerald-500/50 hover:text-emerald-600 dark:hover:text-emerald-400 text-gray-600 dark:text-white"
                    variant="ghost"
                    onClick={() => addItem('languages', { language: '', fluency: '' })}
                >
                    <Plus className="w-4 h-4 me-2" />
                    {isArabic ? 'إضافة لغة' : 'Add Language'}
                </GlassButton>
            </div>
        );
    };

    const renderDisplay = () => (
        <div className="space-y-6 animate-in fade-in duration-200 ease-out">
            <div className="p-6 bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">{isArabic ? 'حجم الخط' : 'Font Size'}</h3>
                    <span className="px-3 py-1 bg-black/5 dark:bg-white/10 rounded-full text-sm text-emerald-600 dark:text-emerald-400 font-mono">
                        {Math.round(localFontSize * 100)}%
                    </span>
                </div>

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
                    aria-label={isArabic ? 'حجم الخط' : 'Font Size'}
                    className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />

                <div className="flex justify-between text-xs text-gray-500 dark:text-white/50">
                    <span>{isArabic ? 'صغير (80%)' : 'Small (80%)'}</span>
                    <span>{isArabic ? 'قياسي (100%)' : 'Standard (100%)'}</span>
                    <span>{isArabic ? 'كبير (120%)' : 'Large (120%)'}</span>
                </div>
                <p className="text-sm text-gray-500 dark:text-white/50 pt-2 border-t border-gray-200 dark:border-white/5">
                    {isArabic
                        ? 'يتحكم هذا الإعداد في كثافة المعلومات في السيرة الذاتية.'
                        : 'This controls the information density of your resume.'}
                </p>

                {/* Live Font Size Preview */}
                <div className="mt-4 p-4 bg-white dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/10">
                    <p className="text-xs text-gray-500 dark:text-white/40 mb-2">
                        {isArabic ? 'معاينة حجم الخط:' : 'Font Size Preview:'}
                    </p>
                    <div
                        className="bg-white text-gray-900 p-3 rounded-md"
                        style={{ fontSize: `${10.5 * localFontSize}pt`, lineHeight: '1.55' }}
                    >
                        <p className="font-bold" style={{ fontSize: `${14 * localFontSize}pt` }}>
                            {isArabic ? 'الخبرة العملية' : 'Experience'}
                        </p>
                        <p className="text-gray-600">
                            {isArabic ? 'مطور برمجيات أول في شركة التقنية' : 'Senior Developer at Tech Company'}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderContent = () => {
        switch (activeTab) {
            case 'basics': return renderBasics();
            case 'experience': return renderWork();
            case 'education': return renderEducation();
            case 'skills': return renderSkills();
            case 'projects': return renderProjects();
            case 'certifications': return renderCertifications();
            case 'languages': return renderLanguages();
            case 'display': return renderDisplay();
            default: return null;
        }
    };

    const content = (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-900/40 dark:bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
            <GlassCard className="w-full max-w-5xl h-[85vh] flex overflow-hidden p-0 border-gray-300 dark:border-white/10 shadow-2xl bg-white/80 dark:bg-white/5">

                {/* Sidebar Navigation */}
                <div className="w-20 md:w-64 flex-shrink-0 border-r border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 flex flex-col">
                    <div className="p-6 border-b border-gray-200 dark:border-white/10 hidden md:block">
                        <h2 className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-500 dark:from-emerald-400 dark:to-teal-400 text-transparent bg-clip-text">
                            {isArabic ? 'المحرر' : 'Editor'}
                        </h2>
                    </div>

                    <div className="flex-1 overflow-y-auto py-4 space-y-1">
                        {TABS.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setActiveTab(tab.id)}
                                    className={cn(
                                        "w-full flex items-center gap-3 px-6 py-3 transition-colors relative",
                                        isActive
                                            ? "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-500/10"
                                            : "text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-white/60 dark:hover:text-white dark:hover:bg-white/5"
                                    )}
                                >
                                    {isActive && (
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 rounded-r-full" />
                                    )}
                                    <Icon className={cn("w-5 h-5", isActive && "text-emerald-600 dark:text-emerald-400")} />
                                    <span className="hidden md:block font-medium">
                                        {isArabic ? tab.labelAr : tab.labelEn}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="p-4 border-t border-gray-200 dark:border-white/10 md:hidden flex justify-center">
                        <button type="button" onClick={onClose} className="p-2 text-gray-500 dark:text-white/50 hover:text-gray-900 dark:hover:text-white" aria-label={isArabic ? 'إغلاق' : 'Close'}>
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col min-w-0 bg-gradient-to-br from-white to-gray-50 dark:from-white/5 dark:to-transparent">
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-white/10">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                                {isArabic
                                    ? TABS.find(t => t.id === activeTab)?.labelAr
                                    : TABS.find(t => t.id === activeTab)?.labelEn}
                            </h2>
                            <p className="text-sm text-gray-500 dark:text-white/50 hidden md:block">
                                {isArabic ? 'قم بتخصيص سيرتك الذاتية بسهولة' : 'Customize your resume details'}
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <GlassButton variant="ghost" onClick={onClose} className="hidden md:flex">
                                {isArabic ? 'إلغاء' : 'Cancel'}
                            </GlassButton>
                            <GlassButton
                                variant="primary"
                                onClick={handleSave}
                                disabled={!hasChanges}
                                className={cn(
                                    "min-w-[100px] transition-[color,background-color,border-color,opacity]",
                                    hasChanges ? "opacity-100 translate-y-0" : "opacity-50"
                                )}
                            >
                                <Save className="w-4 h-4 me-2" />
                                {isArabic ? 'حفظ' : 'Save'}
                            </GlassButton>
                        </div>
                    </div>

                    {/* Scrollable Form Content */}
                    <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                        <div className="max-w-3xl mx-auto">
                            {renderContent()}
                        </div>
                    </div>
                </div>
            </GlassCard>
        </div>
    );

    // Use createPortal to render the modal at the document body level
    // This ensures it is always on top of other content and not affected by z-index contexts of parent elements
    return typeof document !== 'undefined'
        ? createPortal(content, document.body)
        : null;
}
