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

import { LoggerService, UrlReaderService } from '@backstage/backend-plugin-api';
import { ScmIntegrationRegistry } from '@backstage/integration';
import { SoundcheckFactCollector } from '@backstage/plugin-soundcheck-node';
import { SoundcheckFact } from '@backstage/plugin-soundcheck-common';

const STANDARD_FILES = {
  hasReadme: 'README.md',
  hasCodeowners: 'CODEOWNERS',
  hasCiConfig: '.gitlab-ci.yml',
  hasCatalogInfo: 'catalog-info.yaml',
  hasChangelog: 'CHANGELOG.md',
  hasLicense: 'LICENSE',
} as const;

/**
 * A single content pattern check — a regex evaluated against a file's raw
 * contents.
 * @internal
 */
export interface ScmContentPattern {
  name: string;
  path: string;
  regex: string;
}

/**
 * Options used to create a {@link ScmFactCollector}.
 * @internal
 */
export interface ScmFactCollectorOptions {
  integrations: ScmIntegrationRegistry;
  reader: UrlReaderService;
  additionalFiles?: string[];
  patterns?: ScmContentPattern[];
  logger: LoggerService;
}

/**
 * Analyzes a repository's source content: standard file existence
 * (README, CODEOWNERS, CI config, catalog-info.yaml, ...), plus any
 * configured regex or field-value checks.
 *
 * The entity is expected to carry a `backstage.io/source-location`
 * annotation resolvable to a repository URL; resolving that annotation is
 * left to the caller (typically the soundcheck backend's collection
 * pipeline, which has catalog access), so `entityRef` here is treated as
 * the repository root URL to check.
 * @internal
 */
export class ScmFactCollector implements SoundcheckFactCollector {
  readonly factRef = 'soundcheck:scm/content-analysis';
  readonly description =
    'Analyzes source code content for file existence, regex patterns, and config field checks';

  private constructor(private readonly options: ScmFactCollectorOptions) {}

  static create(options: ScmFactCollectorOptions): ScmFactCollector {
    return new ScmFactCollector(options);
  }

  private async fileExists(baseUrl: string, path: string): Promise<boolean> {
    try {
      await this.options.reader.readUrl(new URL(path, baseUrl).toString());
      return true;
    } catch {
      return false;
    }
  }

  private async checkPattern(
    baseUrl: string,
    pattern: ScmContentPattern,
  ): Promise<boolean> {
    try {
      const response = await this.options.reader.readUrl(
        new URL(pattern.path, baseUrl).toString(),
      );
      const content = (await response.buffer()).toString('utf-8');
      return new RegExp(pattern.regex).test(content);
    } catch {
      return false;
    }
  }

  async collect(
    entityRef: string,
  ): Promise<Omit<SoundcheckFact, 'factRef' | 'entityRef' | 'collectedAt'>> {
    const {
      integrations,
      additionalFiles = [],
      patterns = [],
      logger,
    } = this.options;

    let baseUrl: string;
    try {
      baseUrl = new URL(entityRef).toString();
    } catch {
      logger.debug(
        `SCM fact collector expected a resolvable repository URL, got "${entityRef}"`,
      );
      return {
        data: {
          available: false,
          reason: 'Entity has no resolvable source location',
        },
      };
    }

    if (!integrations.byUrl(baseUrl)) {
      return {
        data: {
          available: false,
          reason: 'No SCM integration configured for this repository host',
        },
      };
    }

    const fileEntries = await Promise.all(
      Object.entries(STANDARD_FILES).map(async ([key, path]) => [
        key,
        await this.fileExists(baseUrl, path),
      ]),
    );
    const additionalFileEntries = await Promise.all(
      additionalFiles.map(async path => [
        path,
        await this.fileExists(baseUrl, path),
      ]),
    );
    const patternEntries = await Promise.all(
      patterns.map(async pattern => [
        pattern.name,
        await this.checkPattern(baseUrl, pattern),
      ]),
    );

    return {
      data: {
        available: true,
        files: {
          ...Object.fromEntries(fileEntries),
          ...(additionalFileEntries.length
            ? { additional: Object.fromEntries(additionalFileEntries) }
            : {}),
        },
        ...(patternEntries.length
          ? { patterns: Object.fromEntries(patternEntries) }
          : {}),
      },
    };
  }
}
