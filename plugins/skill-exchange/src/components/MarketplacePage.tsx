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

import { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import useAsync from 'react-use/esm/useAsync';
import Autocomplete from '@material-ui/lab/Autocomplete';
import Button from '@material-ui/core/Button';
import Chip from '@material-ui/core/Chip';
import MenuItem from '@material-ui/core/MenuItem';
import Tab from '@material-ui/core/Tab';
import Tabs from '@material-ui/core/Tabs';
import TextField from '@material-ui/core/TextField';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import AddIcon from '@material-ui/icons/Add';
import { identityApiRef, useApi } from '@backstage/core-plugin-api';
import {
  Content,
  Header,
  HeaderLabel,
  Page,
  Progress,
  ResponseErrorPanel,
  Table,
  TableColumn,
} from '@backstage/core-components';
import {
  Gig,
  GigMatch,
  GigType,
} from '@backstage/plugin-skill-exchange-common';
import { useTranslationRef } from '@backstage/frontend-plugin-api';
import { skillExchangeApiRef } from '../api/ref';
import { skillExchangeTranslationRef } from '../translation';
import { CreateGigDialog } from './CreateGigDialog';

const gigTypes: GigType[] = ['mentor', 'pair', 'hack', 'embed'];

type TabKey = 'all' | 'my-offers' | 'my-requests' | 'matches';

/**
 * The main Skill Exchange marketplace page: a tabbed view over all gigs,
 * the current user's offers and requests, and computed matches.
 *
 * @public
 */
export function MarketplacePage(): JSX.Element {
  const { t } = useTranslationRef(skillExchangeTranslationRef);
  const skillExchangeApi = useApi(skillExchangeApiRef);
  const identityApi = useApi(identityApiRef);
  const [tab, setTab] = useState<TabKey>('all');
  const [typeFilter, setTypeFilter] = useState<GigType | ''>('');
  const [skillsFilter, setSkillsFilter] = useState<string[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const { value: identity } = useAsync(
    async () => identityApi.getBackstageIdentity(),
    [identityApi],
  );

  const {
    value: gigs,
    loading: gigsLoading,
    error: gigsError,
  } = useAsync(
    async () =>
      skillExchangeApi.listGigs({
        type: typeFilter || undefined,
        skills: skillsFilter.length > 0 ? skillsFilter : undefined,
      }),
    [skillExchangeApi, typeFilter, skillsFilter, refreshKey],
  );

  const {
    value: matches,
    loading: matchesLoading,
    error: matchesError,
  } = useAsync(
    async () => skillExchangeApi.listMatches(),
    [skillExchangeApi, refreshKey],
  );

  const { value: knownSkills } = useAsync(
    async () => skillExchangeApi.listSkills(),
    [skillExchangeApi, refreshKey],
  );

  const allSkills = useMemo(() => {
    const fromGigs = (gigs ?? []).flatMap(g => g.skills);
    return Array.from(new Set([...(knownSkills ?? []), ...fromGigs])).sort();
  }, [gigs, knownSkills]);

  const visibleGigs = useMemo(() => {
    if (!gigs) {
      return [];
    }
    if (tab === 'my-offers') {
      return gigs.filter(
        g => g.direction === 'offer' && g.createdBy === identity?.userEntityRef,
      );
    }
    if (tab === 'my-requests') {
      return gigs.filter(
        g =>
          g.direction === 'request' && g.createdBy === identity?.userEntityRef,
      );
    }
    return gigs;
  }, [gigs, tab, identity]);

  const columns: TableColumn<Gig>[] = [
    {
      title: 'Title',
      render: gig => (
        <RouterLink to={`/skill-exchange/gigs/${gig.id}`}>
          {gig.title}
        </RouterLink>
      ),
    },
    { title: 'Type', field: 'type' },
    { title: 'Direction', field: 'direction' },
    { title: 'Status', field: 'status' },
    {
      title: 'Skills',
      render: gig => (
        <>
          {gig.skills.map(skill => (
            <Chip key={skill} label={skill} size="small" />
          ))}
        </>
      ),
    },
  ];

  const matchColumns: TableColumn<GigMatch>[] = [
    {
      title: 'Offer',
      render: match => (
        <RouterLink to={`/skill-exchange/gigs/${match.offerId}`}>
          {match.offerId}
        </RouterLink>
      ),
    },
    {
      title: 'Request',
      render: match => (
        <RouterLink to={`/skill-exchange/gigs/${match.requestId}`}>
          {match.requestId}
        </RouterLink>
      ),
    },
    {
      title: 'Score',
      render: match => `${Math.round(match.score * 100)}%`,
    },
    {
      title: 'Matched skills',
      render: match => match.matchedSkills.join(', '),
    },
  ];

  const error = gigsError ?? matchesError;
  if (error) {
    return (
      <Page themeId="tool">
        <Header
          title={t('marketplacePage.title')}
          subtitle={t('marketplacePage.subtitle')}
        />
        <Content>
          <ResponseErrorPanel error={error} />
        </Content>
      </Page>
    );
  }

  return (
    <Page themeId="tool">
      <Header
        title={t('marketplacePage.title')}
        subtitle={t('marketplacePage.subtitle')}
      >
        <HeaderLabel
          label={t('marketplacePage.ownerLabel')}
          value={t('marketplacePage.title')}
        />
      </Header>
      <Content>
        <Toolbar disableGutters style={{ justifyContent: 'space-between' }}>
          <Tabs
            value={tab}
            onChange={(_e, value) => setTab(value)}
            indicatorColor="primary"
            textColor="primary"
          >
            <Tab value="all" label={t('marketplacePage.tabAllGigs')} />
            <Tab value="my-offers" label={t('marketplacePage.tabMyOffers')} />
            <Tab
              value="my-requests"
              label={t('marketplacePage.tabMyRequests')}
            />
            <Tab value="matches" label={t('marketplacePage.tabMatches')} />
          </Tabs>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => setCreateOpen(true)}
          >
            {t('marketplacePage.newGigButton')}
          </Button>
        </Toolbar>

        {tab !== 'matches' && (
          <Toolbar disableGutters style={{ gap: 16 }}>
            <TextField
              select
              label={t('marketplacePage.typeLabel')}
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value as GigType | '')}
              style={{ minWidth: 160 }}
            >
              <MenuItem value="">
                {t('marketplacePage.allTypesOption')}
              </MenuItem>
              {gigTypes.map(type => (
                <MenuItem key={type} value={type}>
                  {type}
                </MenuItem>
              ))}
            </TextField>
            <Autocomplete
              multiple
              options={allSkills}
              value={skillsFilter}
              onChange={(_e, value) => setSkillsFilter(value)}
              style={{ minWidth: 280 }}
              renderInput={params => (
                <TextField
                  {...params}
                  label={t('marketplacePage.skillsLabel')}
                  placeholder={t('marketplacePage.skillsPlaceholder')}
                />
              )}
            />
          </Toolbar>
        )}

        {tab === 'matches' && matchesLoading && <Progress />}
        {tab === 'matches' && !matchesLoading && (
          <Table
            title={t('marketplacePage.matchesTableTitle')}
            columns={matchColumns}
            data={matches ?? []}
            options={{ paging: true, pageSize: 20 }}
            emptyContent={
              <Typography style={{ padding: 16 }}>
                {t('marketplacePage.noMatchesYet')}
              </Typography>
            }
          />
        )}
        {tab !== 'matches' && gigsLoading && <Progress />}
        {tab !== 'matches' && !gigsLoading && (
          <Table
            title={t('marketplacePage.gigsTableTitle')}
            columns={columns}
            data={visibleGigs}
            options={{ paging: true, pageSize: 20 }}
            emptyContent={
              <Typography style={{ padding: 16 }}>
                {t('marketplacePage.noGigsMatchFilters')}
              </Typography>
            }
          />
        )}

        <CreateGigDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            setRefreshKey(key => key + 1);
          }}
        />
      </Content>
    </Page>
  );
}
