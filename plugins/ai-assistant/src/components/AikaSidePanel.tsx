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
  MouseEvent as ReactMouseEvent,
  useCallback,
  useRef,
  useState,
} from 'react';
import IconButton from '@material-ui/core/IconButton';
import Typography from '@material-ui/core/Typography';
import { makeStyles, Theme } from '@material-ui/core/styles';
import CloseIcon from '@material-ui/icons/Close';
import { PageContext } from '@backstage/plugin-ai-assistant-common';
import { useTranslationRef } from '@backstage/frontend-plugin-api';
import { usePageContext } from '../hooks/usePageContext';
import { ModeSelector } from './ModeSelector';
import { AikaMessageList } from './AikaMessageList';
import { AikaInput } from './AikaInput';
import { aiAssistantTranslationRef } from '../translation';

const DEFAULT_WIDTH = 420;
const MIN_WIDTH = 320;
const MAX_WIDTH = 720;
const WIDTH_STORAGE_KEY = 'backstage.plugin-ai-assistant.aika-panel-width';

function readStoredWidth(): number {
  try {
    const stored = window.localStorage.getItem(WIDTH_STORAGE_KEY);
    const parsed = stored ? Number(stored) : NaN;
    if (Number.isFinite(parsed)) {
      return Math.min(Math.max(parsed, MIN_WIDTH), MAX_WIDTH);
    }
  } catch {
    // Ignore storage errors, fall back to the default width.
  }
  return DEFAULT_WIDTH;
}

function writeStoredWidth(width: number): void {
  try {
    window.localStorage.setItem(WIDTH_STORAGE_KEY, String(width));
  } catch {
    // Ignore storage errors.
  }
}

const useStyles = makeStyles(
  (theme: Theme) => ({
    panel: {
      position: 'fixed',
      top: 0,
      bottom: 0,
      right: 0,
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: theme.palette.background.paper,
      boxShadow: theme.shadows[16],
      zIndex: theme.zIndex.modal,
      transition: 'transform 0.25s ease',
    },
    resizeHandle: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      width: 6,
      marginLeft: -3,
      cursor: 'col-resize',
      zIndex: 1,
      '&:hover': {
        backgroundColor: theme.palette.action.hover,
      },
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      padding: theme.spacing(1, 1.5),
      borderBottom: `1px solid ${theme.palette.divider}`,
    },
    headerMode: {
      width: 160,
    },
    headerTitle: {
      flex: 1,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
    body: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    },
  }),
  { name: 'PluginAiAssistantAikaSidePanel' },
);

/**
 * Props for {@link AikaSidePanel}.
 *
 * @public
 */
export interface AikaSidePanelProps {
  /** Whether the panel is open. It is always mounted so it can slide in. */
  open: boolean;
  /** Invoked when the close button is clicked. */
  onClose: () => void;
  /** The currently selected mode id, if any. `undefined` means "Default". */
  selectedModeId?: string;
  /** Invoked when the user picks a different mode. */
  onSelectMode: (modeId: string | undefined) => void;
  /** Title of the active conversation, shown in the header. */
  conversationTitle?: string;
  /** The active conversation id, if any. */
  conversationId?: string;
  /** Bumped after sending a message to trigger a message list refetch. */
  refreshToken: number;
  /**
   * Invoked with the message content and the current {@link PageContext}
   * when the user sends a message.
   */
  onSend: (content: string, pageContext: PageContext) => void | Promise<void>;
  /** Whether a response is currently being awaited. */
  sending?: boolean;
}

/**
 * Overlay side panel hosting the AiKA conversation: a header with mode
 * selection, a scrollable message list, and a footer input. Always rendered
 * so that it can slide in and out via a CSS transform transition, and
 * resizable via a drag handle on its left edge.
 *
 * @public
 */
export function AikaSidePanel(props: AikaSidePanelProps): JSX.Element {
  const {
    open,
    onClose,
    selectedModeId,
    onSelectMode,
    conversationTitle,
    conversationId,
    refreshToken,
    onSend,
    sending,
  } = props;
  const classes = useStyles();
  const { t } = useTranslationRef(aiAssistantTranslationRef);
  const [width, setWidth] = useState(readStoredWidth);
  const widthRef = useRef(width);
  const pageContext = usePageContext();

  const handleSend = useCallback(
    (content: string) => onSend(content, pageContext),
    [onSend, pageContext],
  );

  const handleResizeStart = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = widthRef.current;

      const handleMouseMove = (moveEvent: globalThis.MouseEvent) => {
        const delta = startX - moveEvent.clientX;
        const nextWidth = Math.min(
          Math.max(startWidth + delta, MIN_WIDTH),
          MAX_WIDTH,
        );
        widthRef.current = nextWidth;
        setWidth(nextWidth);
      };

      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        writeStoredWidth(widthRef.current);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [],
  );

  return (
    <div
      className={classes.panel}
      style={{
        width,
        transform: open ? 'translateX(0)' : 'translateX(100%)',
      }}
      role="complementary"
      aria-label={t('sidePanel.panelAriaLabel')}
      aria-hidden={!open}
    >
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        className={classes.resizeHandle}
        onMouseDown={handleResizeStart}
        title={t('sidePanel.resizeHandleTitle')}
      />
      <div className={classes.header}>
        <div className={classes.headerMode}>
          <ModeSelector
            selectedModeId={selectedModeId}
            onSelect={onSelectMode}
          />
        </div>
        <Typography variant="subtitle2" className={classes.headerTitle}>
          {conversationTitle ?? t('sidePanel.defaultTitle')}
        </Typography>
        <IconButton
          size="small"
          aria-label={t('sidePanel.closeButtonAriaLabel')}
          onClick={onClose}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </div>
      <div className={classes.body}>
        <AikaMessageList
          conversationId={conversationId}
          refreshToken={refreshToken}
        />
        <AikaInput
          onSend={handleSend}
          pageContext={pageContext}
          disabled={sending}
        />
      </div>
    </div>
  );
}
