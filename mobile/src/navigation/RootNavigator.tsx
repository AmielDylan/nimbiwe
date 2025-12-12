import React, { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SplashScreen from '../screens/SplashScreen';
import AuthScreen from '../screens/AuthScreen';
import OTPScreen from '../screens/OTPScreen';
import MainNavigator from './MainNavigator';
import PriceEntryScreen from '../screens/PriceEntryScreen';

export type RootStackParamList = {
    Splash: undefined;
    Auth: undefined;
    OTP: { phoneOrEmail: string; expiresIn: number };
    Home: undefined;
    PriceEntry: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
    const { isAuthenticated, loadTokens, isLoading } = useAuthStore();

    useEffect(() => {
        loadTokens();
    }, []);

    // Afficher le spalsh tant qu'on charge
    if (isLoading) {
        return <SplashScreen />;
    }

    return (
        <NavigationContainer>
            <Stack.Navigator
                screenOptions={{
                    headerShown: false,
                    animation: 'slide_from_right',
                }}
            >
                {isAuthenticated ? (
                    // Ecrans Authentifiés
                    <>
                        <Stack.Screen name="Home" component={MainNavigator} />
                        <Stack.Screen name="PriceEntry" component={PriceEntryScreen} />
                    </>
                ) : (
                    // Ecrans Non-Authentifiés
                    <>
                        <Stack.Screen name="Auth" component={AuthScreen} />
                        <Stack.Screen name="OTP" component={OTPScreen} />
                    </>
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
}
