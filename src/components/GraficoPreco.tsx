import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { PontoPreco } from '../models/types';
import { colors, space, useTema } from '../theme';
import { formatarDiaMes, formatarValor } from '../utils/formatacao';
import { Texto } from './ui';

const ALTURA = 140;
const MARGEM = 10; // espaço para o marcador não ser cortado nas bordas
const ALVO_TOQUE = 36;

/**
 * Evolução do preço de um produto: linha fina de 2px, marcador em cada compra e o menor
 * preço destacado em lima. Tocar num ponto mostra o valor, a data e o mercado.
 */
export const GraficoPreco: React.FC<{ pontos: PontoPreco[] }> = ({ pontos }) => {
  const { cores } = useTema();
  const [largura, setLargura] = useState(0);
  const [escolhido, setSelecionado] = useState<number | null>(null);
  // Sem toque, mostra a compra mais recente
  const selecionado =
    escolhido === null ? pontos.length - 1 : Math.min(escolhido, pontos.length - 1);

  const precos = pontos.map(p => p.preco);
  const minimo = Math.min(...precos);
  const maximo = Math.max(...precos);
  const faixa = maximo - minimo || 1;
  const indiceMinimo = precos.indexOf(minimo);

  const area = largura - MARGEM * 2;
  const x = (i: number) =>
    MARGEM + (pontos.length === 1 ? area / 2 : (i / (pontos.length - 1)) * area);
  const y = (preco: number) => MARGEM + (1 - (preco - minimo) / faixa) * (ALTURA - MARGEM * 2);

  const atual = pontos[selecionado];

  return (
    <View>
      <View style={styles.legenda}>
        <View>
          <Texto variante="number">R$ {formatarValor(atual.preco)}</Texto>
          <Texto variante="small" cor={cores.textMuted} numberOfLines={1}>
            {formatarDiaMes(atual.data)} · {atual.estabelecimento}
          </Texto>
        </View>
        <View style={styles.escala}>
          <Texto variante="numberSmall" cor={cores.textMuted}>
            máx {formatarValor(maximo)}
          </Texto>
          <Texto variante="numberSmall" cor={cores.textMuted}>
            mín {formatarValor(minimo)}
          </Texto>
        </View>
      </View>

      <View
        style={styles.plot}
        onLayout={e => setLargura(e.nativeEvent.layout.width)}
        accessibilityLabel={`Evolução do preço: de R$ ${formatarValor(pontos[0].preco)} a R$ ${formatarValor(pontos[pontos.length - 1].preco)}`}
      >
        {largura > 0 && (
          <>
            <Svg width={largura} height={ALTURA}>
              {[MARGEM, ALTURA - MARGEM].map(linha => (
                <Line
                  key={linha}
                  x1={0}
                  x2={largura}
                  y1={linha}
                  y2={linha}
                  stroke={cores.border}
                  strokeWidth={1}
                />
              ))}
              <Line
                x1={x(selecionado)}
                x2={x(selecionado)}
                y1={0}
                y2={ALTURA}
                stroke={cores.textMuted}
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              {pontos.length > 1 && (
                <Polyline
                  points={pontos.map((p, i) => `${x(i)},${y(p.preco)}`).join(' ')}
                  fill="none"
                  stroke={cores.text}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )}
              {pontos.map((p, i) => (
                <Circle
                  key={i}
                  cx={x(i)}
                  cy={y(p.preco)}
                  r={i === selecionado ? 6 : 4}
                  fill={i === indiceMinimo ? colors.lima : cores.text}
                  stroke={i === indiceMinimo ? colors.tinta : cores.surface}
                  strokeWidth={2}
                />
              ))}
            </Svg>
            {pontos.map((p, i) => (
              <Pressable
                key={i}
                accessibilityRole="button"
                accessibilityLabel={`R$ ${formatarValor(p.preco)} em ${formatarDiaMes(p.data)}, ${p.estabelecimento}`}
                onPress={() => setSelecionado(i)}
                style={[
                  styles.alvo,
                  { left: x(i) - ALVO_TOQUE / 2, top: y(p.preco) - ALVO_TOQUE / 2 },
                ]}
              />
            ))}
          </>
        )}
      </View>

      <View style={styles.datas}>
        <Texto variante="label" cor={cores.textMuted}>
          {formatarDiaMes(pontos[0].data)}
        </Texto>
        <Texto variante="label" cor={cores.textMuted}>
          {formatarDiaMes(pontos[pontos.length - 1].data)}
        </Texto>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  legenda: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: space.lg,
    marginBottom: space.md,
  },
  escala: { alignItems: 'flex-end' },
  plot: { height: ALTURA },
  alvo: { position: 'absolute', width: ALVO_TOQUE, height: ALVO_TOQUE },
  datas: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: space.sm,
  },
});
