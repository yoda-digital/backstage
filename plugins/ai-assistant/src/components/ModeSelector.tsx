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

import { MouseEvent, useCallback, useMemo, useState } from 'react';
import useAsync from 'react-use/esm/useAsync';
import Button from '@material-ui/core/Button';
import Divider from '@material-ui/core/Divider';
import ListSubheader from '@material-ui/core/ListSubheader';
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import { makeStyles } from '@material-ui/core/styles';
import ArrowDropDownIcon from '@material-ui/icons/ArrowDropDown';
import { identityApiRef, useApi } from '@backstage/core-plugin-api';
import { aiAssistantApiRef } from '../api/AiAssistantClient';
import { ModeManager } from './ModeManager';

const useStyles = makeStyles(
  {
    trigger: {
      justifyContent: 'space-between',
      textTransform: 'none',
    },
    label: {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
  },
  { name: 'PluginAiAssistantModeSelector' },
);

/**
 * Props for {@link ModeSelector}.
 *
 * @public
 */
export interface ModeSelectorProps {
  /** The currently selected mode id, if any. `undefined` means "Default". */
  selectedModeId?: string;
  /** Invoked when the user picks a different mode. */
  onSelect: (modeId: string | undefined) => void;
}

/**
 * A dropdown for selecting the AiKA mode used for the current conversation.
 * Groups modes into "Most Popular" (top 5 by 30-day usage) and "My Modes"
 * (owned by the current user), and links to the {@link ModeManager} dialog
 * for creating, editing, and deleting modes.
 *
 * @public
 */
export function ModeSelector(props: ModeSelectorProps): JSX.Element {
  const { selectedModeId, onSelect } = props;
  const classes = useStyles();
  const aiAssistantApi = useApi(aiAssistantApiRef);
  const identityApi = useApi(identityApiRef);

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [managerOpen, setManagerOpen] = useState(false);
  const [refreshIndex, setRefreshIndex] = useState(0);

  const { value: modes } = useAsync(
    async () => aiAssistantApi.listModes(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [aiAssistantApi, refreshIndex],
  );
  const { value: identity } = useAsync(
    async () => identityApi.getBackstageIdentity(),
    [identityApi],
  );

  const allModes = useMemo(() => modes ?? [], [modes]);
  const userEntityRef = identity?.userEntityRef;
  const defaultMode = useMemo(
    () => allModes.find(mode => mode.builtIn) ?? allModes[0],
    [allModes],
  );
  const popularModes = useMemo(
    () =>
      [...allModes]
        .filter(mode => mode.usageCount30d > 0)
        .sort((a, b) => b.usageCount30d - a.usageCount30d)
        .slice(0, 5),
    [allModes],
  );
  const myModes = useMemo(
    () =>
      allModes.filter(mode => !mode.builtIn && mode.ownerRef === userEntityRef),
    [allModes, userEntityRef],
  );

  const selectedMode = allModes.find(mode => mode.id === selectedModeId);

  const handleOpen = useCallback(
    (event: MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget),
    [],
  );
  const handleClose = useCallback(() => setAnchorEl(null), []);

  const handleSelect = useCallback(
    (modeId: string | undefined) => {
      onSelect(modeId);
      setAnchorEl(null);
    },
    [onSelect],
  );

  const handleOpenManager = useCallback(() => {
    setAnchorEl(null);
    setManagerOpen(true);
  }, []);

  const handleManagerClose = useCallback(() => {
    setManagerOpen(false);
    setRefreshIndex(index => index + 1);
  }, []);

  return (
    <>
      <Button
        size="small"
        fullWidth
        variant="outlined"
        className={classes.trigger}
        endIcon={<ArrowDropDownIcon fontSize="small" />}
        onClick={handleOpen}
      >
        <span className={classes.label}>{selectedMode?.name ?? 'Default'}</span>
      </Button>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleClose}>
        <MenuItem
          selected={!selectedMode || selectedMode.id === defaultMode?.id}
          onClick={() => handleSelect(defaultMode?.id)}
        >
          Default
        </MenuItem>
        {popularModes.length > 0 && <Divider />}
        {popularModes.length > 0 && <ListSubheader>Most Popular</ListSubheader>}
        {popularModes.map(mode => (
          <MenuItem
            key={mode.id}
            selected={mode.id === selectedModeId}
            onClick={() => handleSelect(mode.id)}
          >
            {mode.name}
          </MenuItem>
        ))}
        {myModes.length > 0 && <Divider />}
        {myModes.length > 0 && <ListSubheader>My Modes</ListSubheader>}
        {myModes.map(mode => (
          <MenuItem
            key={mode.id}
            selected={mode.id === selectedModeId}
            onClick={() => handleSelect(mode.id)}
          >
            {mode.name}
          </MenuItem>
        ))}
        <Divider />
        <MenuItem onClick={handleOpenManager}>Manage Modes...</MenuItem>
      </Menu>
      <ModeManager
        open={managerOpen}
        onClose={handleManagerClose}
        selectedModeId={selectedModeId}
        onSelect={handleSelect}
      />
    </>
  );
}
