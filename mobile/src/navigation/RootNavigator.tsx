import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SplashScreen from '../screens/SplashScreen';
import AuthScreen from '../screens/AuthScreen';
import OTPScreen from '../screens/OTPScreen';
import HomeScreen from '../screens/HomeScreen';
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
    return (
        <NavigationContainer>
            <Stack.Navigator
                initialRouteName="Splash"
                screenOptions={{
                    headerShown: false,
                    animation: 'slide_from_right',
                }}
            >
                <Stack.Screen name="Splash" component={SplashScreen} />
                <Stack.Screen name="Auth" component={AuthScreen} />
                <Stack.Screen name="OTP" component={OTPScreen} />
                <Stack.Screen name="Home" component={HomeScreen} />
                <Stack.Screen name="PriceEntry" component={PriceEntryScreen} />
            </Stack.Navigator>
        </NavigationContainer>
    );
}
