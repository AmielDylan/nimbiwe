import { TextStyle } from 'react-native';

// Palette de couleurs basée sur les maquettes
export const colors = {
    primary: '#2563EB',
    primaryLight: '#60A5FA',
    background: '#F5F5F7',
    cardBackground: '#FFFFFF',
    textPrimary: '#1A1A1A',
    textSecondary: '#6B7280',
    textLight: '#9CA3AF',
    success: '#10B981',
    error: '#EF4444',
    warning: '#F59E0B',
    info: '#3B82F6',
    priceGreen: '#059669',
    inputBorder: '#E5E7EB',
    inputBackground: '#F9FAFB',
    white: '#FFFFFF',
};

export const spacing = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
};

export const borderRadius = {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    round: 999,
    full: 999,
};

// Objets de style de base (pas de fonctions, juste des objets)
// À utiliser avec StyleSheet.flatten([baseStyles.h1, {color: 'red'}])
export const baseStyles = {
    h1: {
        fontSize: 28,
        fontWeight: '700' as TextStyle['fontWeight'],
    },
    h2: {
        fontSize: 24,
        fontWeight: '700' as TextStyle['fontWeight'],
    },
    h3: {
        fontSize: 20,
        fontWeight: '600' as TextStyle['fontWeight'],
    },
    body: {
        fontSize: 16,
        fontWeight: '400' as TextStyle['fontWeight'],
    },
    bodySmall: {
        fontSize: 14,
        fontWeight: '400' as TextStyle['fontWeight'],
    },
    caption: {
        fontSize: 12,
        fontWeight: '400' as TextStyle['fontWeight'],
    },
    price: {
        fontSize: 24,
        fontWeight: '700' as TextStyle['fontWeight'],
    },
    button: {
        fontSize: 16,
        fontWeight: '600' as TextStyle['fontWeight'],
    },
};
