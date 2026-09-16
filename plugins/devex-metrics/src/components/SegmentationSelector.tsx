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

import { useMemo } from 'react';
import useAsync from 'react-use/esm/useAsync';
import { useApi } from '@backstage/core-plugin-api';
import { Select, SelectedItems, SelectItem } from '@backstage/core-components';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { soundcheckApiRef } from '@backstage/plugin-soundcheck';

const ALL_TEAMS = '';
const ALL_TRACKS = '';

/**
 * The segmentation currently applied to the DevEx Metrics dashboard.
 *
 * @public
 */
export interface Segmentation {
  /** A catalog Group entity ref, or `undefined` for all teams. */
  readonly team?: string;
  /** A Soundcheck track id, or `undefined` for all tracks. */
  readonly trackId?: string;
}

/**
 * Props for {@link SegmentationSelector}.
 *
 * @public
 */
export interface SegmentationSelectorProps {
  readonly value: Segmentation;
  readonly onChange: (value: Segmentation) => void;
}

/**
 * A pair of dropdowns for scoping the dashboard to a catalog team (Group
 * entity) and/or a Soundcheck certification track. The selection is applied
 * uniformly to every chart on the page.
 *
 * @public
 */
export function SegmentationSelector(
  props: SegmentationSelectorProps,
): JSX.Element {
  const { value, onChange } = props;
  const catalogApi = useApi(catalogApiRef);
  const soundcheckApi = useApi(soundcheckApiRef);

  const { value: teams } = useAsync(async () => {
    const response = await catalogApi.getEntities({
      filter: { kind: 'Group' },
      fields: ['metadata.name', 'metadata.namespace', 'metadata.title', 'kind'],
    });
    return response.items.map(entity => ({
      ref: stringifyEntityRef(entity),
      title: entity.metadata.title ?? entity.metadata.name,
    }));
  }, [catalogApi]);

  const { value: tracks } = useAsync(
    () => soundcheckApi.getTracks(),
    [soundcheckApi],
  );

  const teamItems: SelectItem[] = useMemo(
    () => [
      { label: 'All teams', value: ALL_TEAMS },
      ...(teams ?? []).map(team => ({ label: team.title, value: team.ref })),
    ],
    [teams],
  );

  const trackItems: SelectItem[] = useMemo(
    () => [
      { label: 'All tracks', value: ALL_TRACKS },
      ...(tracks ?? []).map(track => ({ label: track.name, value: track.id })),
    ],
    [tracks],
  );

  function handleTeamChange(selected: SelectedItems): void {
    const raw = String(Array.isArray(selected) ? selected[0] : selected);
    onChange({ ...value, team: raw || undefined });
  }

  function handleTrackChange(selected: SelectedItems): void {
    const raw = String(Array.isArray(selected) ? selected[0] : selected);
    onChange({ ...value, trackId: raw || undefined });
  }

  return (
    <>
      <Select
        label="Team"
        items={teamItems}
        selected={value.team ?? ALL_TEAMS}
        onChange={handleTeamChange}
      />
      <Select
        label="Soundcheck track"
        items={trackItems}
        selected={value.trackId ?? ALL_TRACKS}
        onChange={handleTrackChange}
      />
    </>
  );
}
