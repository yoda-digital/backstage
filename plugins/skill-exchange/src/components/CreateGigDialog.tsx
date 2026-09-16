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

import { useState } from 'react';
import useAsync from 'react-use/esm/useAsync';
import Autocomplete from '@material-ui/lab/Autocomplete';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import Grid from '@material-ui/core/Grid';
import MenuItem from '@material-ui/core/MenuItem';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import { useApi } from '@backstage/core-plugin-api';
import { ResponseErrorPanel } from '@backstage/core-components';
import { GigMatch, GigType } from '@backstage/plugin-skill-exchange-common';
import { skillExchangeApiRef } from '../api/ref';

const gigTypes: GigType[] = ['mentor', 'pair', 'hack', 'embed'];

/**
 * Props for {@link CreateGigDialog}.
 *
 * @public
 */
export interface CreateGigDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

/**
 * A dialog for creating a new gig offer or request. Existing skills are
 * offered as autocomplete suggestions, and any immediate matches found on
 * submit are shown before the dialog closes.
 *
 * @public
 */
export function CreateGigDialog(props: CreateGigDialogProps): JSX.Element {
  const { open, onClose, onCreated } = props;
  const skillExchangeApi = useApi(skillExchangeApiRef);

  const [type, setType] = useState<GigType>('mentor');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [direction, setDirection] = useState<'offer' | 'request'>('offer');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<Error>();
  const [matches, setMatches] = useState<GigMatch[]>();

  const { value: existingSkills } = useAsync(async () => {
    const gigs = await skillExchangeApi.listGigs();
    return Array.from(new Set(gigs.flatMap(g => g.skills))).sort();
  }, [skillExchangeApi]);

  const reset = () => {
    setType('mentor');
    setTitle('');
    setDescription('');
    setSkills([]);
    setDirection('offer');
    setStartDate('');
    setEndDate('');
    setError(undefined);
    setMatches(undefined);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(undefined);
    try {
      const gig = await skillExchangeApi.createGig({
        type,
        title,
        description,
        skills,
        direction,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      const found = await skillExchangeApi.listMatches(gig.id);
      if (found.length > 0) {
        setMatches(found);
      } else {
        reset();
        onCreated();
      }
    } catch (e) {
      setError(e as Error);
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = title.trim().length > 0 && description.trim().length > 0;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create a gig</DialogTitle>
      <DialogContent>
        {error && <ResponseErrorPanel error={error} />}
        {matches && (
          <div style={{ marginBottom: 16 }}>
            <Typography variant="subtitle1">
              Found {matches.length} immediate match
              {matches.length === 1 ? '' : 'es'}!
            </Typography>
            {matches.map(match => (
              <Typography key={`${match.offerId}-${match.requestId}`}>
                {match.offerId} ↔ {match.requestId} (
                {Math.round(match.score * 100)}% match)
              </Typography>
            ))}
          </div>
        )}
        <Grid container spacing={2}>
          <Grid item xs={6}>
            <TextField
              select
              label="Type"
              value={type}
              onChange={e => setType(e.target.value as GigType)}
              fullWidth
            >
              {gigTypes.map(t => (
                <MenuItem key={t} value={t}>
                  {t}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={6}>
            <TextField
              select
              label="Direction"
              value={direction}
              onChange={e =>
                setDirection(e.target.value as 'offer' | 'request')
              }
              fullWidth
            >
              <MenuItem value="offer">Offer</MenuItem>
              <MenuItem value="request">Request</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              fullWidth
              required
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              fullWidth
              multiline
              minRows={3}
              required
            />
          </Grid>
          <Grid item xs={12}>
            <Autocomplete
              multiple
              freeSolo
              options={existingSkills ?? []}
              value={skills}
              onChange={(_e, value) => setSkills(value)}
              renderInput={params => (
                <TextField
                  {...params}
                  label="Skills"
                  placeholder="Add a skill"
                />
              )}
            />
          </Grid>
          <Grid item xs={6}>
            <TextField
              label="Start date"
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={6}>
            <TextField
              label="End date"
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        {matches ? (
          <Button
            color="primary"
            variant="contained"
            onClick={() => {
              reset();
              onCreated();
            }}
          >
            Done
          </Button>
        ) : (
          <Button
            color="primary"
            variant="contained"
            disabled={!canSubmit || submitting}
            onClick={handleSubmit}
          >
            {submitting ? 'Creating…' : 'Create'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
