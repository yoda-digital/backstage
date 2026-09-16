/*
 * Copyright 2026 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { useMemo, useRef, useState, WheelEvent, MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import Typography from '@material-ui/core/Typography';
import { useTheme } from '@material-ui/core/styles';
import {
  parseEntityRef,
  RELATION_DEPENDS_ON,
  stringifyEntityRef,
} from '@backstage/catalog-model';
import { DatasetEntityV1alpha1 } from '@backstage/plugin-data-experience-common';

const NODE_WIDTH = 200;
const NODE_HEIGHT = 48;
const COLUMN_GAP = 120;
const ROW_GAP = 24;
const MIN_SCALE = 0.4;
const MAX_SCALE = 2.5;

interface LineageNode {
  ref: string;
  label: string;
  layer: number;
  row: number;
}

interface LineageEdge {
  from: string;
  to: string;
}

function entityCatalogPath(ref: string): string {
  const { kind, namespace, name } = parseEntityRef(ref);
  return `/catalog/${namespace.toLowerCase()}/${kind.toLowerCase()}/${name}`;
}

/**
 * Builds a left-to-right layered layout of dataset lineage from a set of
 * Dataset entities, following their `dependsOn` relations upstream to
 * downstream.
 */
function buildGraph(datasets: DatasetEntityV1alpha1[]): {
  nodes: LineageNode[];
  edges: LineageEdge[];
} {
  const refs = new Map<string, DatasetEntityV1alpha1>();
  for (const dataset of datasets) {
    refs.set(stringifyEntityRef(dataset), dataset);
  }

  // An edge represents data flowing from an upstream dependency to the
  // entity that depends on it, i.e. the reverse of the `dependsOn` relation.
  const edges: LineageEdge[] = [];
  const dependents = new Map<string, Set<string>>();
  const dependencies = new Map<string, Set<string>>();
  for (const ref of refs.keys()) {
    dependents.set(ref, new Set());
    dependencies.set(ref, new Set());
  }

  for (const dataset of datasets) {
    const selfRef = stringifyEntityRef(dataset);
    for (const relation of dataset.relations ?? []) {
      if (relation.type !== RELATION_DEPENDS_ON) {
        continue;
      }
      const targetRef = relation.targetRef;
      if (!refs.has(targetRef)) {
        continue;
      }
      edges.push({ from: targetRef, to: selfRef });
      dependents.get(targetRef)?.add(selfRef);
      dependencies.get(selfRef)?.add(targetRef);
    }
  }

  // Layer assignment: nodes with no unresolved dependencies start at layer
  // 0; every other node sits one layer past its deepest dependency
  // (Kahn's algorithm, tracking the longest path from a root).
  const layer = new Map<string, number>();
  const remaining = new Map<string, number>(
    Array.from(dependencies.entries()).map(([ref, deps]) => [ref, deps.size]),
  );
  let frontier = Array.from(remaining.entries())
    .filter(([, count]) => count === 0)
    .map(([ref]) => ref);
  let currentLayer = 0;
  const visited = new Set<string>();

  while (frontier.length > 0) {
    const next: string[] = [];
    for (const ref of frontier) {
      if (visited.has(ref)) {
        continue;
      }
      visited.add(ref);
      layer.set(ref, currentLayer);
      for (const dependent of dependents.get(ref) ?? []) {
        const count = (remaining.get(dependent) ?? 0) - 1;
        remaining.set(dependent, count);
        if (count <= 0 && !visited.has(dependent)) {
          next.push(dependent);
        }
      }
    }
    frontier = next;
    currentLayer += 1;
  }

  // Anything left over is part of a cycle: place it after the deepest
  // known layer so it still renders instead of being dropped.
  const fallbackLayer = currentLayer;
  for (const ref of refs.keys()) {
    if (!layer.has(ref)) {
      layer.set(ref, fallbackLayer);
    }
  }

  const byLayer = new Map<number, string[]>();
  for (const [ref, l] of layer.entries()) {
    if (!byLayer.has(l)) {
      byLayer.set(l, []);
    }
    byLayer.get(l)!.push(ref);
  }

  const nodes: LineageNode[] = [];
  for (const [l, refsInLayer] of byLayer.entries()) {
    refsInLayer.sort();
    refsInLayer.forEach((ref, row) => {
      const dataset = refs.get(ref);
      nodes.push({
        ref,
        label: dataset?.metadata.title ?? dataset?.metadata.name ?? ref,
        layer: l,
        row,
      });
    });
  }

  return { nodes, edges };
}

/**
 * Renders an SVG left-to-right directed acyclic graph of dataset lineage,
 * derived from `dependsOn` relations between Dataset entities. Supports
 * pan (drag) and zoom (scroll wheel), and clicking a node navigates to its
 * catalog entity page.
 *
 * @public
 */
export function LineageGraph(props: {
  datasets: DatasetEntityV1alpha1[];
  focusRef?: string;
}): JSX.Element {
  const { datasets, focusRef } = props;
  const navigate = useNavigate();
  const theme = useTheme();
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const dragState = useRef<{ x: number; y: number } | null>(null);

  const { nodes, edges } = useMemo(() => buildGraph(datasets), [datasets]);

  const positions = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    for (const node of nodes) {
      map.set(node.ref, {
        x: node.layer * (NODE_WIDTH + COLUMN_GAP),
        y: node.row * (NODE_HEIGHT + ROW_GAP),
      });
    }
    return map;
  }, [nodes]);

  const width =
    nodes.length === 0
      ? 400
      : (Math.max(...nodes.map(n => n.layer)) + 1) * (NODE_WIDTH + COLUMN_GAP);
  const height =
    nodes.length === 0
      ? 200
      : (Math.max(...nodes.map(n => n.row)) + 1) * (NODE_HEIGHT + ROW_GAP);

  function handleWheel(event: WheelEvent<SVGSVGElement>): void {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.1 : 0.1;
    setTransform(prev => ({
      ...prev,
      scale: Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev.scale + delta)),
    }));
  }

  function handleMouseDown(event: MouseEvent<SVGSVGElement>): void {
    dragState.current = { x: event.clientX, y: event.clientY };
  }

  function handleMouseMove(event: MouseEvent<SVGSVGElement>): void {
    if (!dragState.current) {
      return;
    }
    const dx = event.clientX - dragState.current.x;
    const dy = event.clientY - dragState.current.y;
    dragState.current = { x: event.clientX, y: event.clientY };
    setTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
  }

  function handleMouseUp(): void {
    dragState.current = null;
  }

  if (nodes.length === 0) {
    return (
      <Typography color="textSecondary">
        No lineage relations found for these datasets.
      </Typography>
    );
  }

  return (
    <svg
      width="100%"
      height={Math.max(320, height + NODE_HEIGHT + 40)}
      viewBox={`0 0 ${Math.max(width + NODE_WIDTH, 400)} ${Math.max(
        height + NODE_HEIGHT,
        200,
      )}`}
      role="img"
      aria-label="Dataset lineage graph"
      style={{ cursor: dragState.current ? 'grabbing' : 'grab' }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <defs>
        <marker
          id="lineage-arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M0,0 L10,5 L0,10 z" fill={theme.palette.text.secondary} />
        </marker>
      </defs>
      <g
        transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}
      >
        {edges.map(edge => {
          const from = positions.get(edge.from);
          const to = positions.get(edge.to);
          if (!from || !to) {
            return null;
          }
          const x1 = from.x + NODE_WIDTH;
          const y1 = from.y + NODE_HEIGHT / 2;
          const x2 = to.x;
          const y2 = to.y + NODE_HEIGHT / 2;
          const midX = (x1 + x2) / 2;
          return (
            <path
              key={`${edge.from}->${edge.to}`}
              d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
              fill="none"
              stroke={theme.palette.text.secondary}
              strokeWidth={1.5}
              markerEnd="url(#lineage-arrow)"
            />
          );
        })}
        {nodes.map(node => {
          const position = positions.get(node.ref)!;
          const isFocused = node.ref === focusRef;
          return (
            <g
              key={node.ref}
              transform={`translate(${position.x}, ${position.y})`}
              onClick={() => navigate(entityCatalogPath(node.ref))}
              style={{ cursor: 'pointer' }}
            >
              <rect
                width={NODE_WIDTH}
                height={NODE_HEIGHT}
                rx={6}
                fill={
                  isFocused
                    ? theme.palette.primary.main
                    : theme.palette.background.paper
                }
                stroke={theme.palette.divider}
                strokeWidth={isFocused ? 2 : 1}
              />
              <text
                x={NODE_WIDTH / 2}
                y={NODE_HEIGHT / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={
                  isFocused
                    ? theme.palette.primary.contrastText
                    : theme.palette.text.primary
                }
                fontSize={13}
              >
                {node.label.length > 24
                  ? `${node.label.slice(0, 22)}…`
                  : node.label}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
