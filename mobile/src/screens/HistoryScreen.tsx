import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Image } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, baseStyles, spacing, borderRadius } from '../constants/theme';
import { entriesApi } from '../api/entries';
import { PriceEntry } from '../types';

// Format date helper
const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

export default function HistoryScreen() {
    const [entries, setEntries] = useState<PriceEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const fetchHistory = async () => {
        try {
            setLoading(true);
            const response = await entriesApi.getHistory();
            setEntries(response.data); // data contains { data: [], meta: {} }
        } catch (error) {
            console.error('Failed to fetch history', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchHistory();
        }, [])
    );

    const onRefresh = () => {
        setRefreshing(true);
        fetchHistory();
    };

    const renderItem = ({ item }: { item: PriceEntry }) => {
        // Backend mapping: pending/validated -> accepted in sync, but here we see raw status.
        const statusColor = item.status === 'validated' ? colors.success : item.status === 'rejected' ? colors.error : colors.warning;
        const statusText = item.status === 'validated' ? 'Validé' : item.status === 'rejected' ? 'Rejeté' : 'En attente';

        return (
            <View style={styles.card}>
                {item.photoUrl && (
                    <Image source={{ uri: item.photoUrl }} style={styles.thumbnail} />
                )}
                <View style={styles.cardContent}>
                    <View style={styles.row}>
                        <Text style={baseStyles.h3}>{item.product?.name || 'Produit'}</Text>
                        <Text style={[baseStyles.price, { fontSize: 18, color: colors.priceGreen }]}>
                            {item.priceValue} F
                        </Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={[baseStyles.bodySmall, { color: colors.textSecondary }]}>
                            {item.market?.name || 'Marché'} • {formatDate(item.capturedAt)}
                        </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                        <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
                        {item.status === 'validated' && (
                            <Text style={[styles.gainText, { color: colors.primary }]}>+50 F</Text>
                        )}
                    </View>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={baseStyles.h2}>Historique</Text>
            </View>

            <FlatList
                data={entries}
                renderItem={renderItem}
                keyExtractor={(item) => item.id || Math.random().toString()}
                contentContainerStyle={styles.list}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
                }
                ListEmptyComponent={
                    !loading ? (
                        <Text style={{ textAlign: 'center', marginTop: 40, color: colors.textSecondary }}>
                            Aucune saisie pour le moment.
                        </Text>
                    ) : null
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        padding: spacing.lg,
        paddingTop: 80,
        backgroundColor: colors.background,
    },
    list: {
        padding: spacing.md,
    },
    card: {
        flexDirection: 'row',
        backgroundColor: colors.white,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        marginBottom: spacing.md,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    thumbnail: {
        width: 60,
        height: 60,
        borderRadius: borderRadius.sm,
        marginRight: spacing.md,
        backgroundColor: colors.inputBackground,
    },
    cardContent: {
        flex: 1,
        justifyContent: 'space-between',
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    statusBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: borderRadius.full,
        marginTop: spacing.xs,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
    },
    gainText: {
        fontSize: 12,
        fontWeight: 'bold',
    },
});
