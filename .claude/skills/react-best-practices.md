# React 19 Best Practices

> **Project Stack:** React 19, Vite 7, TypeScript, Zustand, i18next

---

## Component Architecture

### File Structure
```
src/components/
├── ui/              # Reusable primitives (Button, Input, Card)
├── sections/        # Page sections (UploadSection, MatchSection)
├── templates/       # Resume templates
├── Layout/          # Layout components (Header, Footer)
└── shared/          # Cross-cutting (ErrorBoundary, LoadingSpinner)
```

### Component Template
```tsx
// 1. Imports (external → internal → types → styles)
import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useResumeStore } from '@/lib/stores/resumeStore';
import type { ResumeSchema } from '@/types/resume';

// 2. Types (co-located for component-specific types)
interface ResumeCardProps {
  resume: ResumeSchema;
  onEdit: (id: string) => void;
  isSelected?: boolean;
}

// 3. Component
export function ResumeCard({ resume, onEdit, isSelected = false }: ResumeCardProps) {
  const { t } = useTranslation();
  
  // 4. Hooks (state, refs, custom hooks)
  const [isExpanded, setIsExpanded] = useState(false);
  
  // 5. Derived state / memoized values
  const displayName = useMemo(() => 
    resume.basics?.name ?? t('common.unnamed'),
    [resume.basics?.name, t]
  );
  
  // 6. Callbacks
  const handleEdit = useCallback(() => {
    onEdit(resume.id);
  }, [onEdit, resume.id]);
  
  // 7. Early returns (loading, error, empty states)
  if (!resume.basics) {
    return <EmptyState message={t('resume.noBasics')} />;
  }
  
  // 8. Render
  return (
    <div className={cn('p-4 rounded-xl', isSelected && 'ring-2 ring-emerald-500')}>
      <h3 className="text-lg font-semibold">{displayName}</h3>
      <button onClick={handleEdit}>{t('common.edit')}</button>
    </div>
  );
}
```

---

## React 19 Specific Patterns

### Refs as Props (No More forwardRef)
```tsx
// React 19 - ref is just a prop now
interface InputProps {
  ref?: React.Ref<HTMLInputElement>;
  value: string;
  onChange: (value: string) => void;
}

export function Input({ ref, value, onChange }: InputProps) {
  return (
    <input 
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

// Usage
const inputRef = useRef<HTMLInputElement>(null);
<Input ref={inputRef} value={text} onChange={setText} />
```

### use() Hook for Promises (React 19)
```tsx
import { use, Suspense } from 'react';

// Can read promises directly
function ResumeData({ resumePromise }: { resumePromise: Promise<ResumeSchema> }) {
  const resume = use(resumePromise); // Suspends until resolved
  return <ResumePreview data={resume} />;
}

// Wrap with Suspense
<Suspense fallback={<LoadingSpinner />}>
  <ResumeData resumePromise={fetchResume(id)} />
</Suspense>
```

### Actions (React 19 Form Handling)
```tsx
// Server-like actions work in client components too
function ContactForm() {
  const [state, formAction, isPending] = useActionState(submitContact, null);
  
  return (
    <form action={formAction}>
      <input name="email" type="email" required />
      <button type="submit" disabled={isPending}>
        {isPending ? t('common.sending') : t('common.submit')}
      </button>
      {state?.error && <p className="text-red-500">{state.error}</p>}
    </form>
  );
}

async function submitContact(prevState: unknown, formData: FormData) {
  const email = formData.get('email');
  // Process...
  return { success: true };
}
```

---

## State Management

### Local State (UI-only)
```tsx
// Toggles, form inputs, local UI state
const [isOpen, setIsOpen] = useState(false);
const [searchQuery, setSearchQuery] = useState('');
```

### Zustand Store (Shared/Global)
```tsx
// src/lib/stores/resumeStore.ts
import { create } from 'zustand';
import type { ResumeSchema } from '@/types/resume';

interface ResumeState {
  resume: ResumeSchema | null;
  optimizedResume: ResumeSchema | null;
  isOptimizing: boolean;
  setResume: (resume: ResumeSchema) => void;
  setOptimizedResume: (resume: ResumeSchema) => void;
  reset: () => void;
}

export const useResumeStore = create<ResumeState>((set) => ({
  resume: null,
  optimizedResume: null,
  isOptimizing: false,
  setResume: (resume) => set({ resume }),
  setOptimizedResume: (optimizedResume) => set({ optimizedResume, isOptimizing: false }),
  reset: () => set({ resume: null, optimizedResume: null, isOptimizing: false }),
}));

// Usage in component
const { resume, setResume } = useResumeStore();
```

---

## Internationalization (i18n)

### Every Text Must Use Translations
```tsx
// ❌ FORBIDDEN
<h1>Upload Your Resume</h1>
<button>Submit</button>

// ✅ CORRECT
const { t } = useTranslation();
<h1>{t('upload.title')}</h1>
<button>{t('common.submit')}</button>
```

### Translation File Structure
```json
// src/locales/en.json
{
  "common": {
    "submit": "Submit",
    "cancel": "Cancel",
    "loading": "Loading..."
  },
  "upload": {
    "title": "Upload Your Resume",
    "dropzone": "Drag & drop your resume here",
    "formats": "Supported: PDF, DOCX"
  }
}

// src/locales/ar.json
{
  "common": {
    "submit": "إرسال",
    "cancel": "إلغاء",
    "loading": "جاري التحميل..."
  },
  "upload": {
    "title": "ارفع سيرتك الذاتية",
    "dropzone": "اسحب وأفلت سيرتك الذاتية هنا",
    "formats": "الصيغ المدعومة: PDF, DOCX"
  }
}
```

### RTL Direction Hook
```tsx
// Use with Arabic language
const { i18n } = useTranslation();
const isRTL = i18n.language === 'ar';
const direction = isRTL ? 'rtl' : 'ltr';

// Apply to container
<div dir={direction} className={isRTL ? 'font-arabic' : 'font-sans'}>
```

---

## Performance Patterns

### Memoization
```tsx
// Expensive calculations
const sortedItems = useMemo(() => 
  items.sort((a, b) => b.score - a.score),
  [items]
);

// Callbacks passed to children
const handleSelect = useCallback((id: string) => {
  setSelectedId(id);
}, []);

// Components that render often with same props
const MemoizedList = React.memo(ItemList);
```

### Code Splitting
```tsx
// Route-level splitting
const TemplatesSection = lazy(() => import('@/components/sections/TemplatesSection'));

// Feature-level splitting
const PDFExport = lazy(() => import('@/components/templates/ResumePDFDocument'));

// Always wrap with Suspense
<Suspense fallback={<LoadingSpinner />}>
  <TemplatesSection />
</Suspense>
```

### Avoid Inline Objects/Arrays in Render
```tsx
// ❌ Creates new reference every render
<Button style={{ marginTop: 10 }} options={['a', 'b']} />

// ✅ Stable references
const buttonStyle = { marginTop: 10 };
const options = ['a', 'b'];
<Button style={buttonStyle} options={options} />

// ✅ Or use Tailwind classes
<Button className="mt-2" />
```

---

## Event Handlers

### Naming Convention
```tsx
// Internal handlers: handle[Action]
const handleClick = () => { ... };
const handleSubmit = () => { ... };
const handleResumeUpload = () => { ... };

// Props: on[Action]
interface Props {
  onClick: () => void;
  onSubmit: (data: FormData) => void;
  onResumeUpload: (file: File) => void;
}
```

### Form Handling
```tsx
// Controlled inputs
const [email, setEmail] = useState('');

<input 
  value={email}
  onChange={(e) => setEmail(e.target.value)}
/>

// Form submission
const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  // Process form...
};
```

---

## Error Handling

### Error Boundaries
```tsx
// Wrap sections that might fail
<ErrorBoundary fallback={<ErrorFallback />}>
  <ResumeOptimizer />
</ErrorBoundary>
```

### Async Error Handling
```tsx
const [error, setError] = useState<string | null>(null);

const handleOptimize = async () => {
  try {
    setError(null);
    const result = await api.optimize(resume);
    setOptimizedResume(result);
  } catch (err) {
    setError(err instanceof Error ? err.message : t('errors.unknown'));
  }
};
```

---

## Lists and Keys

### Always Use Unique Keys
```tsx
// ❌ FORBIDDEN - index as key (causes bugs on reorder)
{items.map((item, index) => (
  <Item key={index} data={item} />
))}

// ✅ CORRECT - stable unique identifier
{items.map((item) => (
  <Item key={item.id} data={item} />
))}

// ✅ If no ID, create composite key
{experiences.map((exp) => (
  <WorkItem key={`${exp.company}-${exp.startDate}`} data={exp} />
))}
```

---

## Quick Checklist

Before submitting any component:
- [ ] All text uses `t()` translations
- [ ] Props interface defined with explicit types
- [ ] Unique `key` props on all mapped elements
- [ ] `useCallback` for handlers passed to children
- [ ] `useMemo` for expensive computations
- [ ] Error states handled
- [ ] Loading states handled
- [ ] RTL-compatible (logical properties in Tailwind)