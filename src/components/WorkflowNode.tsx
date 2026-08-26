import React, {useEffect, useRef} from 'react';
import {interpolate, random, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {CARD, PLANE, planeMatrixCss, toScreen, type Pt} from '../geometry';
import {NODE_SPRING} from '../timeline';
import {THEMES, withAlpha, type Variant} from '../theme';
import type {WorkflowNodeData} from '../workflows';
import {NodeIcon} from './NodeIcon';
import {CARD_BOX, CARD_PAD} from './cardSprite';

/**
 * One card on the plane: springs in from 0.8, blooms as it lands, then breathes
 * on a slow sine. The card artwork itself is a pre-rendered sprite passed in
 * from the parent, so nothing is re-rasterised per frame.
 */
export const WorkflowNode: React.FC<{
  node: WorkflowNodeData;
  variant: Variant;
  origin: Pt;
  startFrame: number;
  sprite: HTMLCanvasElement;
  fontFamily: string;
}> = ({node, variant, origin, startFrame, sprite, fontFamily}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const theme = THEMES[variant];
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, CARD_BOX, CARD_BOX);
    ctx.drawImage(sprite, 0, 0);
  });

  const enter = spring({frame: frame - startFrame, fps, config: NODE_SPRING});
  const scale = interpolate(enter, [0, 1], [0.8, 1]);
  const opacity = interpolate(enter, [0, 0.32], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Bloom spike as the card lands, then a slow +/-10% breath.
  const sinceLand = frame - (startFrame + 7);
  const landBloom = 1.55 * Math.exp(-((sinceLand / 7) ** 2));
  const phase = random(`glow-${variant}-${node.id}`);
  const breath = 1 + 0.1 * Math.sin(Math.PI * 2 * (frame / 96 + phase));
  const glow = breath * (1 + landBloom);

  const p = toScreen({x: node.x, y: node.y}, origin, PLANE);

  return (
    <div
      style={{
        position: 'absolute',
        left: p.x - CARD / 2,
        top: p.y - CARD / 2,
        width: CARD,
        height: CARD,
        opacity,
        transformOrigin: 'center center',
        transform: `${planeMatrixCss()} scale(${scale})`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          filter: `drop-shadow(0 0 ${18 * glow}px ${withAlpha(
            theme.nodeBorder,
            0.55,
          )}) drop-shadow(0 0 ${52 * glow}px ${withAlpha(theme.nodeBorder, 0.3)})`,
        }}
      >
        <canvas
          ref={canvasRef}
          width={CARD_BOX}
          height={CARD_BOX}
          style={{
            position: 'absolute',
            left: -CARD_PAD,
            top: -CARD_PAD,
            width: CARD_BOX,
            height: CARD_BOX,
          }}
        />
        <NodeIcon icon={node.icon} variant={variant} />
      </div>

      <div
        style={{
          position: 'absolute',
          top: CARD + CARD * 0.16,
          left: -CARD * 0.85,
          width: CARD * 2.7,
          textAlign: 'center',
          fontFamily,
          fontWeight: 500,
          fontSize: CARD * 0.215,
          letterSpacing: CARD * 0.008,
          lineHeight: 1.18,
          color: theme.label,
          textShadow: `0 0 ${10 * glow}px ${withAlpha(theme.label, 0.9)}, 0 0 ${
            30 * glow
          }px ${withAlpha(theme.label, 0.5)}`,
          whiteSpace: 'pre-line',
        }}
      >
        {node.label}
      </div>
    </div>
  );
};
