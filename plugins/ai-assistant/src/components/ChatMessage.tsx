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

import { Chip, Typography } from '@material-ui/core';
import { AiAssistantMessage } from '@backstage/plugin-ai-assistant-common';

/**
 * Props for {@link ChatMessage}.
 *
 * @public
 */
export interface ChatMessageProps {
  message: AiAssistantMessage;
}

/**
 * Renders a single message bubble within a conversation, aligned by role.
 *
 * @public
 */
export function ChatMessage(props: ChatMessageProps): JSX.Element {
  const { message } = props;
  const isUser = message.role === 'user';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
        marginBottom: 12,
      }}
    >
      <Typography variant="caption" color="textSecondary">
        {message.role}
      </Typography>
      <div
        style={{
          maxWidth: '75%',
          padding: '8px 12px',
          borderRadius: 8,
          backgroundColor: isUser ? '#e3f2fd' : '#f5f5f5',
        }}
      >
        <Typography variant="body1" style={{ whiteSpace: 'pre-wrap' }}>
          {message.content}
        </Typography>
      </div>
      {message.sources && message.sources.length > 0 && (
        <div
          style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}
        >
          {message.sources.map((source, index) => (
            <Chip
              key={`${source.sourceId}-${index}`}
              size="small"
              label={source.sourceId}
              variant="outlined"
            />
          ))}
        </div>
      )}
    </div>
  );
}
