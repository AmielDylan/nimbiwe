import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, StyleSheet } from 'react-native';
import { Market } from '../types';
import { colors, baseStyles, spacing, borderRadius } from '../constants/theme';

interface MarketPickerProps {
    markets: Market[];
    selectedId: string | null;
    onSelect: (marketId: string) => void;
    error?: string;
}

export const MarketPicker: React.FC<MarketPickerProps> = ({
    markets,
    selectedId,
    onSelect,
    error,
}) => {
    const [modalVisible, setModalVisible] = useState(false);

    const selectedMarket = markets.find(m => m.id === selectedId);

    return (
        <View style={styles.container}>
            <Text style={[baseStyles.label, { marginBottom: spacing.xs }]}>Marché *</Text>
            <TouchableOpacity
                style={[styles.picker, error && styles.pickerError]}
                onPress={() => setModalVisible(true)}
            >
                {selectedMarket ? (
                    <View style={styles.selectedContent}>
                        <Text style={styles.emoji}>🏪</Text>
                        <View>
                            <Text style={[baseStyles.body, { color: colors.textPrimary }]}>
                                {selectedMarket.name}
                            </Text>
                            <Text style={[baseStyles.caption, { color: colors.textSecondary }]}>
                                {selectedMarket.city}
                            </Text>
                        </View>
                    </View>
                ) : (
                    <Text style={[baseStyles.body, { color: colors.textSecondary }]}>
                        Sélectionnez un marché
                    </Text>
                )}
            </TouchableOpacity>
            {error && (
                <Text style={[baseStyles.caption, { color: colors.error, marginTop: spacing.xs }]}>
                    {error}
                </Text>
            )}

            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={[baseStyles.h3, { color: colors.textPrimary }]}>
                                Choisir un Marché
                            </Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Text style={[baseStyles.body, { color: colors.primary }]}>Fermer</Text>
                            </TouchableOpacity>
                        </View>

                        <FlatList
                            data={markets}
                            keyExtractor={(item) => item.id}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[
                                        styles.marketItem,
                                        item.id === selectedId && styles.marketItemSelected,
                                    ]}
                                    onPress={() => {
                                        onSelect(item.id);
                                        setModalVisible(false);
                                    }}
                                >
                                    <Text style={styles.marketEmoji}>🏪</Text>
                                    <View style={styles.marketInfo}>
                                        <Text style={[baseStyles.body, { color: colors.textPrimary }]}>
                                            {item.name}
                                        </Text>
                                        <Text style={[baseStyles.caption, { color: colors.textSecondary }]}>
                                            {item.city}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: spacing.md,
    },
    picker: {
        backgroundColor: colors.cardBackground,
        borderRadius: borderRadius.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        borderWidth: 1,
        borderColor: colors.inputBorder,
    },
    pickerError: {
        borderColor: colors.error,
    },
    selectedContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    emoji: {
        fontSize: 24,
        marginRight: spacing.sm,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: colors.background,
    },
    modalContent: {
        flex: 1,
        backgroundColor: colors.background,
        paddingTop: 50, // Safe area approx
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.inputBorder,
    },
    marketItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.background,
    },
    marketItemSelected: {
        backgroundColor: colors.background,
    },
    marketEmoji: {
        fontSize: 32,
        marginRight: spacing.md,
    },
    marketInfo: {
        flex: 1,
    },
});
