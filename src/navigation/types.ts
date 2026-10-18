import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import { StackScreenProps } from '@react-navigation/stack';
import { CupomData } from '../models/types';

export type TabParamList = {
  Cupons: undefined;
  Analises: undefined;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList>;
  CupomDetail: { cupomId: number };
  ProductComparison: { produto: string };
  ShoppingList: undefined;
  ProdutosMonitorados: { produto?: string } | undefined;
  RevisarCupom: { cupom: CupomData };
  Conta: undefined;
  Scan: undefined;
};

export type RootScreenProps<T extends keyof RootStackParamList> = StackScreenProps<
  RootStackParamList,
  T
>;

export type TabScreenProps<T extends keyof TabParamList> = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, T>,
  StackScreenProps<RootStackParamList>
>;
