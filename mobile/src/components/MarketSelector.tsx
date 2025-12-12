import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Market } from '../types';
import { colors, baseStyles, spacing, borderRadius } from '../constants/theme';

interface MarketSelectorProps {
    markets: Market[];
    selectedMarketId: string | null;
    onSelectMarket: (id: string | null) => void;
}

export const MarketSelector: React.FC<MarketSelectorProps> = ({
    markets,
    selectedMarketId,
    onSelectMarket,
}) => {
    return (
        <View style={styles.container}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {/* "Tous" chip */}
                <TouchableOpacity
                    style={[
                        styles.chip,
                        selectedMarketId === null && styles.chipSelected,
                    ]}
                    onPress={() => onSelectMarket(null)}
                    activeOpacity={0.7}
                >
                    <Text
                        style={[
                            baseStyles.bodySmall,
                            {
                                color: selectedMarketId === null ? colors.white : colors.textPrimary,
                                fontWeight: selectedMarketId === null ? '600' : '400',
                            },
                        ]}
                    >
                        Tous
                    </Text>
                </TouchableOpacity>

                {/* Market chips */}
                {markets.map((market) => (
                    <TouchableOpacity
                        key={market.id}
                        style={[
                            styles.chip,
                            selectedMarketId === market.id && styles.chipSelected,
                        ]}
                        onPress={() => onSelectMarket(market.id)}
                        activeOpacity={0.7}
                    >
                        <Text
                            style={[
                                baseStyles.bodySmall,
                                {
                                    color: selectedMarketId === market.id ? colors.white : colors.textPrimary,
                                    fontWeight: selectedMarketId === market.id ? '600' : '400',
                                },
                            ]}
                        >
                            {market.name}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: spacing.md,
    },
    scrollContent: {
        paddingRight: spacing.md,
    },
    chip: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.full,
        backgroundColor: colors.cardBackground,
        marginRight: spacing.sm,
        borderWidth: 1,
        borderColor: colors.inputBorder,
    },
    chipSelected: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
});
