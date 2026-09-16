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

import { LoggerService } from '@backstage/backend-plugin-api';
import { SoundcheckFactCollector } from '@backstage/plugin-soundcheck-node';
import { SoundcheckFact } from '@backstage/plugin-soundcheck-common';

/**
 * Options used to create a {@link JHelpFactCollector}.
 * @internal
 */
export interface JHelpFactCollectorOptions {
  baseUrl: string;
  apiKey: string;
  logger: LoggerService;
}

interface JHelpTicket {
  status?: string;
  createdAt?: string;
  resolvedAt?: string;
  slaBreached?: boolean;
}

/**
 * Collects open ticket counts, average resolution time, and SLA compliance
 * from JHelp for the helpdesk component associated with an entity.
 * @internal
 */
export class JHelpFactCollector implements SoundcheckFactCollector {
  readonly factRef = 'soundcheck:jhelp/ticket-metrics';
  readonly description =
    'Collects open ticket count, average resolution time, and SLA compliance rate from JHelp';

  private constructor(private readonly options: JHelpFactCollectorOptions) {}

  static create(options: JHelpFactCollectorOptions): JHelpFactCollector {
    return new JHelpFactCollector(options);
  }

  async collect(
    entityRef: string,
  ): Promise<Omit<SoundcheckFact, 'factRef' | 'entityRef' | 'collectedAt'>> {
    const { baseUrl, apiKey, logger } = this.options;
    const componentName = entityRef.split('/').pop() ?? entityRef;

    try {
      const url = new URL('/api/v1/tickets', baseUrl);
      url.searchParams.set('component', componentName);

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        return {
          data: {
            available: false,
            reason: `JHelp API returned ${response.status}`,
          },
        };
      }

      const body = (await response.json()) as { tickets?: JHelpTicket[] };
      const tickets = body.tickets ?? [];

      const openTicketsCount = tickets.filter(
        ticket => ticket.status === 'open',
      ).length;

      const resolvedTickets = tickets.filter(
        ticket => ticket.createdAt && ticket.resolvedAt,
      );
      const resolutionDurationsHours = resolvedTickets.map(ticket => {
        const created = new Date(ticket.createdAt!).getTime();
        const resolved = new Date(ticket.resolvedAt!).getTime();
        return (resolved - created) / (1000 * 60 * 60);
      });
      const averageResolutionTimeHours = resolutionDurationsHours.length
        ? resolutionDurationsHours.reduce((sum, hours) => sum + hours, 0) /
          resolutionDurationsHours.length
        : 0;

      const slaCompliantCount = resolvedTickets.filter(
        ticket => !ticket.slaBreached,
      ).length;
      const slaComplianceRate = resolvedTickets.length
        ? slaCompliantCount / resolvedTickets.length
        : 1;

      return {
        data: {
          available: true,
          openTicketsCount,
          averageResolutionTimeHours,
          slaComplianceRate,
        },
      };
    } catch (error) {
      logger.warn(`Failed to collect JHelp facts for ${entityRef}: ${error}`);
      return {
        data: {
          available: false,
          reason: 'Failed to reach the JHelp API',
        },
      };
    }
  }
}
