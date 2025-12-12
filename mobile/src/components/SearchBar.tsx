import React from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { colors, baseStyles, spacing, borderRadius } from '../constants/theme';

interface SearchBarProps {
    value: string;
    onChangeText: (text: string) => void;
    placeholder?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
    value,
    onChangeText,
    placeholder = 'Rechercher un produit...',
}) => {
    return (
        <View style={styles.container}>
            <TextInput
                style={[baseStyles.body, styles.input]}
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor={colors.textSecondary}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: spacing.md,
    },
    input: {
        backgroundColor: colors.cardBackground,
        borderRadius: borderRadius.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderWidth: 1,
        borderColor: colors.inputBorder,
    },
});
