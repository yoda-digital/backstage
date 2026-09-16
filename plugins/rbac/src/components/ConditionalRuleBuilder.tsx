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

import React from 'react';
import Button from '@material-ui/core/Button';
import IconButton from '@material-ui/core/IconButton';
import MenuItem from '@material-ui/core/MenuItem';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import AddIcon from '@material-ui/icons/Add';
import DeleteIcon from '@material-ui/icons/Delete';
import { RbacCondition } from '@backstage/plugin-rbac-common';

/**
 * Describes a single parameter accepted by a conditional rule, used to
 * render an appropriate input field for it.
 *
 * @public
 */
export interface ConditionalRuleParamDefinition {
  name: string;
  label: string;
  required: boolean;
}

/**
 * Describes a conditional rule that can be attached to a permission
 * decision, mirroring the built-in rules registered by the RBAC backend
 * (see `plugins/rbac-backend/src/service/conditionalRules.ts`).
 *
 * @public
 */
export interface ConditionalRuleDefinition {
  name: string;
  description: string;
  params: ConditionalRuleParamDefinition[];
}

/**
 * The built-in RBAC conditional rules, available for use in the
 * {@link ConditionalRuleBuilder}. The RBAC backend does not (yet) expose a
 * discovery endpoint for registered conditional rules, so this list mirrors
 * the rules built into `@backstage/plugin-rbac-backend`. `IS_ENTITY_OWNER`
 * takes no author-supplied parameters: the set of entity refs it matches
 * against is injected by the backend from the caller's identity at
 * evaluation time.
 *
 * @public
 */
export const CONDITIONAL_RULE_DEFINITIONS: ConditionalRuleDefinition[] = [
  {
    name: 'IS_ENTITY_OWNER',
    description: "Allow entities owned by one of the user's claims",
    params: [],
  },
  {
    name: 'HAS_ANNOTATION',
    description: 'Allow entities with the specified annotation',
    params: [
      { name: 'annotation', label: 'Annotation name', required: true },
      { name: 'value', label: 'Annotation value (optional)', required: false },
    ],
  },
  {
    name: 'HAS_TAG',
    description: 'Allow entities with the specified tag',
    params: [{ name: 'tag', label: 'Tag', required: true }],
  },
  {
    name: 'HAS_LABEL',
    description: 'Allow entities with the specified label',
    params: [
      { name: 'label', label: 'Label name', required: true },
      { name: 'value', label: 'Label value (optional)', required: false },
    ],
  },
  {
    name: 'IN_SYSTEM',
    description: 'Allow entities that belong to the specified system',
    params: [{ name: 'system', label: 'System name', required: true }],
  },
];

function definitionFor(ruleName: string): ConditionalRuleDefinition {
  return (
    CONDITIONAL_RULE_DEFINITIONS.find(rule => rule.name === ruleName) ??
    CONDITIONAL_RULE_DEFINITIONS[0]
  );
}

/**
 * Props for {@link ConditionalRuleBuilder}.
 *
 * @public
 */
export interface ConditionalRuleBuilderProps {
  conditions: RbacCondition[];
  onChange: (conditions: RbacCondition[]) => void;
  disabled?: boolean;
}

/**
 * Edits the list of conditional rules attached to a single permission
 * decision. The RBAC backend evaluates a decision's conditions as a single
 * conjunction (every condition must match), so this builder does not offer
 * an "any" mode.
 */
export function ConditionalRuleBuilder(
  props: ConditionalRuleBuilderProps,
): React.JSX.Element {
  const { conditions, onChange, disabled } = props;

  const handleRuleChange = (index: number, ruleName: string) => {
    const next = conditions.map((condition, i) =>
      i === index ? { rule: ruleName, params: {} } : condition,
    );
    onChange(next);
  };

  const handleParamChange = (index: number, param: string, value: string) => {
    const next = conditions.map((condition, i) =>
      i === index
        ? { ...condition, params: { ...condition.params, [param]: value } }
        : condition,
    );
    onChange(next);
  };

  const handleAdd = () => {
    onChange([
      ...conditions,
      { rule: CONDITIONAL_RULE_DEFINITIONS[0].name, params: {} },
    ]);
  };

  const handleRemove = (index: number) => {
    onChange(conditions.filter((_, i) => i !== index));
  };

  return (
    <div>
      {conditions.length > 1 && (
        <Typography variant="caption" color="textSecondary">
          All of the following conditions must match
        </Typography>
      )}
      {conditions.map((condition, index) => {
        const definition = definitionFor(condition.rule);
        return (
          <div
            key={index}
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              marginTop: 4,
            }}
          >
            <TextField
              select
              label="Rule"
              value={definition.name}
              onChange={e => handleRuleChange(index, e.target.value)}
              margin="dense"
              style={{ width: 200 }}
              disabled={disabled}
              helperText={definition.description}
            >
              {CONDITIONAL_RULE_DEFINITIONS.map(rule => (
                <MenuItem key={rule.name} value={rule.name}>
                  {rule.name}
                </MenuItem>
              ))}
            </TextField>
            {definition.params.map(param => (
              <TextField
                key={param.name}
                label={param.label}
                required={param.required}
                value={(condition.params[param.name] as string) ?? ''}
                onChange={e =>
                  handleParamChange(index, param.name, e.target.value)
                }
                margin="dense"
                disabled={disabled}
              />
            ))}
            <IconButton
              size="small"
              aria-label="remove condition"
              onClick={() => handleRemove(index)}
              disabled={disabled}
              style={{ marginTop: 8 }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </div>
        );
      })}
      <Button
        size="small"
        startIcon={<AddIcon />}
        onClick={handleAdd}
        disabled={disabled}
      >
        Add condition
      </Button>
    </div>
  );
}
