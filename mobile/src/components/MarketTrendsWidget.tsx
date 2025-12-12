import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { analyticsApi, MarketStats } from '../api/analytics';
import { colors, baseStyles, spacing, borderRadius } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';

export const MarketTrendsWidget = () => {
    const [markets, setMarkets] = useState<MarketStats[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const data = await analyticsApi.getMapData();
            // Sort by latest update desc
            setMarkets(data.slice(0, 5)); // Top 5
        } catch (error) {
            console.error('Failed to load market trends', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <ActivityIndicator size="small" color={colors.primary} style={{ margin: 20 }} />;
    }

    if (markets.length === 0) {
        return (
            <View style={styles.emptyContainer}>
                <Text style={baseStyles.bodySmall}>Aucune donnée de marché disponible.</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={baseStyles.h3}>Tendances Marchés 📈</Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
                {markets.map((market) => (
                    <View key={market.id} style={styles.card}>
                        <View style={styles.cardHeader}>
                            <Text style={styles.marketName} numberOfLines={1}>{market.name}</Text>
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>{market.city}</Text>
                            </View>
                        </View>

                        {/* Weather if available */}
                        {market.temp !== null && (
                            <View style={styles.weatherRow}>
                                <Ionicons name={getWeatherIcon(market.weather)} size={16} color={colors.textSecondary} />
                                <Text style={styles.weatherText}>
                                    {market.temp}°C • {market.weather}
                                </Text>
                            </View>
                        )}

                        {/* Top Product Price */}
                        {market.activeProducts.length > 0 ? (
                            <View style={styles.priceRow}>
                                <Text style={styles.productName}>{market.activeProducts[0].name}</Text>
                                <Text style={styles.priceValue}>
                                    {market.activeProducts[0].price} F
                                </Text>
                            </View>
                        ) : (
                            <Text style={styles.noData}>Pas de prix récent</Text>
                        )}
                    </View>
                ))}
            </ScrollView>
        </View>
    );
};

const getWeatherIcon = (code: string): any => {
    if (code?.includes('RAIN')) return 'rainy-outline';
    if (code?.includes('CLOUD')) return 'cloud-outline';
    if (code?.includes('CLEAR')) return 'sunny-outline';
    return 'partly-sunny-outline';
};

const styles = StyleSheet.create({
    container: {
        marginBottom: spacing.lg,
    },
    header: {
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.sm,
    },
    emptyContainer: {
        padding: spacing.lg,
        alignItems: 'center',
    },
    scroll: {
        paddingLeft: spacing.lg,
    },
    card: {
        backgroundColor: colors.cardBackground,
        width: 160,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        marginRight: spacing.md,
        borderWidth: 1,
        borderColor: colors.inputBorder,
    },
    cardHeader: {
        marginBottom: spacing.sm,
    },
    marketName: {
        fontSize: 14,
        fontWeight: 'bold',
        color: colors.textPrimary,
        marginBottom: 2,
    },
    badge: {
        backgroundColor: colors.background,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        alignSelf: 'flex-start',
    },
    badgeText: {
        fontSize: 10,
        color: colors.textSecondary,
    },
    weatherRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    weatherText: {
        fontSize: 12,
        color: colors.textSecondary,
        marginLeft: 4,
    },
    priceRow: {
        marginTop: 'auto',
        borderTopWidth: 1,
        borderTopColor: colors.inputBorder,
        paddingTop: spacing.xs,
    },
    productName: {
        fontSize: 12,
        color: colors.textSecondary,
    },
    priceValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.primary,
    },
    noData: {
        fontSize: 12,
        fontStyle: 'italic',
        color: colors.textSecondary,
    }
});
