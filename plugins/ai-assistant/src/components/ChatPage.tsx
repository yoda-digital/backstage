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

import { useCallback, useEffect, useState } from 'react';
import useAsync from 'react-use/esm/useAsync';
import {
  Button,
  Grid,
  IconButton,
  Paper,
  TextField,
  Typography,
} from '@material-ui/core';
import SendIcon from '@material-ui/icons/Send';
import AddIcon from '@material-ui/icons/Add';
import { useApi } from '@backstage/core-plugin-api';
import {
  Content,
  Header,
  Page,
  Progress,
  ResponseErrorPanel,
} from '@backstage/core-components';
import { useTranslationRef } from '@backstage/frontend-plugin-api';
import { AiConversation } from '@backstage/plugin-ai-assistant-common';
import { aiAssistantApiRef } from '../api/AiAssistantClient';
import { ChatMessage } from './ChatMessage';
import { ModeSelector } from './ModeSelector';
import { ConversationList } from './ConversationList';
import { aiAssistantTranslationRef } from '../translation';

/**
 * The main AI Assistant chat page, combining a conversation side panel, a
 * mode selector, and the active chat thread.
 *
 * @public
 */
export function ChatPage(): JSX.Element {
  const { t } = useTranslationRef(aiAssistantTranslationRef);
  const aiAssistantApi = useApi(aiAssistantApiRef);

  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<
    AiConversation | undefined
  >();
  const [selectedModeId, setSelectedModeId] = useState<string | undefined>();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  const {
    value: modes,
    loading: modesLoading,
    error: modesError,
  } = useAsync(async () => aiAssistantApi.listModes(), [aiAssistantApi]);

  const {
    value: initialConversations,
    loading: conversationsLoading,
    error: conversationsError,
  } = useAsync(
    async () => aiAssistantApi.listConversations(),
    [aiAssistantApi],
  );

  useEffect(() => {
    if (initialConversations) {
      setConversations(initialConversations);
    }
  }, [initialConversations]);

  useEffect(() => {
    if (!selectedModeId && modes && modes.length > 0) {
      setSelectedModeId(modes[0].id);
    }
  }, [modes, selectedModeId]);

  const handleSelectConversation = useCallback(
    async (conversation: AiConversation) => {
      const full = await aiAssistantApi.getConversation(conversation.id);
      setActiveConversation(full);
    },
    [aiAssistantApi],
  );

  const handleNewConversation = useCallback(async () => {
    if (!selectedModeId) {
      return;
    }
    const conversation = await aiAssistantApi.createConversation({
      modeId: selectedModeId,
    });
    setConversations(prev => [conversation, ...prev]);
    setActiveConversation(conversation);
  }, [aiAssistantApi, selectedModeId]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || !activeConversation) {
      return;
    }
    const content = input;
    setInput('');
    setSending(true);
    try {
      const reply = await aiAssistantApi.sendMessage(activeConversation.id, {
        content,
      });
      setActiveConversation(prev =>
        prev
          ? {
              ...prev,
              messages: [
                ...prev.messages,
                {
                  id: `local-${Date.now()}`,
                  role: 'user',
                  content,
                  timestamp: new Date().toISOString(),
                },
                reply,
              ],
            }
          : prev,
      );
    } finally {
      setSending(false);
    }
  }, [aiAssistantApi, activeConversation, input]);

  const error = modesError ?? conversationsError;
  if (error) {
    return (
      <Page themeId="tool">
        <Header title={t('chatPage.title')} subtitle={t('chatPage.subtitle')} />
        <Content>
          <ResponseErrorPanel error={error} />
        </Content>
      </Page>
    );
  }

  return (
    <Page themeId="tool">
      <Header title={t('chatPage.title')} subtitle={t('chatPage.subtitle')} />
      <Content>
        <Grid container spacing={2} style={{ height: '100%' }}>
          <Grid item xs={12} md={3}>
            <Paper style={{ padding: 16 }}>
              <ModeSelector
                selectedModeId={selectedModeId}
                onSelect={setSelectedModeId}
              />
              <Button
                fullWidth
                color="primary"
                startIcon={<AddIcon />}
                style={{ marginTop: 8, marginBottom: 16 }}
                onClick={handleNewConversation}
                disabled={!selectedModeId}
              >
                {t('chatPage.newConversationButton')}
              </Button>
              <Typography variant="h6">
                {t('chatPage.conversationsHeading')}
              </Typography>
              {conversationsLoading || modesLoading ? (
                <Progress />
              ) : (
                <ConversationList
                  conversations={conversations}
                  activeConversationId={activeConversation?.id}
                  onSelect={handleSelectConversation}
                />
              )}
            </Paper>
          </Grid>
          <Grid item xs={12} md={9}>
            <Paper
              style={{
                padding: 16,
                minHeight: 400,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {activeConversation ? (
                <>
                  <div style={{ flex: 1, overflowY: 'auto' }}>
                    {activeConversation.messages.map(message => (
                      <ChatMessage key={message.id} message={message} />
                    ))}
                  </div>
                  <div style={{ display: 'flex', marginTop: 16 }}>
                    <TextField
                      fullWidth
                      value={input}
                      onChange={event => setInput(event.target.value)}
                      onKeyDown={event => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          handleSend();
                        }
                      }}
                      disabled={sending}
                      placeholder={t('chatPage.messagePlaceholder')}
                    />
                    <IconButton
                      color="primary"
                      onClick={handleSend}
                      disabled={sending || !input.trim()}
                    >
                      <SendIcon />
                    </IconButton>
                  </div>
                </>
              ) : (
                <Typography>{t('chatPage.emptyState')}</Typography>
              )}
            </Paper>
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
}
