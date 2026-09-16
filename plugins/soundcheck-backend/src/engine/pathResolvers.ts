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

import { SoundcheckPathResolver } from '@backstage/plugin-soundcheck-common';
import { JSONPath } from 'jsonpath-plus';
import jsonata from 'jsonata';
import jmespath from '@metrichor/jmespath';
import lodashGet from 'lodash.get';

/**
 * Resolves a value out of fact `data` using the given path resolver
 * implementation.
 *
 * | Resolver   | Package               | Use case                            |
 * | ---------- | ---------------------- | ------------------------------------ |
 * | `jsonpath` | `jsonpath-plus`        | Complex queries, wildcards, filters  |
 * | `lodash`   | `lodash.get`           | Simple dot notation                  |
 * | `jmespath` | `@metrichor/jmespath`  | Projections, functions               |
 * | `jsonata`  | `jsonata`              | Complex transformations              |
 *
 * Defaults to `jsonpath` when no resolver is given.
 *
 * @public
 */
export async function resolvePath(
  resolver: SoundcheckPathResolver | undefined,
  data: unknown,
  path: string,
): Promise<unknown> {
  switch (resolver ?? 'jsonpath') {
    case 'jsonpath':
      return JSONPath({ path, json: data as object, wrap: false });
    case 'lodash':
      return lodashGet(data as object, path);
    case 'jmespath':
      return jmespath.search(data as never, path);
    case 'jsonata': {
      const expression = jsonata(path);
      return await expression.evaluate(data);
    }
    default:
      throw new Error(`Unsupported Soundcheck path resolver: ${resolver}`);
  }
}
