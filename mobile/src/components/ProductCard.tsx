import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Product } from '../types';
import { colors, baseStyles, spacing, borderRadius } from '../constants/theme';

interface ProductCardProps {
    product: Product;
    onPress: () => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onPress }) => {
    return (
        <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
            <View style={styles.imageContainer}>
                <Text style={styles.imagePlaceholder}>{getProductEmoji(product.category || '')}</Text>
            </View>

            <View style={styles.content}>
                <Text style={[baseStyles.h3, { color: colors.textPrimary }]} numberOfLines={2}>
                    {product.name}
                </Text>

                <View style={styles.footer}>
                    <View style={styles.categoryBadge}>
                        <Text style={[baseStyles.caption, { color: colors.primary }]}>
                            {product.category || 'Autre'}
                        </Text>
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );
};

const getProductEmoji = (category: string): string => {
    const emojiMap: Record<string, string> = {
        'CEREALES': '🌾',
        'LEGUMINEUSES': '🫘',
        'TUBERCULES': '🥔',
        'FRUITS': '🍎',
        'LEGUMES': '🥬',
        'VIANDE': '🥩',
        'POISSON': '🐟',
        'LAIT': '🥛',
    };
    return emojiMap[category] || '🛒';
};

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        backgroundColor: colors.cardBackground,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        marginBottom: spacing.md,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    imageContainer: {
        width: 80,
        height: 80,
        borderRadius: borderRadius.md,
        backgroundColor: colors.background,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    imagePlaceholder: {
        fontSize: 40,
    },
    content: {
        flex: 1,
        justifyContent: 'space-between',
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.xs,
    },
    categoryBadge: {
        backgroundColor: colors.background,
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: borderRadius.sm,
    },
});
