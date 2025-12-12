import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { NavigationProp } from '@react-navigation/native';
import { useProducts, useMarkets } from '../hooks/useProducts';
import { ProductPicker } from '../components/ProductPicker';
import { MarketPicker } from '../components/MarketPicker';
import { PriceInput } from '../components/PriceInput';
import { entriesApi } from '../api/entries';
import { colors, baseStyles, spacing, borderRadius } from '../constants/theme';
import * as Location from 'expo-location';
import { useAuthStore } from '../store/authStore';

interface PriceEntryScreenProps {
    navigation: NavigationProp<any>;
}

export default function PriceEntryScreen({ navigation }: PriceEntryScreenProps) {
    const { user } = useAuthStore();
    const { data: products = [], isLoading: productsLoading } = useProducts();
    const { data: markets = [], isLoading: marketsLoading } = useMarkets();

    const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
    const [selectedMarketId, setSelectedMarketId] = useState<string | null>(null);
    const [price, setPrice] = useState('');
    const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
    const [locationError, setLocationError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Validation errors
    const [errors, setErrors] = useState<{
        product?: string;
        market?: string;
        price?: string;
    }>({});

    // Charger la localisation au montage
    useEffect(() => {
        (async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                    setLocationError('Permission GPS refusée');
                    return;
                }

                const loc = await Location.getCurrentPositionAsync({});
                setLocation({
                    lat: loc.coords.latitude,
                    lon: loc.coords.longitude,
                });
            } catch (error) {
                setLocationError('Impossible de récupérer la position');
            }
        })();
    }, []);

    const validate = (): boolean => {
        const newErrors: typeof errors = {};

        if (!selectedProductId) {
            newErrors.product = 'Sélectionnez un produit';
        }

        if (!selectedMarketId) {
            newErrors.market = 'Sélectionnez un marché';
        }

        const priceValue = parseFloat(price);
        if (!price || isNaN(priceValue) || priceValue <= 0) {
            newErrors.price = 'Entrez un prix valide';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate()) {
            Alert.alert('Erreur', 'Veuillez remplir tous les champs requis');
            return;
        }

        if (!location) {
            Alert.alert('GPS requis', 'La géolocalisation est nécessaire pour enregistrer le prix');
            return;
        }

        setIsSubmitting(true);

        try {
            // Générer un clientId unique pour cette entrée
            const clientId = `entry_${Date.now()}_${Math.random().toString(36).substring(7)}`;

            const entry = {
                clientId,
                productId: selectedProductId!,
                marketId: selectedMarketId!,
                unit: 'kg' as const, // TODO: Permettre de sélectionner l'unité
                priceValue: parseFloat(price),
                currency: 'XOF',
                lat: location.lat,
                lon: location.lon,
                capturedAt: new Date().toISOString(),
            };

            // L'API attend un tableau d'entrées
            const response = await entriesApi.createEntry([entry]);

            // Vérifier le statut de la réponse
            const result = response[0];
            if (result.status === 'accepted') {
                Alert.alert(
                    'Succès',
                    'Prix enregistré avec succès',
                    [
                        {
                            text: 'OK',
                            onPress: () => navigation.goBack(),
                        },
                    ]
                );
            } else {
                Alert.alert(
                    'Information',
                    result.reason || `Statut: ${result.status}`,
                    [
                        {
                            text: 'OK',
                            onPress: () => navigation.goBack(),
                        },
                    ]
                );
            }
        } catch (error: any) {
            console.error('Error submitting price:', error);
            Alert.alert(
                'Erreur',
                error.response?.data?.message || 'Impossible d\'enregistrer le prix'
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    if (productsLoading || marketsLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[baseStyles.body, { marginTop: spacing.md }]}>
                    Chargement...
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={[baseStyles.h3, { color: colors.primary }]}>←</Text>
                </TouchableOpacity>
                <Text style={[baseStyles.h2, { color: colors.textPrimary }]}>
                    Nouvelle Saisie
                </Text>
                <View style={{ width: 40 }} />
            </View>

            {/* Form */}
            <ScrollView
                style={styles.content}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <ProductPicker
                    products={products}
                    selectedId={selectedProductId}
                    onSelect={setSelectedProductId}
                    error={errors.product}
                />

                <MarketPicker
                    markets={markets}
                    selectedId={selectedMarketId}
                    onSelect={setSelectedMarketId}
                    error={errors.market}
                />

                <PriceInput
                    value={price}
                    onChangeText={setPrice}
                    error={errors.price}
                />

                {/* Location Info */}
                <View style={styles.infoCard}>
                    {location ? (
                        <>
                            <Text style={[baseStyles.bodySmall, { color: colors.success }]}>
                                📍 Position capturée
                            </Text>
                            <Text style={[baseStyles.caption, { color: colors.textSecondary, marginTop: 4 }]}>
                                {location.lat.toFixed(6)}, {location.lon.toFixed(6)}
                            </Text>
                        </>
                    ) : (
                        <Text style={[baseStyles.bodySmall, { color: colors.warning }]}>
                            {locationError || '📍 Récupération de la position...'}
                        </Text>
                    )}
                </View>
            </ScrollView>

            {/* Submit Button */}
            <View style={styles.footer}>
                <TouchableOpacity
                    style={[
                        styles.submitButton,
                        (!location || isSubmitting) && styles.submitButtonDisabled,
                    ]}
                    onPress={handleSubmit}
                    disabled={!location || isSubmitting}
                >
                    {isSubmitting ? (
                        <ActivityIndicator color={colors.white} />
                    ) : (
                        <Text style={[baseStyles.body, { color: colors.white, fontWeight: '600' }]}>
                            Enregistrer
                        </Text>
                    )}
                </TouchableOpacity>
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
        paddingHorizontal: spacing.lg,
        paddingTop: 60,
        paddingBottom: spacing.md,
        backgroundColor: colors.cardBackground,
        borderBottomWidth: 1,
        borderBottomColor: colors.inputBorder,
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
    },
    content: {
        flex: 1,
    },
    scrollContent: {
        padding: spacing.lg,
        paddingBottom: spacing.xl * 2,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background,
    },
    infoCard: {
        backgroundColor: colors.cardBackground,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: colors.inputBorder,
    },
    footer: {
        padding: spacing.lg,
        backgroundColor: colors.cardBackground,
        borderTopWidth: 1,
        borderTopColor: colors.inputBorder,
    },
    submitButton: {
        backgroundColor: colors.primary,
        borderRadius: borderRadius.md,
        paddingVertical: spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 50,
    },
    submitButtonDisabled: {
        backgroundColor: colors.textSecondary,
        opacity: 0.5,
    },
});
