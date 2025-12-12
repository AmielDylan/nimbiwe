import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { NavigationProp } from '@react-navigation/native';
import { authApi } from '../api/auth';
import { colors, baseStyles, spacing, borderRadius } from '../constants/theme';

interface AuthScreenProps {
    navigation: NavigationProp<any>;
}

export default function AuthScreen({ navigation }: AuthScreenProps) {
    const [phoneOrEmail, setPhoneOrEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleRequestOtp = async () => {
        if (!phoneOrEmail.trim()) {
            Alert.alert('Erreur', 'Veuillez entrer un numéro de téléphone ou email');
            return;
        }

        setIsLoading(true);
        try {
            const response = await authApi.requestOtp(phoneOrEmail);

            // Naviguer vers l'écran OTP
            navigation.navigate('OTP', {
                phoneOrEmail,
                expiresIn: response.expiresIn,
            });
        } catch (error: any) {
            Alert.alert(
                'Erreur',
                error.response?.data?.message || 'Impossible d\'envoyer le code. Veuillez réessayer.'
            );
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={[baseStyles.h2, { color: colors.primary }]}>Nimbiwe</Text>
            </View>

            {/* Formulaire */}
            <View style={styles.content}>
                <Text style={baseStyles.h1}>Connexion</Text>

                <View style={styles.form}>
                    <Text style={[baseStyles.bodySmall, { color: colors.textSecondary }]}>
                        Numéro de téléphone ou Email
                    </Text>
                    <TextInput
                        style={styles.input}
                        placeholder="+229 97 12 34 56 ou email@example.com"
                        value={phoneOrEmail}
                        onChangeText={setPhoneOrEmail}
                        keyboardType="default"
                        autoCapitalize="none"
                        autoComplete="tel"
                        editable={!isLoading}
                    />

                    <TouchableOpacity
                        style={[styles.button, isLoading && styles.buttonDisabled]}
                        onPress={handleRequestOtp}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="#FFFFFF" />
                        ) : (
                            <Text style={[baseStyles.button, { color: '#FFFFFF' }]}>Recevoir le code</Text>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Footer */}
                <View style={styles.footer}>
                    <Text style={baseStyles.bodySmall}>
                        Difficultés de connexion ?{' '}
                        <Text style={styles.link}>Contactez nous</Text>
                    </Text>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        alignItems: 'flex-end',
        padding: spacing.lg,
        paddingTop: 60,
    },
    content: {
        flex: 1,
        padding: spacing.lg,
    },
    form: {
        gap: spacing.md,
        marginTop: spacing.xl,
    },
    input: {
        backgroundColor: colors.inputBackground,
        borderWidth: 1,
        borderColor: colors.inputBorder,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        fontSize: 16,
        color: colors.textPrimary,
    },
    button: {
        backgroundColor: colors.primary,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        alignItems: 'center',
        marginTop: spacing.md,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    footer: {
        marginTop: 'auto',
        alignItems: 'center',
        paddingBottom: spacing.xl,
    },
    link: {
        color: colors.primary,
        fontWeight: '600',
    },
});
