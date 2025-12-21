// src/lib/utils/vision2030Icons.tsx
// Centralized icon mapping for Vision 2030 sectors - replaces emoji strings with modern Lucide icons

import { type ComponentType } from 'react';
import {
    Monitor,
    Landmark,
    Heart,
    Zap,
    TrendingUp,
    Factory,
    GraduationCap,
    Building2,
    Target,
} from 'lucide-react';

// Icon component type
export type SectorIconComponent = ComponentType<{ className?: string }>;

// Map sector IDs to Lucide icon components
export const SECTOR_ICONS: Record<string, SectorIconComponent> = {
    'technology': Monitor,
    'tourism': Landmark,
    'healthcare': Heart,
    'renewable-energy': Zap,
    'finance': TrendingUp,
    'manufacturing': Factory,
    'education': GraduationCap,
    'mega-projects': Building2,
};

// Default fallback icon
export const DEFAULT_SECTOR_ICON: SectorIconComponent = Target;

// Get icon component for a sector ID
export function getSectorIcon(sectorId: string): SectorIconComponent {
    return SECTOR_ICONS[sectorId] || DEFAULT_SECTOR_ICON;
}

// Render sector icon as JSX element
interface SectorIconProps {
    sectorId: string;
    className?: string;
}

export function SectorIcon({ sectorId, className = 'w-5 h-5' }: SectorIconProps) {
    const IconComponent = getSectorIcon(sectorId);
    return <IconComponent className={className} />;
}
