import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { MarketTrendsWidget } from '../components/MarketTrendsWidget';
import { colors, baseStyles, spacing } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { NavigationProp } from '@react-navigation/native';

interface TrendsScreenProps {
    navigation: NavigationProp<any>;
}

export default function TrendsScreen({ navigation }: TrendsScreenProps) {
    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={baseStyles.h2}>Tendances Marchés 📈</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={[baseStyles.body, { marginBottom: spacing.lg, color: colors.textSecondary }]}>
                    Aperçu des prix et conditions climatiques sur les marchés suivis.
                </Text>

                <MarketTrendsWidget />

                {/* Future: Add charts or more detailed stats here */}
                <View style={styles.placeholderChart}>
                    <Text style={{ textAlign: 'center', color: colors.textLight }}>
                        Graphiques détaillés à venir...
                    </Text>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
        paddingTop: 80,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.md,
    },
    backButton: {
        marginRight: spacing.md,
        padding: 4,
    },
    content: {
        padding: spacing.lg,
    },
    placeholderChart: {
        marginTop: spacing.xl,
        height: 200,
        backgroundColor: colors.cardBackground,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        borderStyle: 'dashed',
        borderWidth: 1,
        borderColor: colors.textLight,
    }
});
