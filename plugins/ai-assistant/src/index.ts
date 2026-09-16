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

export { default } from './alpha/plugin';
export { AiAssistantClient, aiAssistantApiRef } from './api/AiAssistantClient';
export type { AiAssistantApi } from './api/AiAssistantClient';
export { ChatPage } from './components/ChatPage';
export { ChatMessage } from './components/ChatMessage';
export type { ChatMessageProps } from './components/ChatMessage';
export { ModeSelector } from './components/ModeSelector';
export type { ModeSelectorProps } from './components/ModeSelector';
export { ConversationList } from './components/ConversationList';
export type { ConversationListProps } from './components/ConversationList';
export { ModeManager } from './components/ModeManager';
export type { ModeManagerProps } from './components/ModeManager';
export { ModeEditor } from './components/ModeEditor';
export type { ModeEditorProps } from './components/ModeEditor';
export { usePageContext } from './hooks/usePageContext';
export { useSuggestions } from './hooks/useSuggestions';
export { AikaFab } from './components/AikaFab';
export type { AikaFabProps, AikaFabSide } from './components/AikaFab';
export { AikaSidePanel } from './components/AikaSidePanel';
export type { AikaSidePanelProps } from './components/AikaSidePanel';
export { AikaMessageList } from './components/AikaMessageList';
export type { AikaMessageListProps } from './components/AikaMessageList';
export { AikaInput } from './components/AikaInput';
export type { AikaInputProps } from './components/AikaInput';
export { aikaAppModule } from './modules/aikaAppModule';
