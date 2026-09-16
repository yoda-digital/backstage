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

/**
 * The supported input types for a generated template's form fields.
 *
 * @public
 */
export type FormFieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'entity-picker'
  | 'repo-url-picker';

/**
 * A single field within the generated template's `parameters` section.
 *
 * @public
 */
export interface FormField {
  readonly name: string;
  readonly title: string;
  readonly description?: string;
  readonly type: FormFieldType;
  readonly required: boolean;
}

/**
 * A single action step within the generated template's `steps` section.
 *
 * @public
 */
export interface ActionStep {
  readonly id: string;
  readonly name: string;
  readonly action: string;
  readonly input: Record<string, unknown>;
}

/**
 * The high-level metadata of the template being edited.
 *
 * @public
 */
export interface TemplateMetadata {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly owner: string;
  readonly type: string;
}
