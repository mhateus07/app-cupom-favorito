import React from 'react';
import { DarkTheme, DefaultTheme, NavigationContainer, Theme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator, TransitionPresets } from '@react-navigation/stack';

import { HistoryScreen } from '../screens/HistoryScreen';
import { StatsScreen } from '../screens/StatsScreen';
import { ScanScreen } from '../screens/ScanScreen';
import { CupomDetailScreen } from '../screens/CupomDetailScreen';
import { ProductComparisonScreen } from '../screens/ProductComparisonScreen';
import { ShoppingListScreen } from '../screens/ShoppingListScreen';
import { ProdutosMonitoradosScreen } from '../screens/ProdutosMonitoradosScreen';
import { RevisarCupomScreen } from '../screens/RevisarCupomScreen';
import { RootStackParamList, TabParamList } from './types';
import { TabBar } from './TabBar';
import { useTema } from '../theme';

const Tab = createBottomTabNavigator<TabParamList>();
const RootStack = createStackNavigator<RootStackParamList>();

const Tabs = () => (
  <Tab.Navigator tabBar={props => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
    <Tab.Screen name="Cupons" component={HistoryScreen} />
    <Tab.Screen name="Analises" component={StatsScreen} />
  </Tab.Navigator>
);

export const AppNavigator = () => {
  const { cores, escuro } = useTema();
  const base = escuro ? DarkTheme : DefaultTheme;
  const tema: Theme = {
    ...base,
    colors: {
      ...base.colors,
      primary: cores.text,
      background: cores.background,
      card: cores.background,
      text: cores.text,
      border: cores.border,
    },
  };

  return (
    <NavigationContainer theme={tema}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        <RootStack.Screen name="Tabs" component={Tabs} />
        <RootStack.Screen name="CupomDetail" component={CupomDetailScreen} />
        <RootStack.Screen name="ProductComparison" component={ProductComparisonScreen} />
        <RootStack.Screen name="ShoppingList" component={ShoppingListScreen} />
        <RootStack.Screen name="ProdutosMonitorados" component={ProdutosMonitoradosScreen} />
        <RootStack.Screen
          name="RevisarCupom"
          component={RevisarCupomScreen}
          options={{ gestureEnabled: false }}
        />
        <RootStack.Screen
          name="Scan"
          component={ScanScreen}
          options={{ ...TransitionPresets.ModalSlideFromBottomIOS, gestureEnabled: false }}
        />
      </RootStack.Navigator>
    </NavigationContainer>
  );
};
