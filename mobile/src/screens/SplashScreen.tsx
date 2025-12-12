import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, baseStyles } from '../constants/theme';

export default function SplashScreen() {
    return (
        <View style={styles.container}>
            {/* Logo en haut à droite */}
            <View style={styles.header}>
                <Text style={[baseStyles.h2, { color: colors.primary }]}>Nimbiwe</Text>
            </View>

            {/* Image de légumes en bas */}
            <View style={styles.imageContainer}>
                <Text style={styles.placeholder}>🥗</Text>
                <Text style={[baseStyles.bodySmall, { color: colors.textSecondary }]}>
                    Collecte de prix sur les marchés
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
        justifyContent: 'space-between',
    },
    header: {
        alignItems: 'flex-end',
        padding: 24,
        paddingTop: 60,
    },
    imageContainer: {
        alignItems: 'center',
        paddingBottom: 80,
    },
    placeholder: {
        fontSize: 100,
        marginBottom: 16,
    },
});
