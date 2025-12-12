import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { colors, baseStyles, spacing, borderRadius } from '../constants/theme';

interface PriceInputProps {
    value: string;
    onChangeText: (value: string) => void;
    placeholder?: string;
    error?: string;
}

export const PriceInput: React.FC<PriceInputProps> = ({
    value,
    onChangeText,
    placeholder = 'Prix en FCFA',
    error,
}) => {
    const handleChange = (text: string) => {
        // Autoriser seulement les chiffres et un point décimal
        const cleaned = text.replace(/[^0-9.]/g, '');
        // Limiter à un seul point décimal
        const parts = cleaned.split('.');
        if (parts.length > 2) {
            onChangeText(parts[0] + '.' + parts.slice(1).join(''));
        } else {
            onChangeText(cleaned);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={[baseStyles.label, { marginBottom: spacing.xs }]}>Prix *</Text>
            <View style={[styles.inputContainer, error && styles.inputError]}>
                <TextInput
                    style={[baseStyles.body, styles.input]}
                    value={value}
                    onChangeText={handleChange}
                    placeholder={placeholder}
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="decimal-pad"
                />
                <Text style={[baseStyles.bodySmall, { color: colors.textSecondary }]}>FCFA</Text>
            </View>
            {error && (
                <Text style={[baseStyles.caption, { color: colors.error, marginTop: spacing.xs }]}>
                    {error}
                </Text>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: spacing.md,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.cardBackground,
        borderRadius: borderRadius.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderWidth: 1,
        borderColor: colors.inputBorder,
    },
    inputError: {
        borderColor: colors.error,
    },
    input: {
        flex: 1,
        marginRight: spacing.sm,
    },
});
