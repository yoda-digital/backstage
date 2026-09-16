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

import { useEffect, useRef } from 'react';
import useAsync from 'react-use/esm/useAsync';
import Typography from '@material-ui/core/Typography';
import { makeStyles, Theme } from '@material-ui/core/styles';
import { useApi } from '@backstage/core-plugin-api';
import { Progress, ResponseErrorPanel } from '@backstage/core-components';
import { AiAssistantMessage } from '@backstage/plugin-ai-assistant-common';
import { aiAssistantApiRef } from '../api/AiAssistantClient';

const useStyles = makeStyles(
  (theme: Theme) => ({
    root: {
      flex: 1,
      overflowY: 'auto',
      padding: theme.spacing(2),
    },
    row: {
      display: 'flex',
      flexDirection: 'column',
      marginBottom: theme.spacing(1.5),
    },
    rowUser: {
      alignItems: 'flex-end',
    },
    rowAssistant: {
      alignItems: 'flex-start',
    },
    bubble: {
      maxWidth: '85%',
      padding: theme.spacing(1, 1.5),
      borderRadius: theme.shape.borderRadius * 2,
      wordBreak: 'break-word',
      '& p': {
        margin: 0,
      },
      '& p + p': {
        marginTop: theme.spacing(1),
      },
      '& pre': {
        overflowX: 'auto',
        padding: theme.spacing(1),
        borderRadius: theme.shape.borderRadius,
        backgroundColor:
          theme.palette.type === 'dark' ? '#00000040' : '#0000000a',
      },
      '& code': {
        fontFamily: 'monospace',
      },
    },
    bubbleUser: {
      backgroundColor: theme.palette.primary.main,
      color: theme.palette.primary.contrastText,
    },
    bubbleAssistant: {
      backgroundColor: theme.palette.background.default,
      border: `1px solid ${theme.palette.divider}`,
    },
    empty: {
      display: 'flex',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing(2),
      textAlign: 'center',
    },
  }),
  { name: 'PluginAiAssistantAikaMessageList' },
);

/**
 * Escapes HTML-significant characters so that untrusted text can safely be
 * interpolated into an HTML string.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Renders a small, safe subset of markdown (fenced code blocks, inline code,
 * bold/italic emphasis, and paragraphs) as sanitized HTML. All literal text
 * is HTML-escaped first, so only the markup this function introduces can
 * ever reach the DOM.
 */
function renderMarkdown(content: string): string {
  const escaped = escapeHtml(content);

  const withCodeBlocks = escaped.replace(
    /```(?:[a-zA-Z0-9]*)\n?([\s\S]*?)```/g,
    (_match, code: string) => `<pre><code>${code}</code></pre>`,
  );

  const withInlineCode = withCodeBlocks.replace(
    /`([^`\n]+)`/g,
    (_match, code: string) => `<code>${code}</code>`,
  );

  // Bold is matched first so that the remaining single-asterisk pairs
  // matched below can only be italics (avoids a lookbehind, which some
  // older runtimes don't support).
  const withBold = withInlineCode.replace(
    /\*\*([^*]+)\*\*/g,
    (_match, text: string) => `<strong>${text}</strong>`,
  );

  const withItalic = withBold.replace(
    /\*([^*]+)\*/g,
    (_match, text: string) => `<em>${text}</em>`,
  );

  const paragraphs = withItalic
    .split(/\n{2,}/)
    .map(paragraph => `<p>${paragraph.replace(/\n/g, '<br/>')}</p>`)
    .join('');

  return paragraphs;
}

function MessageBubble(props: { message: AiAssistantMessage }): JSX.Element {
  const { message } = props;
  const classes = useStyles();
  const isUser = message.role === 'user';

  return (
    <div
      className={`${classes.row} ${
        isUser ? classes.rowUser : classes.rowAssistant
      }`}
    >
      <div
        className={`${classes.bubble} ${
          isUser ? classes.bubbleUser : classes.bubbleAssistant
        }`}
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
      />
    </div>
  );
}

/**
 * Props for {@link AikaMessageList}.
 *
 * @public
 */
export interface AikaMessageListProps {
  /** The conversation whose messages should be displayed, if any. */
  conversationId?: string;
  /**
   * Bump this value after sending a message to trigger a refetch of the
   * conversation from the backend.
   */
  refreshToken?: number;
}

/**
 * Scrollable list of chat messages for the AiKA side panel. Loads the
 * conversation via {@link aiAssistantApiRef} and auto-scrolls to the newest
 * message.
 *
 * @public
 */
export function AikaMessageList(props: AikaMessageListProps): JSX.Element {
  const { conversationId, refreshToken } = props;
  const classes = useStyles();
  const aiAssistantApi = useApi(aiAssistantApiRef);
  const bottomRef = useRef<HTMLDivElement>(null);

  const {
    value: conversation,
    loading,
    error,
  } = useAsync(async () => {
    if (!conversationId) {
      return undefined;
    }
    return aiAssistantApi.getConversation(conversationId);
    // refreshToken is intentionally included purely to force a refetch.
  }, [aiAssistantApi, conversationId, refreshToken]);

  const messages = conversation?.messages ?? [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  if (error) {
    return (
      <div className={classes.root}>
        <ResponseErrorPanel error={error} />
      </div>
    );
  }

  if (loading && !conversation) {
    return (
      <div className={classes.root}>
        <Progress />
      </div>
    );
  }

  if (!conversationId || messages.length === 0) {
    return (
      <div className={classes.root}>
        <div className={classes.empty}>
          <Typography variant="body2" color="textSecondary">
            Ask AiKA anything about this page, your services, or the catalog.
          </Typography>
        </div>
      </div>
    );
  }

  return (
    <div className={classes.root}>
      {messages.map(message => (
        <MessageBubble key={message.id} message={message} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
