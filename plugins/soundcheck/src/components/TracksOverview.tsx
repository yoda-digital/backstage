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

import { InfoCard, Progress } from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import { SoundcheckTrack } from '@backstage/plugin-soundcheck-common';
import Chip from '@material-ui/core/Chip';
import Grid from '@material-ui/core/Grid';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import useAsync from 'react-use/lib/useAsync';
import { soundcheckApiRef } from '../api/ref';

const useStyles = makeStyles(theme => ({
  levels: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    marginTop: theme.spacing(1),
  },
}));

function TrackCard(props: { track: SoundcheckTrack }) {
  const { track } = props;
  const classes = useStyles();
  const sortedLevels = [...track.levels].sort((a, b) => a.rank - b.rank);

  return (
    <Grid item xs={12} md={6}>
      <InfoCard title={track.name} subheader={track.description}>
        <div className={classes.levels}>
          {sortedLevels.map(level => (
            <Chip
              key={level.name}
              label={`${level.name} (${level.checks.length} checks)`}
              size="small"
              variant="outlined"
            />
          ))}
        </div>
      </InfoCard>
    </Grid>
  );
}

/**
 * Overview of all Soundcheck tracks and their certification levels.
 *
 * @public
 */
export function TracksOverview() {
  const api = useApi(soundcheckApiRef);
  const {
    value: tracks,
    loading,
    error,
  } = useAsync(async () => api.getTracks(), [api]);

  if (loading) {
    return <Progress />;
  }

  if (error) {
    return <Typography color="error">{error.message}</Typography>;
  }

  if (!tracks || tracks.length === 0) {
    return <Typography>No tracks have been defined yet.</Typography>;
  }

  return (
    <Grid container spacing={2}>
      {tracks.map(track => (
        <TrackCard key={track.id} track={track} />
      ))}
    </Grid>
  );
}
