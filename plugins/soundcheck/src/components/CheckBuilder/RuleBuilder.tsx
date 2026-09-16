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

import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import IconButton from '@material-ui/core/IconButton';
import MenuItem from '@material-ui/core/MenuItem';
import Paper from '@material-ui/core/Paper';
import TextField from '@material-ui/core/TextField';
import Tooltip from '@material-ui/core/Tooltip';
import Typography from '@material-ui/core/Typography';
import AddIcon from '@material-ui/icons/Add';
import ArrowDownwardIcon from '@material-ui/icons/ArrowDownward';
import ArrowUpwardIcon from '@material-ui/icons/ArrowUpward';
import DeleteIcon from '@material-ui/icons/Delete';
import { SoundcheckFactCollector } from '../../api/ref';
import { FactSelector } from './FactSelector';
import {
  RuleGroupNode,
  RuleNode,
  createConditionNode,
  createGroupNode,
} from './types';

const COMBINATOR_LABEL: Record<RuleGroupNode['kind'], string> = {
  all: 'ALL of the following must pass',
  any: 'ANY of the following must pass',
  not: 'NONE of the following may pass',
};

/**
 * Props for {@link RuleBuilder}.
 *
 * @public
 */
export interface RuleBuilderProps {
  node: RuleNode;
  onChange: (node: RuleNode) => void;
  onRemove?: () => void;
  factCollectors: SoundcheckFactCollector[];
  defaultFactRef: string;
}

/**
 * Visual, recursive tree editor for a check's rule — boolean combinator
 * groups (`all`/`any`/`not`) whose children are either nested groups or leaf
 * conditions edited with {@link FactSelector}. Supports adding, removing, and
 * reordering rules at every level.
 *
 * @public
 */
export function RuleBuilder(props: RuleBuilderProps) {
  const { node, onChange, onRemove, factCollectors, defaultFactRef } = props;

  if (node.kind === 'condition') {
    return (
      <FactSelector
        node={node}
        onChange={onChange}
        onRemove={onRemove}
        factCollectors={factCollectors}
        defaultFactRef={defaultFactRef}
      />
    );
  }

  // Captured in its own binding (rather than referencing the narrowed `node`
  // param directly) so the `RuleGroupNode` type survives inside the closures
  // below — TypeScript does not retain narrowing of a parameter across
  // nested function boundaries.
  const group: RuleGroupNode = node;
  const { children } = group;

  function updateChild(index: number, child: RuleNode) {
    const next = children.slice();
    next[index] = child;
    onChange({ ...group, children: next });
  }

  function removeChild(index: number) {
    onChange({ ...group, children: children.filter((_, i) => i !== index) });
  }

  function moveChild(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= children.length) {
      return;
    }
    const next = children.slice();
    [next[index], next[target]] = [next[target], next[index]];
    onChange({ ...group, children: next });
  }

  function addCondition() {
    onChange({ ...group, children: [...children, createConditionNode()] });
  }

  function addGroup() {
    onChange({ ...group, children: [...children, createGroupNode('all')] });
  }

  return (
    <Paper variant="outlined">
      <Box p={2}>
        <Box display="flex" alignItems="center" gridGap={16} mb={2}>
          <TextField
            select
            size="small"
            label="Combinator"
            value={node.kind}
            onChange={event => {
              const kind = event.target.value as RuleGroupNode['kind'];
              const nextChildren =
                kind === 'not' ? children.slice(0, 1) : children;
              onChange({
                ...group,
                kind,
                children: nextChildren.length
                  ? nextChildren
                  : [createConditionNode()],
              });
            }}
            style={{ minWidth: 220 }}
          >
            <MenuItem value="all">All (AND)</MenuItem>
            <MenuItem value="any">Any (OR)</MenuItem>
            <MenuItem value="not">Not</MenuItem>
          </TextField>
          <Typography variant="body2" color="textSecondary">
            {COMBINATOR_LABEL[node.kind]}
          </Typography>
          {onRemove && (
            <Box marginLeft="auto">
              <Tooltip title="Remove group">
                <IconButton
                  size="small"
                  onClick={onRemove}
                  aria-label="Remove group"
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          )}
        </Box>

        <Box display="flex" flexDirection="column" gridGap={12}>
          {children.map((child, index) => (
            <Box
              key={child.id}
              display="flex"
              alignItems="flex-start"
              gridGap={4}
            >
              <Box display="flex" flexDirection="column">
                <Tooltip title="Move up">
                  <Box component="span">
                    <IconButton
                      size="small"
                      disabled={index === 0}
                      onClick={() => moveChild(index, -1)}
                      aria-label="Move rule up"
                    >
                      <ArrowUpwardIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Tooltip>
                <Tooltip title="Move down">
                  <Box component="span">
                    <IconButton
                      size="small"
                      disabled={index === children.length - 1}
                      onClick={() => moveChild(index, 1)}
                      aria-label="Move rule down"
                    >
                      <ArrowDownwardIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Tooltip>
              </Box>
              <Box flexGrow={1}>
                <RuleBuilder
                  node={child}
                  onChange={next => updateChild(index, next)}
                  onRemove={
                    node.kind === 'not' || children.length <= 1
                      ? undefined
                      : () => removeChild(index)
                  }
                  factCollectors={factCollectors}
                  defaultFactRef={defaultFactRef}
                />
              </Box>
            </Box>
          ))}
        </Box>

        {node.kind !== 'not' && (
          <Box display="flex" gridGap={8} mt={2}>
            <Button size="small" startIcon={<AddIcon />} onClick={addCondition}>
              Add condition
            </Button>
            <Button size="small" startIcon={<AddIcon />} onClick={addGroup}>
              Add nested group
            </Button>
          </Box>
        )}
      </Box>
    </Paper>
  );
}
