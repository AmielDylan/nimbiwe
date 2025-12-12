import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import HomeScreen from '../screens/HomeScreen';
import HistoryScreen from '../screens/HistoryScreen';
import ProfileScreen from '../screens/ProfileScreen';
import TrendsScreen from '../screens/TrendsScreen';
import PriceEntryScreen from '../screens/PriceEntryScreen';
import { colors } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';

const Tab = createBottomTabNavigator();
const HomeStack = createStackNavigator();

function HomeStackScreen() {
    return (
        <HomeStack.Navigator screenOptions={{ headerShown: false }}>
            <HomeStack.Screen name="HomeScreen" component={HomeScreen} />
            <HomeStack.Screen name="TrendsScreen" component={TrendsScreen} />
        </HomeStack.Navigator>
    );
}

export default function MainNavigator() {
    return (
        <Tab.Navigator
            screenOptions={{
                tabBarShowLabel: true,
                tabBarStyle: {
                    backgroundColor: colors.background,
                    borderTopWidth: 0,
                    elevation: 0,
                    shadowOpacity: 0,
                    height: 100,
                    paddingBottom: 30,
                    paddingTop: 10,
                },
                headerShown: false,
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: colors.textLight,
            }}
        >
            <Tab.Screen
                name="Dashboard"
                component={HomeStackScreen}
                options={{
                    title: 'Dashboard',
                    tabBarIcon: ({ color, size, focused }) => (
                        <Ionicons name={focused ? "home" : "home-outline"} size={24} color={color} />
                    ),
                }}
            />

            <Tab.Screen
                name="Tendances"
                component={TrendsScreen}
                options={{
                    title: 'Analyses',
                    tabBarIcon: ({ color, size, focused }) => (
                        <Ionicons name={focused ? "stats-chart" : "stats-chart-outline"} size={24} color={color} />
                    ),
                }}
            />

            <Tab.Screen
                name="PriceEntry"
                component={PriceEntryScreen}
                options={{
                    title: 'Saisie',
                    tabBarIcon: ({ color, size, focused }) => (
                        <Ionicons name={focused ? "add-circle" : "add-circle-outline"} size={26} color={color} />
                    ),
                }}
            />

            <Tab.Screen
                name="History"
                component={HistoryScreen}
                options={{
                    title: 'Historique',
                    tabBarIcon: ({ color, size, focused }) => (
                        <Ionicons name={focused ? "time" : "time-outline"} size={24} color={color} />
                    ),
                }}
            />

            <Tab.Screen
                name="Profile"
                component={ProfileScreen}
                options={{
                    title: 'Profil',
                    tabBarIcon: ({ color, size, focused }) => (
                        <Ionicons name={focused ? "person" : "person-outline"} size={24} color={color} />
                    ),
                }}
            />
        </Tab.Navigator>
    );
}
