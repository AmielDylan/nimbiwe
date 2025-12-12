import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, StyleSheet } from 'react-native';
import { Product } from '../types';
import { colors, baseStyles, spacing, borderRadius } from '../constants/theme';

interface ProductPickerProps {
    products: Product[];
    selectedId: string | null;
    onSelect: (productId: string) => void;
    error?: string;
}

export const ProductPicker: React.FC<ProductPickerProps> = ({
    products,
    selectedId,
    onSelect,
    error,
}) => {
    const [modalVisible, setModalVisible] = useState(false);

    const selectedProduct = products.find(p => p.id === selectedId);

    const getProductEmoji = (category?: string): string => {
        const emojiMap: Record<string, string> = {
            'CEREALES': '🌾',
            'Céréales': '🌾',
            'LEGUMINEUSES': '🫘',
            'TUBERCULES': '🥔',
            'FRUITS': '🍎',
            'LEGUMES': '🥬',
            'Légumes': '🥬',
            'VIANDE': '🥩',
            'POISSON': '🐟',
            'LAIT': '🥛',
        };
        return emojiMap[category || ''] || '🛒';
    };

    return (
        <View style={styles.container}>
            <Text style={[baseStyles.label, { marginBottom: spacing.xs }]}>Produit *</Text>
            <TouchableOpacity
                style={[styles.picker, error && styles.pickerError]}
                onPress={() => setModalVisible(true)}
            >
                {selectedProduct ? (
                    <View style={styles.selectedContent}>
                        <Text style={styles.emoji}>{getProductEmoji(selectedProduct.category)}</Text>
                        <Text style={[baseStyles.body, { color: colors.textPrimary }]}>
                            {selectedProduct.name}
                        </Text>
                    </View>
                ) : (
                    <Text style={[baseStyles.body, { color: colors.textSecondary }]}>
                        Sélectionnez un produit
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
                                Choisir un Produit
                            </Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Text style={[baseStyles.body, { color: colors.primary }]}>Fermer</Text>
                            </TouchableOpacity>
                        </View>

                        <FlatList
                            data={products}
                            keyExtractor={(item) => item.id}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[
                                        styles.productItem,
                                        item.id === selectedId && styles.productItemSelected,
                                    ]}
                                    onPress={() => {
                                        onSelect(item.id);
                                        setModalVisible(false);
                                    }}
                                >
                                    <Text style={styles.productEmoji}>{getProductEmoji(item.category)}</Text>
                                    <View style={styles.productInfo}>
                                        <Text style={[baseStyles.body, { color: colors.textPrimary }]}>
                                            {item.name}
                                        </Text>
                                        <Text style={[baseStyles.caption, { color: colors.textSecondary }]}>
                                            {item.category}
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
    productItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.background,
    },
    productItemSelected: {
        backgroundColor: colors.background,
    },
    productEmoji: {
        fontSize: 32,
        marginRight: spacing.md,
    },
    productInfo: {
        flex: 1,
    },
});
