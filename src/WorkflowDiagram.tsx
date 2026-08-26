import React, {useEffect, useMemo, useState} from 'react';
import {loadFont} from '@remotion/google-fonts/Inter';
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  interpolate,
  random,
  useCurrentFrame,
} from 'remotion';
import {HEIGHT, WIDTH, routeEdges} from './geometry';
import {DURATION} from './timeline';
import {buildSchedule} from './timeline';
import {THEMES, type Variant} from './theme';
import {WORKFLOWS} from './workflows';
import {NeonConnector} from './components/NeonConnector';
import {StarPlane} from './components/StarPlane';
import {WorkflowNode} from './components/WorkflowNode';
import {Finish} from './components/Finish';
import {makeCardSprite} from './components/cardSprite';

const font = loadFont('normal', {weights: ['400', '500', '600'], subsets: ['latin']});

export type WorkflowDiagramProps = {
  variant: Variant;
};

export const WorkflowDiagram: React.FC<WorkflowDiagramProps> = ({variant}) => {
  const frame = useCurrentFrame();
  const theme = THEMES[variant];
  const workflow = WORKFLOWS[variant];

  const [fontHandle] = useState(() => delayRender('Loading Inter'));
  useEffect(() => {
    font
      .waitUntilDone()
      .then(() => continueRender(fontHandle))
      .catch(() => continueRender(fontHandle));
  }, [fontHandle]);

  const edges = useMemo(() => routeEdges(workflow), [workflow]);
  const schedule = useMemo(() => buildSchedule(workflow), [workflow]);
  const cardSprite = useMemo(() => makeCardSprite(theme), [theme]);

  // Camera: a very slow drift down and to the right, plus an ambient wobble.
  const driftX = interpolate(frame, [0, DURATION], [-90, 130]);
  const driftY = interpolate(frame, [0, DURATION], [-80, 110]);
  const wobbleX =
    9 * Math.sin(frame / 47 + random(`wob-ax-${variant}`) * Math.PI * 2) +
    4 * Math.sin(frame / 29 + random(`wob-bx-${variant}`) * Math.PI * 2);
  const wobbleY =
    7 * Math.sin(frame / 61 + random(`wob-ay-${variant}`) * Math.PI * 2) +
    3 * Math.cos(frame / 37 + random(`wob-by-${variant}`) * Math.PI * 2);

  const camX = driftX + wobbleX;
  const camY = driftY + wobbleY;
  const origin = {x: WIDTH / 2 + camX, y: HEIGHT / 2 + camY};

  const fontFamily = `${font.fontFamily}, sans-serif`;

  return (
    <AbsoluteFill style={{backgroundColor: theme.backgroundDeep}}>
      <StarPlane variant={variant} camX={camX} camY={camY} />

      <AbsoluteFill>
        <svg
          width={WIDTH}
          height={HEIGHT}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          style={{position: 'absolute', inset: 0}}
        >
          {edges.map((edge) => (
            <NeonConnector
              key={edge.key}
              edge={edge}
              variant={variant}
              origin={origin}
              startFrame={schedule.edgeStart[edge.key]}
            />
          ))}
        </svg>

        {workflow.nodes.map((node) => (
          <WorkflowNode
            key={node.id}
            node={node}
            variant={variant}
            origin={origin}
            startFrame={schedule.nodeStart[node.id]}
            sprite={cardSprite}
            fontFamily={fontFamily}
          />
        ))}
      </AbsoluteFill>

      <Finish variant={variant} />
    </AbsoluteFill>
  );
};
