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
  AppRootElementBlueprint,
  createFrontendModule,
} from '@backstage/frontend-plugin-api';
import { useApi } from '@backstage/core-plugin-api';
import { PageContext } from '@backstage/plugin-ai-assistant-common';
import { aiAssistantApiRef } from '../api/AiAssistantClient';
import { AikaFab } from '../components/AikaFab';
import { AikaSidePanel } from '../components/AikaSidePanel';

/** Fallback mode used to create a conversation when no mode is explicitly selected. */
const DEFAULT_CONVERSATION_MODE_ID = 'general';

/**
 * Root component rendered at the application root (outside of the normal
 * page layout) that owns the open/closed state of the AiKA panel and the
 * lifecycle of its active conversation. The FAB and panel are always
 * mounted so that they persist across page navigations and can animate in
 * and out.
 *
 * @internal
 */
function AikaRoot(): JSX.Element {
  const aiAssistantApi = useApi(aiAssistantApiRef);

  const [open, setOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [selectedModeId, setSelectedModeId] = useState<string | undefined>();
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [conversationTitle, setConversationTitle] = useState<
    string | undefined
  >();
  const [refreshToken, setRefreshToken] = useState(0);
  const [sending, setSending] = useState(false);

  const { value: modes } = useAsync(
    async () => aiAssistantApi.listModes(),
    [aiAssistantApi],
  );

  useEffect(() => {
    if (!selectedModeId && modes && modes.length > 0) {
      setSelectedModeId(modes[0].id);
    }
  }, [modes, selectedModeId]);

  const handleToggle = useCallback(() => {
    setOpen(prev => !prev);
    setHasUnread(false);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  const handleSend = useCallback(
    async (content: string, pageContext: PageContext) => {
      setSending(true);
      try {
        let activeConversationId = conversationId;
        if (!activeConversationId) {
          const conversation = await aiAssistantApi.createConversation({
            modeId: selectedModeId ?? DEFAULT_CONVERSATION_MODE_ID,
          });
          activeConversationId = conversation.id;
          setConversationId(conversation.id);
          setConversationTitle(conversation.title);
        }
        await aiAssistantApi.sendMessage(activeConversationId, {
          content,
          modeId: selectedModeId,
          pageContext,
        });
        setRefreshToken(prev => prev + 1);
        setHasUnread(!open);
      } finally {
        setSending(false);
      }
    },
    [aiAssistantApi, conversationId, open, selectedModeId],
  );

  return (
    <>
      <AikaSidePanel
        open={open}
        onClose={handleClose}
        selectedModeId={selectedModeId}
        onSelectMode={setSelectedModeId}
        conversationTitle={conversationTitle}
        conversationId={conversationId}
        refreshToken={refreshToken}
        onSend={handleSend}
        sending={sending}
      />
      <AikaFab open={open} onToggle={handleToggle} hasUnread={hasUnread} />
    </>
  );
}

/**
 * Registers {@link AikaRoot} (the AiKA FAB and side panel) as an app-level
 * element, so it renders on every page without any per-page configuration.
 *
 * @alpha
 */
export const aikaAppRootElement = AppRootElementBlueprint.make({
  name: 'aika-panel',
  params: {
    element: <AikaRoot />,
  },
});

/**
 * Frontend module that installs the AiKA FAB and side panel at the
 * application root.
 *
 * @remarks
 *
 * Add this alongside the `ai-assistant` plugin in the app's `features`
 * list, e.g. in `packages/app/src/App.tsx`:
 *
 * ```tsx
 * import { aikaAppModule } from '@backstage/plugin-ai-assistant';
 *
 * const app = createApp({
 *   features: [aiAssistantPlugin, aikaAppModule, ...],
 * });
 * ```
 *
 * @alpha
 */
export const aikaAppModule = createFrontendModule({
  pluginId: 'app',
  extensions: [aikaAppRootElement],
});
