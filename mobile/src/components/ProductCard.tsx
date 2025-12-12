import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Product } from '../types';
import { colors, baseStyles, spacing, borderRadius } from '../constants/theme';

interface ProductCardProps {
    product: Product;
    onPress: () => void;
    priceData?: {
        value: string | number;
        unit: string;
        timeAgo: string;
    };
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onPress, priceData }) => {
    // Debug logging for category/emoji
    const emoji = getProductEmoji(product.category || '', product.name);

    return (
        <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
            <View style={styles.imageContainer}>
                <Text style={styles.imagePlaceholder}>{emoji}</Text>
            </View>

            <View style={styles.content}>
                <View style={styles.headerRow}>
                    <Text style={[baseStyles.h3, { color: colors.textPrimary, flex: 1, marginRight: 8 }]} numberOfLines={2}>
                        {product.name}
                    </Text>
                    <View style={styles.categoryBadge}>
                        <Text style={[baseStyles.caption, { color: colors.primary, fontSize: 10 }]}>
                            {product.category || 'Autre'}
                        </Text>
                    </View>
                </View>

                {priceData ? (
                    <View style={styles.metaContainer}>
                        <View style={styles.priceContainer}>
                            <Text style={styles.priceValue}>{priceData.value} F</Text>
                            <Text style={styles.priceUnit}>/ {priceData.unit}</Text>
                        </View>
                        <Text style={styles.timeAgo}>
                            {priceData.timeAgo}
                        </Text>
                    </View>
                ) : (
                    <Text style={styles.placeholderText}>--</Text>
                )}
            </View>
        </TouchableOpacity>
    );
};

const getProductEmoji = (category: string, name: string = ''): string => {
    const normalizedCat = (category || '').toUpperCase();
    const normalizedName = (name || '').toUpperCase();

    // Specific product overrides
    if (normalizedName.includes('TOMATE')) return '🍅';
    if (normalizedName.includes('OIGNON')) return '🧅';
    if (normalizedName.includes('PIMENT')) return '🌶️';
    if (normalizedName.includes('RIZ')) return '🍚';
    if (normalizedName.includes('MAIS') || normalizedName.includes('MAÏS')) return '🌽';
    if (normalizedName.includes('IGNAME')) return '🍠';
    if (normalizedName.includes('MANIOC') || normalizedName.includes('GARI')) return '🥣';
    if (normalizedName.includes('HARICOT')) return '🫘';
    if (normalizedName.includes('ANANAS')) return '🍍';
    if (normalizedName.includes('ORANGE')) return '🍊';
    if (normalizedName.includes('OEUF')) return '🥚';
    if (normalizedName.includes('POULET')) return '🐓';
    if (normalizedName.includes('BOEUF')) return '🐄';
    if (normalizedName.includes('POISSON')) return '🐟';
    if (normalizedName.includes('HUILE')) return '🌻';
    if (normalizedName.includes('FROMAGE')) return '🧀';
    if (normalizedName.includes('LAIT')) return '🥛';
    if (normalizedName.includes('KLEOUI') || normalizedName.includes('KLÉOUJ')) return '🪴';

    // Category fallbacks
    if (normalizedCat.includes('CEREAL')) return '🌾';
    if (normalizedCat.includes('LEGUMINEUSE')) return '🫘';
    if (normalizedCat.includes('TUBERCULE')) return '🥔';
    if (normalizedCat.includes('FRUIT')) return '🍎';
    if (normalizedCat.includes('LEGUME')) return '🥬';
    if (normalizedCat.includes('VIANDE')) return '🥩';
    if (normalizedCat.includes('POISSON')) return '🐟';
    if (normalizedCat.includes('LAIT')) return '🥛';
    if (normalizedCat.includes('EPICE')) return '🌶️';

    return '📦';
};

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        backgroundColor: colors.cardBackground,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        marginBottom: spacing.md,
        shadowColor: '#1a4d2e',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 3,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.02)',
        alignItems: 'center',
    },
    imageContainer: {
        width: 60,
        height: 60,
        borderRadius: borderRadius.md,
        backgroundColor: colors.primary + '10',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    imagePlaceholder: {
        fontSize: 32,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 4,
    },
    categoryBadge: {
        backgroundColor: colors.primary + '15', // Duotone: Light BG
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        // No border
        alignSelf: 'flex-start',
    },
    metaContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    priceContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    priceValue: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.primary,
    },
    priceUnit: {
        fontSize: 12,
        color: colors.textSecondary,
        marginLeft: 2,
    },
    timeAgo: {
        fontSize: 11,
        color: colors.textLight,
        fontStyle: 'italic',
    },
    placeholderText: {
        fontSize: 12,
        color: colors.textLight,
        fontStyle: 'italic',
    }
});
