import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    RefreshControl,
    ActivityIndicator,
    TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NavigationProp } from '@react-navigation/native';
import { useAuthStore } from '../store/authStore';
import { useProducts, useMarkets } from '../hooks/useProducts';
import { useQuery } from '@tanstack/react-query';
import { marketsApi } from '../api/markets';
import { analyticsApi } from '../api/analytics';
import { ProductCard } from '../components/ProductCard';
import { SearchBar } from '../components/SearchBar';
import { MarketSelector } from '../components/MarketSelector';
import { MarketTrendsWidget } from '../components/MarketTrendsWidget';
import { colors, baseStyles, spacing } from '../constants/theme';
import { Product } from '../types';

interface HomeScreenProps {
    navigation: NavigationProp<any>;
}

export default function HomeScreen({ navigation }: HomeScreenProps) {
    const { user } = useAuthStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedMarketId, setSelectedMarketId] = useState<string | null>(null);

    const { data: products = [], isLoading: productsLoading, refetch: refetchProducts } = useProducts();
    const { data: markets = [], isLoading: marketsLoading } = useMarkets();

    // 1. Fetch market prices if market selected
    const { data: marketPrices = [], refetch: refetchPrices } = useQuery({
        queryKey: ['marketPrices', selectedMarketId],
        queryFn: () => marketsApi.getMarketPrices(selectedMarketId!),
        enabled: !!selectedMarketId,
    });

    // 2. NEW: Fetch Averages if NO market selected
    const { data: avgPrices = [], refetch: refetchavgs } = useQuery({
        queryKey: ['avgPrices'],
        queryFn: async () => {
            const res = await analyticsApi.getGlobalStats(); // Wait, need specific avg endpoint
            // Just calling the api client I will update in a sec
            // I need to update analytics.ts too
            return analyticsApi.getAverages(); // Assuming I add this
        },
        enabled: !selectedMarketId,
    });
    // Note: I need to update analytics.ts AND HomeScreen imports for analyticsApi

    // Helper for "il y a..."
    const formatTimeAgo = (dateString?: string) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);

        if (diffHours > 0) return `il y a ${diffHours}h`;
        if (diffMins > 0) return `il y a ${diffMins} min`;
        return 'à l\'instant';
    };

    // Construct price map
    const priceMap = useMemo(() => {
        const map = new Map();

        if (selectedMarketId) {
            marketPrices.forEach(p => {
                map.set(p.productId, {
                    value: p.priceValue,
                    unit: p.unit,
                    timeAgo: formatTimeAgo(p.capturedAt)
                });
            });
        } else {
            // Use averages
            avgPrices.forEach((p: any) => {
                map.set(p.productId, {
                    value: p.priceValue,
                    unit: p.unit, // 'kg' default or from backend
                    timeAgo: 'Moyenne (30j)'
                });
            });
        }

        return map;
    }, [marketPrices, avgPrices, selectedMarketId]);

    // Filtrage des produits
    const filteredProducts = useMemo(() => {
        let filtered = products;
        if (searchQuery.trim()) {
            filtered = filtered.filter((product) =>
                product.name.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }
        return filtered;
    }, [products, searchQuery]);

    const onRefresh = () => {
        refetchProducts();
        if (selectedMarketId) refetchPrices();
        else refetchavgs();
    };

    const renderProduct = ({ item }: { item: Product }) => (
        <ProductCard
            product={item}
            priceData={priceMap.get(item.id)}
            onPress={() => console.log('Product pressed:', item.name)}
        />
    );

    const renderEmptyState = () => (
        <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🔍</Text>
            <Text style={[baseStyles.h3, { textAlign: 'center' }]}>Aucun produit trouvé</Text>
        </View>
    );

    return (
        <View style={styles.container}>
            {/* Transparent Header */}
            <View style={styles.header}>
                <Text style={[baseStyles.h1, { color: colors.textPrimary, flex: 1 }]}>
                    Bonjour {user?.name ? user.name.split(' ')[0] : 'Agent'} 👋
                </Text>
            </View>
            <Text style={[baseStyles.body, { color: colors.textSecondary, paddingHorizontal: spacing.lg, marginBottom: spacing.md }]}>
                Produits Locaux du {user?.country || 'Bénin'}
            </Text>

            <View style={styles.content}>
                <SearchBar value={searchQuery} onChangeText={setSearchQuery} />
                {/* Reduced spacer to bring search closer to content */}
                <View style={{ height: spacing.sm }} />

                <FlatList
                    data={filteredProducts}
                    renderItem={renderProduct}
                    keyExtractor={(item) => item.id}
                    key={'list_1'}
                    numColumns={1}
                    contentContainerStyle={styles.listContent}
                    ListHeaderComponent={
                        <View style={{ marginBottom: spacing.md }}>
                            {/* Filters moved here, just below "Produits" title */}
                            <Text style={[baseStyles.h3, { marginBottom: spacing.md, marginTop: spacing.md }]}>Produits</Text>
                            {!marketsLoading && (
                                <MarketSelector
                                    markets={markets}
                                    selectedMarketId={selectedMarketId}
                                    onSelectMarket={setSelectedMarketId}
                                />
                            )}
                        </View>
                    }
                    ListEmptyComponent={renderEmptyState}
                    refreshControl={
                        <RefreshControl refreshing={productsLoading} onRefresh={onRefresh} colors={[colors.primary]} />
                    }
                    showsVerticalScrollIndicator={false}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background, // Cream background everywhere
        paddingTop: 80, // More space for Dynamic Island
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.xs,
        // No background, no shadow
    },
    content: {
        flex: 1,
        paddingHorizontal: spacing.lg,
    },
    listContent: {
        paddingBottom: 120, // Enough space at bottom
    },
    columnWrapper: {
        justifyContent: 'space-between', // Spread items
    },
    sectionContainer: {
        marginBottom: spacing.sm,
    },
    sectionTitle: {
        ...baseStyles.h2,
        color: colors.textPrimary,
        marginBottom: spacing.sm,
        marginTop: spacing.sm,
    },
    trendsButton: {
        backgroundColor: colors.cardBackground,
        padding: spacing.md,
        borderRadius: 16, // Rounded
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.sm,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: spacing.xl,
    },
    emptyEmoji: {
        fontSize: 40,
        marginBottom: spacing.sm,
    },
});
