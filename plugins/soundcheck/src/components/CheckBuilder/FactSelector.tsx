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

import {
  SoundcheckBaseRuleOperator,
  SoundcheckRuleOperator,
} from '@backstage/plugin-soundcheck-common';
import Box from '@material-ui/core/Box';
import Grid from '@material-ui/core/Grid';
import IconButton from '@material-ui/core/IconButton';
import ListSubheader from '@material-ui/core/ListSubheader';
import MenuItem from '@material-ui/core/MenuItem';
import TextField from '@material-ui/core/TextField';
import Tooltip from '@material-ui/core/Tooltip';
import DeleteIcon from '@material-ui/icons/Delete';
import { SoundcheckFactCollector } from '../../api/ref';
import { RuleConditionNode } from './types';

type ArrayMode = 'single' | 'all' | 'any' | 'none';

const OPERATOR_GROUPS: {
  label: string;
  operators: SoundcheckBaseRuleOperator[];
}[] = [
  {
    label: 'Equality',
    operators: ['equal', 'notEqual', 'exists', 'notExists'],
  },
  {
    label: 'Comparison',
    operators: [
      'greaterThan',
      'lessThan',
      'greaterThanOrEqual',
      'lessThanOrEqual',
    ],
  },
  {
    label: 'String & array',
    operators: [
      'contains',
      'notContains',
      'doesNotContain',
      'matches',
      'in',
      'notIn',
      'hasLengthOf',
    ],
  },
  {
    label: 'Semantic version',
    operators: [
      'semverGt',
      'semverGte',
      'semverLt',
      'semverLte',
      'semverEq',
      'semverNeq',
      'semverSatisfies',
      'semverGtr',
      'semverLtr',
    ],
  },
  {
    label: 'Date & time',
    operators: ['after', 'before'],
  },
];

const NO_VALUE_OPERATORS: SoundcheckBaseRuleOperator[] = [
  'exists',
  'notExists',
];

const DATE_PATH_HINT = /(date|time|_at$|At$|expires|created|updated)/;
const VERSION_PATH_HINT = /version/i;

/**
 * Reorders the operator groups so the ones most relevant to the given path
 * are shown first — a lightweight heuristic based on the field's name
 * (e.g. a `version` path surfaces semver operators, a `*At` or `date` path
 * surfaces date operators).
 */
function suggestGroupOrder(
  path: string,
): { label: string; operators: SoundcheckBaseRuleOperator[] }[] {
  if (VERSION_PATH_HINT.test(path)) {
    const semver = OPERATOR_GROUPS.find(g => g.label === 'Semantic version')!;
    return [semver, ...OPERATOR_GROUPS.filter(g => g !== semver)];
  }
  if (DATE_PATH_HINT.test(path)) {
    const date = OPERATOR_GROUPS.find(g => g.label === 'Date & time')!;
    return [date, ...OPERATOR_GROUPS.filter(g => g !== date)];
  }
  return OPERATOR_GROUPS;
}

function splitOperator(operator: SoundcheckRuleOperator): {
  base: SoundcheckBaseRuleOperator;
  mode: ArrayMode;
} {
  const match = /^(all|any|none):(.+)$/.exec(operator);
  if (!match) {
    return { base: operator as SoundcheckBaseRuleOperator, mode: 'single' };
  }
  const [, mode, base] = match;
  return { base: base as SoundcheckBaseRuleOperator, mode: mode as ArrayMode };
}

function joinOperator(
  base: SoundcheckBaseRuleOperator,
  mode: ArrayMode,
): SoundcheckRuleOperator {
  return mode === 'single'
    ? base
    : (`${mode}:${base}` as SoundcheckRuleOperator);
}

/**
 * Attempts to parse a typed value as JSON (so authors can enter numbers,
 * booleans, or `["a", "b"]` arrays for operators like `in`), falling back to
 * the raw string when it isn't valid JSON.
 */
function parseValue(raw: string): unknown {
  if (raw === '') {
    return '';
  }
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function formatValue(value: unknown): string {
  if (value === undefined || value === '') {
    return '';
  }
  return typeof value === 'string' ? value : JSON.stringify(value);
}

/**
 * Props for {@link FactSelector}.
 *
 * @public
 */
export interface FactSelectorProps {
  node: RuleConditionNode;
  onChange: (node: RuleConditionNode) => void;
  onRemove?: () => void;
  factCollectors: SoundcheckFactCollector[];
  /** The owning check's default fact ref, used when the condition omits its own. */
  defaultFactRef: string;
}

/**
 * Editor for a single rule condition — the fact it reads, the path resolved
 * out of that fact's data, the comparison operator, and the value compared
 * against. Used as the leaf node of the {@link RuleBuilder} tree.
 *
 * @public
 */
export function FactSelector(props: FactSelectorProps) {
  const { node, onChange, onRemove, factCollectors, defaultFactRef } = props;
  const { base, mode } = splitOperator(node.operator);
  const showValue = !NO_VALUE_OPERATORS.includes(base);
  const groups = suggestGroupOrder(node.path);

  return (
    <Box display="flex" alignItems="flex-start" gridGap={8}>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={3}>
          <TextField
            select
            fullWidth
            size="small"
            label="Fact"
            value={node.factRef ?? ''}
            helperText={
              !node.factRef
                ? `Defaults to ${defaultFactRef || 'check fact'}`
                : ' '
            }
            onChange={event =>
              onChange({ ...node, factRef: event.target.value || undefined })
            }
          >
            <MenuItem value="">
              <em>Use check's default fact</em>
            </MenuItem>
            {factCollectors.map(collector => (
              <MenuItem key={collector.factRef} value={collector.factRef}>
                {collector.factRef}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid item xs={12} sm={3}>
          <TextField
            fullWidth
            size="small"
            label="Path"
            placeholder="$.spec.version"
            value={node.path}
            onChange={event => onChange({ ...node, path: event.target.value })}
          />
        </Grid>
        <Grid item xs={8} sm={3}>
          <TextField
            select
            fullWidth
            size="small"
            label="Operator"
            value={base}
            onChange={event =>
              onChange({
                ...node,
                operator: joinOperator(
                  event.target.value as SoundcheckBaseRuleOperator,
                  mode,
                ),
              })
            }
          >
            {groups.map(group => [
              <ListSubheader key={group.label}>{group.label}</ListSubheader>,
              ...group.operators.map(operator => (
                <MenuItem key={operator} value={operator}>
                  {operator}
                </MenuItem>
              )),
            ])}
          </TextField>
        </Grid>
        <Grid item xs={4} sm={1}>
          <TextField
            select
            fullWidth
            size="small"
            label="Applies to"
            value={mode}
            onChange={event =>
              onChange({
                ...node,
                operator: joinOperator(base, event.target.value as ArrayMode),
              })
            }
          >
            <MenuItem value="single">Value</MenuItem>
            <MenuItem value="all">Every item</MenuItem>
            <MenuItem value="any">Any item</MenuItem>
            <MenuItem value="none">No item</MenuItem>
          </TextField>
        </Grid>
        <Grid item xs={12} sm={2}>
          <TextField
            fullWidth
            size="small"
            disabled={!showValue}
            label="Value"
            placeholder={showValue ? 'value or ["a","b"]' : 'not needed'}
            value={showValue ? formatValue(node.value) : ''}
            onChange={event =>
              onChange({ ...node, value: parseValue(event.target.value) })
            }
          />
        </Grid>
      </Grid>
      {onRemove && (
        <Tooltip title="Remove condition">
          <IconButton
            size="small"
            onClick={onRemove}
            aria-label="Remove condition"
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
}
