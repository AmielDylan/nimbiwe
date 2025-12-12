import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { NavigationProp, RouteProp } from '@react-navigation/native';
import { authApi } from '../api/auth';
import { setAuthToken } from '../api/entries';
import { useAuthStore } from '../store/authStore';
import { colors, baseStyles, spacing, borderRadius } from '../constants/theme';

interface OTPScreenProps {
    navigation: NavigationProp<any>;
    route: RouteProp<{ params: { phoneOrEmail: string; expiresIn: number } }, 'params'>;
}

export default function OTPScreen({ navigation, route }: OTPScreenProps) {
    const { phoneOrEmail, expiresIn } = route.params;
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [isLoading, setIsLoading] = useState(false);
    const [timer, setTimer] = useState(expiresIn || 300); // 5 minutes par défaut
    const [canResend, setCanResend] = useState(false);

    const inputRefs = useRef<(TextInput | null)[]>([]);
    const { setTokens, setUser } = useAuthStore();

    // Timer pour le code
    useEffect(() => {
        const interval = setInterval(() => {
            setTimer((prev) => {
                if (prev <= 1) {
                    setCanResend(true);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    // Auto-submit quand les 6 chiffres sont saisis
    useEffect(() => {
        const otpString = otp.join('');
        if (otpString.length === 6) {
            verifyOtp(otpString);
        }
    }, [otp]);

    const handleOtpChange = (value: string, index: number) => {
        // Accepter seulement les chiffres
        if (!/^\d*$/.test(value)) return;

        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);

        // Auto-focus sur le prochain input
        if (value && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyPress = (e: any, index: number) => {
        // Retour arrière : focus sur l'input précédent
        if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const verifyOtp = async (otpString: string) => {
        setIsLoading(true);
        try {
            const response = await authApi.verifyOtp(phoneOrEmail, otpString);

            // Stocker les tokens
            await setTokens(response.access_token, response.refresh_token);

            // Configurer l'API client
            setAuthToken(response.access_token);

            // TODO: Récupérer les infos utilisateur
            // Pour l'instant, on simule
            setUser({
                id: 'temp-id',
                name: 'Agent',
                phone: phoneOrEmail.includes('@') ? undefined : phoneOrEmail,
                email: phoneOrEmail.includes('@') ? phoneOrEmail : undefined,
                role: 'AGENT',
            });

            // Naviguer vers le dashboard
            navigation.replace('Home');
        } catch (error: any) {
            Alert.alert(
                'Code invalide',
                error.response?.data?.message || 'Le code saisi est incorrect ou expiré. Veuillez réessayer.'
            );
            // Réinitialiser l'OTP
            setOtp(['', '', '', '', '', '']);
            inputRefs.current[0]?.focus();
        } finally {
            setIsLoading(false);
        }
    };

    const handleResendOtp = async () => {
        if (!canResend) return;

        try {
            await authApi.requestOtp(phoneOrEmail);
            setTimer(300);
            setCanResend(false);
            Alert.alert('Code envoyé', 'Un nouveau code a été envoyé.');
        } catch (error) {
            Alert.alert('Erreur', 'Impossible de renvoyer le code. Veuillez réessayer.');
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Text style={styles.backButton}>←</Text>
                </TouchableOpacity>
                <Text style={[baseStyles.h3, { color: colors.primary }]}>Nimbiwe</Text>
            </View>

            {/* Content */}
            <View style={styles.content}>
                <Text style={baseStyles.h1}>Entrez votre code</Text>
                <Text style={[baseStyles.bodySmall, { color: colors.textSecondary }]}>
                    Nous avons envoyé un code d'activation sur {phoneOrEmail}
                </Text>

                {/* OTP Inputs */}
                <View style={styles.otpContainer}>
                    {otp.map((digit, index) => (
                        <TextInput
                            key={index}
                            ref={(ref) => (inputRefs.current[index] = ref)}
                            style={[
                                styles.otpInput,
                                digit && styles.otpInputFilled,
                            ]}
                            value={digit}
                            onChangeText={(value) => handleOtpChange(value, index)}
                            onKeyPress={(e) => handleKeyPress(e, index)}
                            keyboardType="number-pad"
                            maxLength={1}
                            editable={!isLoading}
                            autoFocus={index === 0}
                        />
                    ))}
                </View>

                {/* Timer / Resend */}
                <View style={styles.timerContainer}>
                    {canResend ? (
                        <TouchableOpacity onPress={handleResendOtp}>
                            <Text style={[baseStyles.body, { color: colors.primary, fontWeight: '600' }]}>
                                Renvoyer le code
                            </Text>
                        </TouchableOpacity>
                    ) : (
                        <Text style={baseStyles.bodySmall}>
                            Renvoyer le code dans {formatTime(timer)}
                        </Text>
                    )}
                </View>

                {/* Loading indicator */}
                {isLoading && (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={[baseStyles.bodySmall, { marginTop: spacing.sm }]}>
                            Vérification...
                        </Text>
                    </View>
                )}
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
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.lg,
        paddingTop: 60,
    },
    backButton: {
        fontSize: 28,
        color: colors.textPrimary,
    },
    content: {
        flex: 1,
        padding: spacing.lg,
    },
    otpContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: spacing.lg,
        gap: spacing.sm,
        marginTop: spacing.xl,
    },
    otpInput: {
        flex: 1,
        aspectRatio: 1,
        borderWidth: 1,
        borderColor: colors.inputBorder,
        borderRadius: borderRadius.md,
        backgroundColor: colors.cardBackground,
        fontSize: 24,
        textAlign: 'center',
        fontWeight: '600',
    },
    otpInputFilled: {
        borderColor: colors.primary,
        backgroundColor: colors.background,
    },
    timerContainer: {
        alignItems: 'center',
        marginTop: spacing.lg,
    },
    loadingContainer: {
        alignItems: 'center',
        marginTop: spacing.xl,
    },
});
