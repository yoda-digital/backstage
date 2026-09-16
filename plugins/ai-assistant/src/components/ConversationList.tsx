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

import { List, ListItem, ListItemText, Typography } from '@material-ui/core';
import { AiConversation } from '@backstage/plugin-ai-assistant-common';

/**
 * Props for {@link ConversationList}.
 *
 * @public
 */
export interface ConversationListProps {
  conversations: AiConversation[];
  activeConversationId?: string;
  onSelect: (conversation: AiConversation) => void;
}

/**
 * Renders the sidebar list of past conversations, highlighting the active
 * one.
 *
 * @public
 */
export function ConversationList(props: ConversationListProps): JSX.Element {
  const { conversations, activeConversationId, onSelect } = props;

  if (conversations.length === 0) {
    return (
      <Typography variant="body2" color="textSecondary">
        No conversations yet.
      </Typography>
    );
  }

  return (
    <List dense>
      {conversations.map(conversation => (
        <ListItem
          key={conversation.id}
          button
          selected={conversation.id === activeConversationId}
          onClick={() => onSelect(conversation)}
        >
          <ListItemText
            primary={conversation.title}
            secondary={conversation.modeId}
          />
        </ListItem>
      ))}
    </List>
  );
}
