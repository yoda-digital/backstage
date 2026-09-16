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

import { useCallback, useMemo, useState } from 'react';
import useAsync from 'react-use/esm/useAsync';
import Button from '@material-ui/core/Button';
import Chip from '@material-ui/core/Chip';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import IconButton from '@material-ui/core/IconButton';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemSecondaryAction from '@material-ui/core/ListItemSecondaryAction';
import ListItemText from '@material-ui/core/ListItemText';
import Tab from '@material-ui/core/Tab';
import Tabs from '@material-ui/core/Tabs';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import DeleteIcon from '@material-ui/icons/Delete';
import EditIcon from '@material-ui/icons/Edit';
import PlayArrowIcon from '@material-ui/icons/PlayArrow';
import { identityApiRef, useApi } from '@backstage/core-plugin-api';
import { Progress, ResponseErrorPanel } from '@backstage/core-components';
import { AiMode } from '@backstage/plugin-ai-assistant-common';
import { aiAssistantApiRef } from '../api/AiAssistantClient';
import { ModeEditor } from './ModeEditor';

const useStyles = makeStyles(
  theme => ({
    tabs: {
      borderBottom: `1px solid ${theme.palette.divider}`,
    },
    list: {
      minHeight: 240,
    },
    empty: {
      padding: theme.spacing(3),
      textAlign: 'center',
    },
  }),
  { name: 'PluginAiAssistantModeManager' },
);

type TabKey = 'mine' | 'popular' | 'public';

/**
 * Props for {@link ModeManager}.
 *
 * @public
 */
export interface ModeManagerProps {
  open: boolean;
  onClose: () => void;
  selectedModeId?: string;
  onSelect: (modeId: string) => void;
}

/**
 * Dialog for managing AiKA modes: browsing "My Modes", "Popular", and "All
 * Public" modes, creating and editing modes, toggling their visibility, and
 * deleting them.
 *
 * @public
 */
export function ModeManager(props: ModeManagerProps): JSX.Element {
  const { open, onClose, selectedModeId, onSelect } = props;
  const classes = useStyles();
  const aiAssistantApi = useApi(aiAssistantApiRef);
  const identityApi = useApi(identityApiRef);

  const [tab, setTab] = useState<TabKey>('mine');
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingMode, setEditingMode] = useState<AiMode | undefined>();

  const {
    value: modes,
    loading,
    error,
  } = useAsync(
    async () => (open ? aiAssistantApi.listModes() : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [aiAssistantApi, open, refreshIndex],
  );
  const { value: identity } = useAsync(
    async () => identityApi.getBackstageIdentity(),
    [identityApi],
  );
  const userEntityRef = identity?.userEntityRef;

  const allModes = useMemo(() => modes ?? [], [modes]);
  const mine = useMemo(
    () => allModes.filter(mode => mode.ownerRef === userEntityRef),
    [allModes, userEntityRef],
  );
  const popular = useMemo(
    () =>
      [...allModes]
        .filter(mode => mode.usageCount30d > 0)
        .sort((a, b) => b.usageCount30d - a.usageCount30d)
        .slice(0, 5),
    [allModes],
  );
  const publicModes = useMemo(
    () => allModes.filter(mode => mode.visibility === 'public'),
    [allModes],
  );

  let visibleModes = publicModes;
  if (tab === 'mine') {
    visibleModes = mine;
  } else if (tab === 'popular') {
    visibleModes = popular;
  }

  const refresh = useCallback(() => setRefreshIndex(index => index + 1), []);

  const handleUse = useCallback(
    (mode: AiMode) => {
      onSelect(mode.id);
      onClose();
    },
    [onSelect, onClose],
  );

  const handleCreate = useCallback(() => {
    setEditingMode(undefined);
    setEditorOpen(true);
  }, []);

  const handleEdit = useCallback((mode: AiMode) => {
    setEditingMode(mode);
    setEditorOpen(true);
  }, []);

  const handleDelete = useCallback(
    async (mode: AiMode) => {
      // Deletion confirmed via button click — no dialog needed
      // (future: replace with a confirmation dialog component)
      await aiAssistantApi.deleteMode(mode.id);
      refresh();
    },
    [aiAssistantApi, refresh],
  );

  const handleEditorClose = useCallback(() => {
    setEditorOpen(false);
  }, []);

  const handleEditorSaved = useCallback(() => {
    setEditorOpen(false);
    refresh();
  }, [refresh]);

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>Manage AiKA Modes</DialogTitle>
        <Tabs
          className={classes.tabs}
          value={tab}
          onChange={(_event, value) => setTab(value)}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
        >
          <Tab value="mine" label="My Modes" />
          <Tab value="popular" label="Popular" />
          <Tab value="public" label="All Public" />
        </Tabs>
        <DialogContent>
          {error && <ResponseErrorPanel error={error} />}
          {loading && !modes && <Progress />}
          {!loading && !error && visibleModes.length === 0 && (
            <Typography
              className={classes.empty}
              variant="body2"
              color="textSecondary"
            >
              No modes here yet.
            </Typography>
          )}
          {!loading && !error && visibleModes.length > 0 && (
            <List className={classes.list} dense>
              {visibleModes.map(mode => {
                const owned = mode.ownerRef === userEntityRef;
                return (
                  <ListItem key={mode.id} selected={mode.id === selectedModeId}>
                    <ListItemText
                      primary={
                        <>
                          {mode.name}{' '}
                          {mode.builtIn && (
                            <Chip size="small" label="Built-in" />
                          )}
                          {!mode.builtIn && (
                            <Chip
                              size="small"
                              label={mode.visibility}
                              variant="outlined"
                            />
                          )}
                        </>
                      }
                      secondary={mode.description}
                    />
                    <ListItemSecondaryAction>
                      <IconButton
                        size="small"
                        aria-label={`Use ${mode.name}`}
                        onClick={() => handleUse(mode)}
                      >
                        <PlayArrowIcon fontSize="small" />
                      </IconButton>
                      {owned && !mode.builtIn && (
                        <IconButton
                          size="small"
                          aria-label={`Edit ${mode.name}`}
                          onClick={() => handleEdit(mode)}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      )}
                      {owned && !mode.builtIn && (
                        <IconButton
                          size="small"
                          aria-label={`Delete ${mode.name}`}
                          onClick={() => handleDelete(mode)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      )}
                    </ListItemSecondaryAction>
                  </ListItem>
                );
              })}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCreate}>Create Mode</Button>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>
      <ModeEditor
        open={editorOpen}
        mode={editingMode}
        onClose={handleEditorClose}
        onSaved={handleEditorSaved}
      />
    </>
  );
}
