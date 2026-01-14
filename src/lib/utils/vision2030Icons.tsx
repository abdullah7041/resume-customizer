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

export const SectorIcon: React.FC<SectorIconProps> = ({ sectorId, className }) => {
    const iconMap: Record<string, React.ElementType> = {
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

    const IconComponent = iconMap[sectorId] || HelpCircle;

    return <IconComponent className={cn("w-5 h-5", className)} />;
};
