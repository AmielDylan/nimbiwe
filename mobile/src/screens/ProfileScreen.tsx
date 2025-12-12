import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, ScrollView, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, baseStyles, spacing, borderRadius } from '../constants/theme';
import { useAuthStore } from '../store/authStore';
import { agentsApi } from '../api/agents';
import { Ionicons } from '@expo/vector-icons';

export default function ProfileScreen() {
    const { user, logout } = useAuthStore();
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const fetchProfile = async () => {
        try {
            setLoading(true);
            const data = await agentsApi.getProfile();
            setProfile(data);
        } catch (error) {
            console.error('Failed to fetch profile', error);
            // Silent error or small toast
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchProfile();
        }, [])
    );

    const handleLogout = () => {
        Alert.alert(
            "Déconnexion",
            "Êtes-vous sûr de vouloir vous déconnecter ?",
            [
                { text: "Annuler", style: "cancel" },
                { text: "Oui", onPress: logout, style: "destructive" }
            ]
        );
    };

    return (
        <ScrollView
            style={styles.container}
            refreshControl={
                <RefreshControl refreshing={loading} onRefresh={fetchProfile} colors={[colors.primary]} />
            }
        >
            <View style={styles.header}>
                <Text style={baseStyles.h2}>Mon Profil</Text>
            </View>

            {/* Carte Identité */}
            <View style={styles.card}>
                <View style={styles.avatarContainer}>
                    <Text style={styles.avatarText}>
                        {(profile?.name || user?.name || 'A').charAt(0).toUpperCase()}
                    </Text>
                </View>
                <Text style={baseStyles.h3}>{profile?.name || user?.name || 'Agent'}</Text>
                <Text style={[baseStyles.body, { color: colors.textSecondary }]}>
                    {profile?.phone || profile?.email || user?.email || 'N/A'}
                </Text>
            </View>

            {/* Stats / Rémunération */}
            <View style={styles.statsContainer}>
                <View style={styles.statBox}>
                    <Text style={styles.statLabel}>Solde</Text>
                    <Text style={styles.statValue}>
                        {profile?.balance ? `${profile.balance} F` : '0 F'}
                    </Text>
                </View>
                <View style={styles.statBox}>
                    <Text style={styles.statLabel}>Total Saisies</Text>
                    <Text style={styles.statValue}>
                        {profile?.lifetimeEntries || 0}
                    </Text>
                </View>
            </View>

            {/* Infos Quota (Hardcoded logic for now, backend could return this) */}
            <View style={[styles.card, { marginTop: spacing.md }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
                    <Ionicons name="information-circle-outline" size={24} color={colors.primary} />
                    <Text style={[baseStyles.h3, { marginLeft: spacing.sm }]}>Quota Journalier</Text>
                </View>
                <Text style={baseStyles.body}>
                    Maximum <Text style={{ fontWeight: 'bold' }}>5 saisies rémunérées</Text> par jour.
                    Vos saisies supplémentaires sont appréciées mais non rémunérées.
                </Text>
            </View>

            <TouchableOpacity
                style={styles.logoutButton}
                onPress={handleLogout}
            >
                <Text style={styles.logoutText}>Se déconnecter</Text>
            </TouchableOpacity>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
        padding: spacing.lg,
    },
    header: {
        marginTop: 40, // Reduced from 60
        marginBottom: spacing.lg,
    },
    card: {
        backgroundColor: colors.cardBackground,
        padding: spacing.lg,
        borderRadius: borderRadius.md,
        marginBottom: spacing.md,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.inputBorder,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    avatarContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: colors.primary + '20', // Opacité 20%
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    avatarText: {
        fontSize: 32,
        fontWeight: 'bold',
        color: colors.primary,
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: spacing.md,
    },
    statBox: {
        flex: 1,
        backgroundColor: colors.white,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        marginHorizontal: spacing.xs,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.inputBorder,
        elevation: 2,
    },
    statLabel: {
        fontSize: 14,
        color: colors.textSecondary,
        marginBottom: spacing.xs,
    },
    statValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: colors.primary,
    },
    logoutButton: {
        marginTop: spacing.xl,
        backgroundColor: colors.error + '10', // Tres clair
        padding: spacing.md,
        borderRadius: borderRadius.md,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.error,
        marginBottom: 40,
    },
    logoutText: {
        color: colors.error,
        fontWeight: '600',
        fontSize: 16,
    },
});
