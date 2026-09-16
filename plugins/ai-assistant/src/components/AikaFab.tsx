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

import { DragEvent, useCallback, useState } from 'react';
import Badge from '@material-ui/core/Badge';
import Fab from '@material-ui/core/Fab';
import { makeStyles, Theme } from '@material-ui/core/styles';
import ChatIcon from '@material-ui/icons/Chat';
import CloseIcon from '@material-ui/icons/Close';

/** Horizontal edge the FAB is docked to. */
export type AikaFabSide = 'left' | 'right';

const STORAGE_KEY = 'backstage.plugin-ai-assistant.aika-fab-side';
const INSET = 24;

function readStoredSide(): AikaFabSide {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === 'left' ? 'left' : 'right';
  } catch {
    return 'right';
  }
}

function writeStoredSide(side: AikaFabSide): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, side);
  } catch {
    // Ignore storage errors (e.g. private browsing), the side simply won't
    // persist across reloads.
  }
}

const useStyles = makeStyles(
  (theme: Theme) => ({
    container: {
      position: 'fixed',
      bottom: INSET,
      zIndex: theme.zIndex.tooltip + 1,
      cursor: 'grab',
      '&:active': {
        cursor: 'grabbing',
      },
    },
    '@keyframes aikaPulse': {
      '0%': {
        boxShadow: `0 0 0 0 ${theme.palette.secondary.main}80`,
      },
      '70%': {
        boxShadow: `0 0 0 8px ${theme.palette.secondary.main}00`,
      },
      '100%': {
        boxShadow: `0 0 0 0 ${theme.palette.secondary.main}00`,
      },
    },
    unreadBadge: {
      animation: '$aikaPulse 1.6s ease-out infinite',
    },
  }),
  { name: 'PluginAiAssistantAikaFab' },
);

/**
 * Props for {@link AikaFab}.
 *
 * @public
 */
export interface AikaFabProps {
  /** Whether the AiKA side panel is currently open. */
  open: boolean;
  /** Invoked when the button is clicked, to toggle the side panel. */
  onToggle: () => void;
  /** Whether to show the pulsing notification dot for an unread response. */
  hasUnread?: boolean;
}

/**
 * Floating action button that toggles the AiKA side panel. Rendered at the
 * application root so it is available on every page. It can be dragged
 * horizontally and snaps to the nearest bottom corner, remembering that
 * choice in `localStorage`.
 *
 * @public
 */
export function AikaFab(props: AikaFabProps): JSX.Element {
  const { open, onToggle, hasUnread } = props;
  const classes = useStyles();
  const [side, setSide] = useState<AikaFabSide>(readStoredSide);
  const [dragging, setDragging] = useState(false);

  const handleDragStart = useCallback((event: DragEvent<HTMLDivElement>) => {
    // Required by some browsers for the drag operation to start, and hides
    // the default drag preview text.
    event.dataTransfer.setData('text/plain', '');
    event.dataTransfer.effectAllowed = 'move';
    setDragging(true);
  }, []);

  const handleDragEnd = useCallback((event: DragEvent<HTMLDivElement>) => {
    setDragging(false);
    // A drag that ends outside the viewport reports (0, 0) in some browsers;
    // ignore those and keep the current side rather than snapping to left.
    if (event.clientX <= 0 && event.clientY <= 0) {
      return;
    }
    const nextSide: AikaFabSide =
      event.clientX < window.innerWidth / 2 ? 'left' : 'right';
    setSide(nextSide);
    writeStoredSide(nextSide);
  }, []);

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={classes.container}
      style={{
        [side]: INSET,
        opacity: dragging ? 0.6 : 1,
      }}
    >
      <Badge
        color="secondary"
        variant="dot"
        overlap="circle"
        invisible={!hasUnread}
        classes={{ badge: classes.unreadBadge }}
      >
        <Fab
          color="primary"
          aria-label={open ? 'Close AiKA assistant' : 'Open AiKA assistant'}
          onClick={onToggle}
        >
          {open ? <CloseIcon /> : <ChatIcon />}
        </Fab>
      </Badge>
    </div>
  );
}
