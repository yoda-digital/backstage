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

import { KeyboardEvent, useCallback, useState } from 'react';
import Chip from '@material-ui/core/Chip';
import IconButton from '@material-ui/core/IconButton';
import TextField from '@material-ui/core/TextField';
import { makeStyles, Theme } from '@material-ui/core/styles';
import SendIcon from '@material-ui/icons/Send';
import {
  AiSuggestion,
  PageContext,
} from '@backstage/plugin-ai-assistant-common';
import { useSuggestions } from '../hooks/useSuggestions';

const useStyles = makeStyles(
  (theme: Theme) => ({
    root: {
      padding: theme.spacing(1.5),
      borderTop: `1px solid ${theme.palette.divider}`,
    },
    suggestions: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: theme.spacing(0.5),
      marginBottom: theme.spacing(1),
    },
    inputRow: {
      display: 'flex',
      alignItems: 'flex-end',
    },
    textField: {
      flex: 1,
    },
  }),
  { name: 'PluginAiAssistantAikaInput' },
);

/**
 * Props for {@link AikaInput}.
 *
 * @public
 */
export interface AikaInputProps {
  /** Invoked with the message content when the user sends a message. */
  onSend: (content: string) => void | Promise<void>;
  /** The current page context, used to derive contextual suggestion chips. */
  pageContext: PageContext;
  /** Disables the input, e.g. while waiting for a response. */
  disabled?: boolean;
  /** Placeholder text for the textarea. */
  placeholder?: string;
}

/**
 * Chat input for the AiKA side panel: a multi-line textarea with a send
 * button and contextual suggestion chips. Press Enter to send, Shift+Enter
 * for a newline.
 *
 * @public
 */
export function AikaInput(props: AikaInputProps): JSX.Element {
  const { onSend, pageContext, disabled, placeholder } = props;
  const classes = useStyles();
  const suggestions = useSuggestions(pageContext);
  const [value, setValue] = useState('');

  const handleSend = useCallback(() => {
    const content = value.trim();
    if (!content || disabled) {
      return;
    }
    setValue('');
    onSend(content);
  }, [value, disabled, onSend]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleSuggestionClick = useCallback((suggestion: AiSuggestion) => {
    setValue(suggestion.prompt);
  }, []);

  return (
    <div className={classes.root}>
      {suggestions.length > 0 && (
        <div className={classes.suggestions}>
          {suggestions.map(suggestion => (
            <Chip
              key={suggestion.id}
              size="small"
              label={suggestion.label}
              onClick={() => handleSuggestionClick(suggestion)}
              disabled={disabled}
            />
          ))}
        </div>
      )}
      <div className={classes.inputRow}>
        <TextField
          className={classes.textField}
          multiline
          maxRows={6}
          size="small"
          variant="outlined"
          placeholder={placeholder ?? 'Ask AiKA...'}
          value={value}
          onChange={event => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
        />
        <IconButton
          color="primary"
          aria-label="Send message"
          onClick={handleSend}
          disabled={disabled || !value.trim()}
        >
          <SendIcon />
        </IconButton>
      </div>
    </div>
  );
}
