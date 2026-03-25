import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Screens
import { HistoryScreen } from '../screens/HistoryScreen';
import { StatsScreen } from '../screens/StatsScreen';
import { ScanScreen } from '../screens/ScanScreen';
import { CupomDetailScreen } from '../screens/CupomDetailScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Stack Navigator para Histórico
const HistoryStack = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="HistoryList"
        component={HistoryScreen}
        options={{ title: 'Histórico de Cupons' }}
      />
      <Stack.Screen
        name="CupomDetail"
        component={CupomDetailScreen}
        options={{ title: 'Detalhes do Cupom' }}
      />
      <Stack.Screen
        name="Scan"
        component={ScanScreen}
        options={{
          title: 'Escanear Cupom',
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
};

// Stack Navigator para Estatísticas
const StatsStack = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="StatsList"
        component={StatsScreen}
        options={{ title: 'Estatísticas' }}
      />
    </Stack.Navigator>
  );
};

// Tab Navigator Principal
export const AppNavigator = () => {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            let iconName: string = 'help';

            if (route.name === 'History') {
              iconName = focused ? 'receipt' : 'receipt-outline';
            } else if (route.name === 'Stats') {
              iconName = focused ? 'chart-box' : 'chart-box-outline';
            }

            return <MaterialCommunityIcons name={iconName as any} size={size} color={color} />;
          },
          tabBarActiveTintColor: '#6200ee',
          tabBarInactiveTintColor: 'gray',
          headerShown: false,
        })}
      >
        <Tab.Screen
          name="History"
          component={HistoryStack}
          options={{ title: 'Histórico' }}
        />
        <Tab.Screen name="Stats" component={StatsStack} options={{ title: 'Estatísticas' }} />
      </Tab.Navigator>
    </NavigationContainer>
  );
};
