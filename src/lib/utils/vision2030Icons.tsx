import React from 'react';
import {
    Code2,
    Plane,
    HeartPulse,
    Zap,
    Landmark,
    Factory,
    GraduationCap,
    HardHat,
    ShoppingBag,
    Truck,
    HelpCircle
} from 'lucide-react';
import { cn } from '../utils/cn';

interface SectorIconProps {
    sectorId: string;
    className?: string;
}

const SECTOR_ICON_MAP: Record<string, React.ElementType> = {
    'technology': Code2,
    'tourism': Plane,
    'healthcare': HeartPulse,
    'renewable-energy': Zap,
    'finance': Landmark,
    'manufacturing': Factory,
    'education': GraduationCap,
    'mega-projects': HardHat,
    'retail-ecommerce': ShoppingBag,
    'logistics': Truck,
};

export const SectorIcon: React.FC<SectorIconProps> = ({ sectorId, className }) => {
    const IconComponent = SECTOR_ICON_MAP[sectorId] || HelpCircle;

    return <IconComponent className={cn("w-5 h-5", className)} />;
};
