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
  InfoCard,
  Progress,
  StatusError,
  StatusOK,
  StatusPending,
  StatusWarning,
} from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import { useTranslationRef } from '@backstage/frontend-plugin-api';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { useEntity } from '@backstage/plugin-catalog-react';
import {
  SoundcheckCertification,
  SoundcheckCheckResult,
  SoundcheckCheckStatus,
  SoundcheckTrack,
} from '@backstage/plugin-soundcheck-common';
import type { ReactNode } from 'react';
import Box from '@material-ui/core/Box';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import Typography from '@material-ui/core/Typography';
import useAsync from 'react-use/lib/useAsync';
import { soundcheckApiRef } from '../api/ref';
import { soundcheckTranslationRef } from '../translation';
import { BadgeDisplay } from './BadgeDisplay';

function StatusIcon(props: { status: SoundcheckCheckStatus }) {
  switch (props.status) {
    case 'pass':
      return <StatusOK />;
    case 'fail':
      return <StatusError />;
    case 'error':
      return <StatusWarning />;
    default:
      return <StatusPending />;
  }
}

function CertificationBadges(props: {
  certifications: SoundcheckCertification[];
  tracks: SoundcheckTrack[];
}) {
  const { certifications, tracks } = props;
  if (certifications.length === 0) {
    return null;
  }
  return (
    <Box mb={2} display="flex" flexWrap="wrap" gridGap={8} alignItems="center">
      {certifications.map(cert => {
        const track = tracks.find(t => t.id === cert.trackId);
        const level = track?.levels.find(l => l.name === cert.levelName) ?? {
          name: cert.levelName,
          rank: cert.levelRank,
        };
        return (
          <BadgeDisplay
            key={`${cert.trackId}-${cert.levelName}`}
            level={level}
            size="small"
          />
        );
      })}
    </Box>
  );
}

function ResultsList(props: {
  results: SoundcheckCheckResult[];
  noResultsLabel: string;
}) {
  if (props.results.length === 0) {
    return <Typography>{props.noResultsLabel}</Typography>;
  }
  return (
    <List dense disablePadding>
      {props.results.map(result => (
        <ListItem key={result.checkId} disableGutters>
          <ListItemIcon>
            <StatusIcon status={result.status} />
          </ListItemIcon>
          <ListItemText primary={result.checkId} secondary={result.message} />
        </ListItem>
      ))}
    </List>
  );
}

/**
 * Entity content card showing the latest Soundcheck results and the
 * certifications earned by the current entity.
 *
 * @public
 */
export function EntitySoundcheckCard() {
  const { entity } = useEntity();
  const api = useApi(soundcheckApiRef);
  const { t } = useTranslationRef(soundcheckTranslationRef);
  const entityRef = stringifyEntityRef(entity);

  const {
    value: results,
    loading: resultsLoading,
    error: resultsError,
  } = useAsync(async () => api.getEntityResults(entityRef), [api, entityRef]);

  const { value: certifications, loading: certificationsLoading } = useAsync(
    async () => api.getEntityCertifications(entityRef),
    [api, entityRef],
  );

  const { value: tracks, loading: tracksLoading } = useAsync(
    async () => api.getTracks(),
    [api],
  );

  const loading = resultsLoading || certificationsLoading || tracksLoading;
  const passed = results?.filter(r => r.status === 'pass').length ?? 0;
  const total = results?.length ?? 0;
  const title = loading
    ? t('entityCard.title')
    : t('entityCard.titleWithScore', {
        passed: String(passed),
        total: String(total),
      });

  let content: ReactNode;
  if (loading) {
    content = <Progress />;
  } else if (resultsError) {
    content = <Typography color="error">{resultsError.message}</Typography>;
  } else {
    content = (
      <>
        <CertificationBadges
          certifications={certifications ?? []}
          tracks={tracks ?? []}
        />
        <ResultsList
          results={results ?? []}
          noResultsLabel={t('entityCard.noResults')}
        />
      </>
    );
  }

  return <InfoCard title={title}>{content}</InfoCard>;
}
