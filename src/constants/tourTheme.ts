import type { Styles } from 'react-joyride';

export const tourStyles: Partial<Styles> = {
    tooltip: {
        fontSize: '15px',
        padding: '24px',
        borderRadius: '16px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    },
    tooltipContainer: {
        textAlign: 'left',
    },
    tooltipTitle: {
        fontSize: '18px',
        fontWeight: '700',
        marginBottom: '12px',
        color: '#065F46', // Emerald-800
    },
    tooltipContent: {
        color: '#374151', // Gray-700
        lineHeight: '1.6',
    },
    // v3: buttonNext → buttonPrimary
    buttonPrimary: {
        backgroundColor: '#10B981', // Emerald-500
        color: '#ffffff',
        fontSize: '14px',
        fontWeight: '600',
        padding: '10px 20px',
        borderRadius: '8px',
        border: 'none',
        outline: 'none',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2), 0 2px 4px -1px rgba(16, 185, 129, 0.1)',
    },
    buttonBack: {
        color: '#6B7280', // Gray-500
        fontSize: '14px',
        fontWeight: '500',
        marginRight: '12px',
        cursor: 'pointer',
    },
    buttonSkip: {
        color: '#9CA3AF', // Gray-400
        fontSize: '13px',
        fontWeight: '500',
        cursor: 'pointer',
    },
    // v3: spotlight is part of overlay now — keep for compat
    overlay: {
        borderRadius: '12px',
    },
};
