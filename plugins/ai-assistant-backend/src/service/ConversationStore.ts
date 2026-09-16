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

import { Knex } from 'knex';
import { v4 as uuid } from 'uuid';
import {
  AiConversation,
  AiAssistantMessage,
  ConversationQuery,
} from '@backstage/plugin-ai-assistant-common';

interface ConversationRow {
  id: string;
  title: string;
  mode_id: string;
  user_entity_ref: string;
  created_at: string;
  updated_at: string;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources: string | null;
  created_at: string;
}

/**
 * Stores AI assistant conversations and their messages.
 *
 * @internal
 */
export class ConversationStore {
  constructor(private readonly db: Knex) {}

  async create(params: {
    title: string;
    modeId: string;
    userEntityRef: string;
  }): Promise<AiConversation> {
    const id = uuid();
    const now = new Date().toISOString();
    await this.db('ai_assistant_conversations').insert({
      id,
      title: params.title,
      mode_id: params.modeId,
      user_entity_ref: params.userEntityRef,
      created_at: now,
      updated_at: now,
    });
    return {
      id,
      title: params.title,
      modeId: params.modeId,
      userEntityRef: params.userEntityRef,
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
  }

  async addMessage(
    conversationId: string,
    message: Omit<AiAssistantMessage, 'id' | 'timestamp'>,
  ): Promise<AiAssistantMessage> {
    const id = uuid();
    const timestamp = new Date().toISOString();
    await this.db('ai_assistant_messages').insert({
      id,
      conversation_id: conversationId,
      role: message.role,
      content: message.content,
      sources: message.sources ? JSON.stringify(message.sources) : null,
      created_at: timestamp,
    });
    await this.db('ai_assistant_conversations')
      .where({ id: conversationId })
      .update({ updated_at: timestamp });
    return {
      id,
      role: message.role,
      content: message.content,
      sources: message.sources,
      timestamp,
    };
  }

  async list(query: ConversationQuery): Promise<AiConversation[]> {
    let qb = this.db<ConversationRow>('ai_assistant_conversations').select('*');
    if (query.userEntityRef)
      qb = qb.where('user_entity_ref', query.userEntityRef);
    if (query.modeId) qb = qb.where('mode_id', query.modeId);
    qb = qb.orderBy('updated_at', 'desc');
    if (query.limit) qb = qb.limit(query.limit);
    if (query.offset) qb = qb.offset(query.offset);
    const rows = await qb;
    return rows.map(r => this.rowToConversation(r, []));
  }

  async get(id: string): Promise<AiConversation | undefined> {
    const row = await this.db<ConversationRow>('ai_assistant_conversations')
      .where({ id })
      .first();
    if (!row) return undefined;
    const msgRows = await this.db<MessageRow>('ai_assistant_messages')
      .where({ conversation_id: id })
      .orderBy('created_at', 'asc');
    const messages: AiAssistantMessage[] = msgRows.map(m => ({
      id: m.id,
      role: m.role,
      content: m.content,
      sources: m.sources ? JSON.parse(m.sources) : undefined,
      timestamp: m.created_at,
    }));
    return this.rowToConversation(row, messages);
  }

  private rowToConversation(
    row: ConversationRow,
    messages: AiAssistantMessage[],
  ): AiConversation {
    return {
      id: row.id,
      title: row.title,
      modeId: row.mode_id,
      userEntityRef: row.user_entity_ref,
      messages,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
