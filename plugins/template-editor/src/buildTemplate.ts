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

import { JsonObject } from '@backstage/types';
import { TemplateEntityV1beta3 } from '@backstage/plugin-scaffolder-common';
import { ActionStep, FormField, TemplateMetadata } from './types';

function fieldToSchemaProperty(field: FormField): JsonObject {
  switch (field.type) {
    case 'number':
      return {
        title: field.title,
        description: field.description ?? '',
        type: 'number',
      };
    case 'boolean':
      return {
        title: field.title,
        description: field.description ?? '',
        type: 'boolean',
      };
    case 'entity-picker':
      return {
        title: field.title,
        description: field.description ?? '',
        type: 'string',
        'ui:field': 'EntityPicker',
      };
    case 'repo-url-picker':
      return {
        title: field.title,
        description: field.description ?? '',
        type: 'string',
        'ui:field': 'RepoUrlPicker',
      };
    case 'string':
    default:
      return {
        title: field.title,
        description: field.description ?? '',
        type: 'string',
      };
  }
}

/**
 * Builds the `parameters` section of a scaffolder template from a list of
 * form fields.
 *
 * @public
 */
export function buildParametersSchema(fields: FormField[]): JsonObject {
  const properties: JsonObject = {};
  const required: string[] = [];
  for (const field of fields) {
    properties[field.name] = fieldToSchemaProperty(field);
    if (field.required) {
      required.push(field.name);
    }
  }
  return {
    title: 'Fill in the template parameters',
    properties,
    required,
  };
}

/**
 * Builds a full {@link @backstage/plugin-scaffolder-common#TemplateEntityV1beta3}
 * from editor state.
 *
 * @public
 */
export function buildTemplate(options: {
  metadata: TemplateMetadata;
  fields: FormField[];
  steps: ActionStep[];
}): TemplateEntityV1beta3 {
  const { metadata, fields, steps } = options;
  return {
    apiVersion: 'scaffolder.backstage.io/v1beta3',
    kind: 'Template',
    metadata: {
      name: metadata.name || 'unnamed-template',
      title: metadata.title,
      description: metadata.description,
    },
    spec: {
      type: metadata.type || 'service',
      owner: metadata.owner || undefined,
      parameters: buildParametersSchema(fields),
      steps: steps.map(step => ({
        id: step.id,
        name: step.name || undefined,
        action: step.action,
        input: step.input as JsonObject,
      })),
    },
  };
}
