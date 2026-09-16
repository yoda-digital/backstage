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

import { Entity } from '@backstage/catalog-model';
import {
  SoundcheckCheck,
  SoundcheckCheckResult,
  SoundcheckFact,
  SoundcheckRule,
} from '@backstage/plugin-soundcheck-common';
import { DateTime } from 'luxon';
import { renderMessage } from './messageRenderer';
import { evaluateOperator } from './operators';
import { resolvePath } from './pathResolvers';

/**
 * Evaluates Soundcheck rules against collected facts.
 *
 * Rules are trees of leaf conditions (a fact ref, a path resolved through
 * the check's configured {@link SoundcheckCheck.pathResolver}, an operator,
 * and a comparison value) combined with `all`/`any`/`not` boolean
 * combinators.
 *
 * @internal
 */
export class CheckEngine {
  async evaluate(
    check: SoundcheckCheck,
    entityRef: string,
    facts: SoundcheckFact[],
    entity?: Entity,
  ): Promise<SoundcheckCheckResult> {
    const factsByRef = new Map(facts.map(fact => [fact.factRef, fact]));
    const evaluatedAt = DateTime.now().toISO() as string;

    const referencedRefs = this.collectFactRefs(check.rule, check.factRef);
    if (!referencedRefs.some(ref => factsByRef.has(ref))) {
      return {
        checkId: check.id,
        entityRef,
        status: 'unknown',
        message: `No fact found for ${check.factRef}`,
        evaluatedAt,
      };
    }

    const passed = await this.evaluateNode(check.rule, check, factsByRef);

    const template = passed ? check.passedMessage : check.failedMessage;
    let message: string | undefined;
    if (template) {
      message = await renderMessage(template, {
        entity,
        fact: factsByRef.get(check.factRef)?.data,
        facts: Object.fromEntries(
          Array.from(factsByRef.entries()).map(([ref, fact]) => [
            ref,
            fact.data,
          ]),
        ),
      });
    } else if (!passed) {
      message = this.defaultFailureMessage(check.rule);
    }

    return {
      checkId: check.id,
      entityRef,
      status: passed ? 'pass' : 'fail',
      message,
      evaluatedAt,
    };
  }

  private collectFactRefs(
    node: SoundcheckRule,
    defaultFactRef: string,
  ): string[] {
    if ('all' in node) {
      return node.all.flatMap(child =>
        this.collectFactRefs(child, defaultFactRef),
      );
    }
    if ('any' in node) {
      return node.any.flatMap(child =>
        this.collectFactRefs(child, defaultFactRef),
      );
    }
    if ('not' in node) {
      return this.collectFactRefs(node.not, defaultFactRef);
    }
    return [node.factRef ?? defaultFactRef];
  }

  private async evaluateNode(
    node: SoundcheckRule,
    check: SoundcheckCheck,
    factsByRef: Map<string, SoundcheckFact>,
  ): Promise<boolean> {
    if ('all' in node) {
      const results = await Promise.all(
        node.all.map(child => this.evaluateNode(child, check, factsByRef)),
      );
      return results.every(Boolean);
    }
    if ('any' in node) {
      const results = await Promise.all(
        node.any.map(child => this.evaluateNode(child, check, factsByRef)),
      );
      return results.some(Boolean);
    }
    if ('not' in node) {
      return !(await this.evaluateNode(node.not, check, factsByRef));
    }

    const fact = factsByRef.get(node.factRef ?? check.factRef);
    const path = node.path ?? node.field;
    const factValue = path
      ? await resolvePath(check.pathResolver, fact?.data ?? {}, path)
      : fact?.data;

    return evaluateOperator(node.operator, factValue, node.value);
  }

  private defaultFailureMessage(rule: SoundcheckRule): string {
    if ('all' in rule || 'any' in rule || 'not' in rule) {
      return 'Check failed';
    }
    const path = rule.path ?? rule.field ?? '<rule>';
    return `Field "${path}" did not satisfy ${rule.operator}`;
  }
}
