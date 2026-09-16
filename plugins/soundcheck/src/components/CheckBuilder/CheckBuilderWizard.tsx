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

import { useApi } from '@backstage/core-plugin-api';
import {
  SoundcheckCheck,
  SoundcheckPathResolver,
} from '@backstage/plugin-soundcheck-common';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import Grid from '@material-ui/core/Grid';
import MenuItem from '@material-ui/core/MenuItem';
import Step from '@material-ui/core/Step';
import StepLabel from '@material-ui/core/StepLabel';
import Stepper from '@material-ui/core/Stepper';
import TextField from '@material-ui/core/TextField';
import { useEffect, useState } from 'react';
import useAsync from 'react-use/lib/useAsync';
import { soundcheckApiRef } from '../../api/ref';
import { FilterEditor } from './FilterEditor';
import { ReviewAndTest } from './ReviewAndTest';
import { RuleBuilder } from './RuleBuilder';
import { CheckDraft, createEmptyDraft, draftFromCheck } from './types';

const STEPS = ['Fact', 'Rules', 'Filters', 'Review & test'];

const PATH_RESOLVERS: SoundcheckPathResolver[] = [
  'jsonpath',
  'lodash',
  'jmespath',
  'jsonata',
];

function FactBasicsStep(props: {
  draft: CheckDraft;
  onChange: (patch: Partial<CheckDraft>) => void;
}) {
  const { draft, onChange } = props;
  return (
    <Grid container spacing={2}>
      <Grid item xs={12} sm={6}>
        <TextField
          fullWidth
          required
          label="Name"
          value={draft.name}
          onChange={event => onChange({ name: event.target.value })}
        />
      </Grid>
      <Grid item xs={12} sm={6}>
        <TextField
          fullWidth
          label="Owner entity reference"
          placeholder="group:default/platform"
          value={draft.ownerEntityRef}
          onChange={event => onChange({ ownerEntityRef: event.target.value })}
        />
      </Grid>
      <Grid item xs={12}>
        <TextField
          fullWidth
          multiline
          minRows={2}
          label="Description"
          value={draft.description}
          onChange={event => onChange({ description: event.target.value })}
        />
      </Grid>
      <Grid item xs={12} sm={6}>
        <TextField
          fullWidth
          required
          label="Fact ref"
          helperText="The default fact this check's rule evaluates against."
          value={draft.factRef}
          onChange={event => onChange({ factRef: event.target.value })}
        />
      </Grid>
      <Grid item xs={12} sm={6}>
        <TextField
          select
          fullWidth
          label="Path resolver"
          value={draft.pathResolver}
          onChange={event =>
            onChange({
              pathResolver: event.target.value as SoundcheckPathResolver,
            })
          }
        >
          {PATH_RESOLVERS.map(resolver => (
            <MenuItem key={resolver} value={resolver}>
              {resolver}
            </MenuItem>
          ))}
        </TextField>
      </Grid>
      <Grid item xs={12} sm={6}>
        <TextField
          fullWidth
          label="Passed message"
          helperText="Liquid template rendered when the check passes."
          value={draft.passedMessage}
          onChange={event => onChange({ passedMessage: event.target.value })}
        />
      </Grid>
      <Grid item xs={12} sm={6}>
        <TextField
          fullWidth
          label="Failed message"
          helperText="Liquid template rendered when the check fails."
          value={draft.failedMessage}
          onChange={event => onChange({ failedMessage: event.target.value })}
        />
      </Grid>
    </Grid>
  );
}

function isStepComplete(step: number, draft: CheckDraft): boolean {
  if (step === 0) {
    return draft.name.trim().length > 0 && draft.factRef.trim().length > 0;
  }
  return true;
}

/**
 * Props for {@link CheckBuilderWizard}.
 *
 * @public
 */
export interface CheckBuilderWizardProps {
  open: boolean;
  onClose: () => void;
  /** When given, the wizard opens pre-populated for editing this check. */
  initialCheck?: SoundcheckCheck;
  onSaved?: (check: SoundcheckCheck) => void;
}

/**
 * A 4-step wizard for visually creating or editing a Soundcheck check
 * definition, without hand-writing YAML: the fact and messages it uses, its
 * boolean rule tree, the entities it targets, and a final review step with a
 * YAML preview and a dry run against a real entity.
 *
 * @public
 */
export function CheckBuilderWizard(props: CheckBuilderWizardProps) {
  const { open, onClose, initialCheck, onSaved } = props;
  const api = useApi(soundcheckApiRef);

  const [activeStep, setActiveStep] = useState(0);
  const [draft, setDraft] = useState<CheckDraft>(() =>
    initialCheck ? draftFromCheck(initialCheck) : createEmptyDraft(),
  );

  useEffect(() => {
    if (open) {
      setDraft(
        initialCheck ? draftFromCheck(initialCheck) : createEmptyDraft(),
      );
      setActiveStep(0);
    }
    // Only reset when the dialog transitions open, not on every draft edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialCheck]);

  const { value: factCollectors } = useAsync(async () => {
    if (!open) {
      return [];
    }
    return api.getFactCollectors();
  }, [api, open]);

  function updateDraft(patch: Partial<CheckDraft>) {
    setDraft(current => ({ ...current, ...patch }));
  }

  function handleSaved(check: SoundcheckCheck) {
    onSaved?.(check);
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {initialCheck ? `Edit check: ${initialCheck.name}` : 'Create check'}
      </DialogTitle>
      <DialogContent>
        <Stepper activeStep={activeStep} alternativeLabel>
          {STEPS.map(label => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
        <Box paddingTop={3} paddingBottom={2}>
          {activeStep === 0 && (
            <FactBasicsStep draft={draft} onChange={updateDraft} />
          )}
          {activeStep === 1 && (
            <RuleBuilder
              node={draft.rule}
              onChange={rule => updateDraft({ rule })}
              factCollectors={factCollectors ?? []}
              defaultFactRef={draft.factRef}
            />
          )}
          {activeStep === 2 && (
            <FilterEditor
              filter={draft.filter}
              excludeFilter={draft.excludeFilter}
              onChangeFilter={filter => updateDraft({ filter })}
              onChangeExcludeFilter={excludeFilter =>
                updateDraft({ excludeFilter })
              }
            />
          )}
          {activeStep === 3 && (
            <ReviewAndTest draft={draft} onSaved={handleSaved} />
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          disabled={activeStep === 0}
          onClick={() => setActiveStep(s => s - 1)}
        >
          Back
        </Button>
        {activeStep < STEPS.length - 1 && (
          <Button
            color="primary"
            variant="contained"
            disabled={!isStepComplete(activeStep, draft)}
            onClick={() => setActiveStep(s => s + 1)}
          >
            Next
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
