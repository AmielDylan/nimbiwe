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
import { NavigationProp } from '@react-navigation/native';
import { useAuthStore } from '../store/authStore';
import { useProducts, useMarkets } from '../hooks/useProducts';
import { ProductCard } from '../components/ProductCard';
import { SearchBar } from '../components/SearchBar';
import { MarketSelector } from '../components/MarketSelector';
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

    // Filtrage des produits
    const filteredProducts = useMemo(() => {
        let filtered = products;

        // Filtre par recherche
        if (searchQuery.trim()) {
            filtered = filtered.filter((product) =>
                product.name.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        // Filtre par marché (à implémenter côté backend si nécessaire)
        // Pour l'instant on affiche tous les produits

        return filtered;
    }, [products, searchQuery, selectedMarketId]);

    const onRefresh = () => {
        refetchProducts();
    };

    const renderProduct = ({ item }: { item: Product }) => (
        <ProductCard
            product={item}
            onPress={() => {
                // TODO: Navigation vers ProductDetail
                console.log('Product pressed:', item.name);
            }}
        />
    );

    const renderEmptyState = () => (
        <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🔍</Text>
            <Text style={[baseStyles.h3, { textAlign: 'center' }]}>
                Aucun produit trouvé
            </Text>
            <Text style={[baseStyles.bodySmall, { textAlign: 'center', marginTop: spacing.sm }]}>
                Essayez une autre recherche
            </Text>
        </View>
    );

    if (productsLoading && products.length === 0) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[baseStyles.body, { marginTop: spacing.md }]}>
                    Chargement des produits...
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={[baseStyles.h2, { color: colors.textPrimary }]}>
                        Bonjour {user?.name || 'Agent'}
                    </Text>
                    <Text style={[baseStyles.bodySmall, { color: colors.textSecondary }]}>
                        Produits Locaux du Bénin
                    </Text>
                </View>
                <Text style={[baseStyles.h3, { color: colors.primary }]}>Nimbiwe</Text>
            </View>

            {/* Content */}
            <View style={styles.content}>
                <SearchBar value={searchQuery} onChangeText={setSearchQuery} />

                {!marketsLoading && markets.length > 0 && (
                    <MarketSelector
                        markets={markets}
                        selectedMarketId={selectedMarketId}
                        onSelectMarket={setSelectedMarketId}
                    />
                )}

                <FlatList
                    data={filteredProducts}
                    renderItem={renderProduct}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={renderEmptyState}
                    refreshControl={
                        <RefreshControl
                            refreshing={productsLoading}
                            onRefresh={onRefresh}
                            colors={[colors.primary]}
                            tintColor={colors.primary}
                        />
                    }
                    showsVerticalScrollIndicator={false}
                />
            </View>

            {/* FAB - Floating Action Button */}
            <TouchableOpacity
                style={styles.fab}
                onPress={() => navigation.navigate('PriceEntry' as never)}
                activeOpacity={0.8}
            >
                <Text style={styles.fabIcon}>+</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        padding: spacing.lg,
        paddingTop: 60,
        backgroundColor: colors.cardBackground,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    content: {
        flex: 1,
        padding: spacing.lg,
    },
    listContent: {
        paddingBottom: spacing.lg,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.xl * 2,
    },
    emptyEmoji: {
        fontSize: 64,
        marginBottom: spacing.md,
    },
    fab: {
        position: 'absolute',
        bottom: 24,
        right: 24,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 8,
    },
    fabIcon: {
        fontSize: 32,
        color: colors.white,
        fontWeight: '300' as const,
        marginTop: -2,
    },
});
