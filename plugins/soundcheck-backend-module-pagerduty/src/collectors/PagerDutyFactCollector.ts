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

import { AuthService, LoggerService } from '@backstage/backend-plugin-api';
import { CatalogService } from '@backstage/plugin-catalog-node';
import { SoundcheckFactCollector } from '@backstage/plugin-soundcheck-node';
import { SoundcheckFact } from '@backstage/plugin-soundcheck-common';

const SERVICE_ID_ANNOTATION = 'pagerduty.com/service-id';

/**
 * Options used to create a {@link PagerDutyFactCollector}.
 * @internal
 */
export interface PagerDutyFactCollectorOptions {
  server: string;
  token: string;
  catalog: CatalogService;
  auth: AuthService;
  logger: LoggerService;
}

interface PagerDutyIncident {
  status?: string;
  created_at?: string;
  last_status_change_at?: string;
}

interface PagerDutyOnCall {
  escalation_level?: number;
  user?: { summary?: string };
}

/**
 * Collects open incident counts, mean time to resolution, and on-call
 * status from PagerDuty for the service identified by an entity's
 * `pagerduty.com/service-id` annotation.
 * @internal
 */
export class PagerDutyFactCollector implements SoundcheckFactCollector {
  readonly factRef = 'soundcheck:pagerduty/incident-metrics';
  readonly description =
    'Collects open incident count, mean time to resolution, and on-call status from PagerDuty';

  private constructor(
    private readonly options: PagerDutyFactCollectorOptions,
  ) {}

  static create(
    options: PagerDutyFactCollectorOptions,
  ): PagerDutyFactCollector {
    return new PagerDutyFactCollector(options);
  }

  async collect(
    entityRef: string,
  ): Promise<Omit<SoundcheckFact, 'factRef' | 'entityRef' | 'collectedAt'>> {
    const { server, token, catalog, auth, logger } = this.options;

    try {
      const credentials = await auth.getOwnServiceCredentials();
      const entity = await catalog.getEntityByRef(entityRef, { credentials });
      const serviceId = entity?.metadata.annotations?.[SERVICE_ID_ANNOTATION];

      if (!serviceId) {
        return {
          data: {
            available: false,
            reason: `Entity is missing the ${SERVICE_ID_ANNOTATION} annotation`,
          },
        };
      }

      const headers = {
        Authorization: `Token token=${token}`,
        Accept: 'application/vnd.pagerduty+json;version=2',
      };

      const incidentsUrl = new URL('/incidents', server);
      incidentsUrl.searchParams.set('service_ids[]', serviceId);
      incidentsUrl.searchParams.set('statuses[]', 'triggered');
      incidentsUrl.searchParams.append('statuses[]', 'acknowledged');

      const oncallsUrl = new URL('/oncalls', server);
      oncallsUrl.searchParams.set('service_ids[]', serviceId);

      const [incidentsResponse, oncallsResponse] = await Promise.all([
        fetch(incidentsUrl, { headers }),
        fetch(oncallsUrl, { headers }),
      ]);

      if (!incidentsResponse.ok || !oncallsResponse.ok) {
        return {
          data: {
            available: false,
            reason: `PagerDuty API returned ${incidentsResponse.status}/${oncallsResponse.status}`,
          },
        };
      }

      const incidentsBody = (await incidentsResponse.json()) as {
        incidents?: PagerDutyIncident[];
      };
      const oncallsBody = (await oncallsResponse.json()) as {
        oncalls?: PagerDutyOnCall[];
      };

      const incidents = incidentsBody.incidents ?? [];
      const openIncidentsCount = incidents.length;

      const resolutionDurationsMinutes = incidents
        .filter(
          incident => incident.created_at && incident.last_status_change_at,
        )
        .map(incident => {
          const created = new Date(incident.created_at!).getTime();
          const changed = new Date(incident.last_status_change_at!).getTime();
          return (changed - created) / (1000 * 60);
        });
      const meanTimeToResolutionMinutes = resolutionDurationsMinutes.length
        ? resolutionDurationsMinutes.reduce((sum, m) => sum + m, 0) /
          resolutionDurationsMinutes.length
        : 0;

      const primaryOnCall = (oncallsBody.oncalls ?? []).find(
        oncall => oncall.escalation_level === 1,
      );

      return {
        data: {
          available: true,
          serviceId,
          openIncidentsCount,
          meanTimeToResolutionMinutes,
          onCall: {
            hasPrimaryOnCall: Boolean(primaryOnCall),
            primaryOnCallUser: primaryOnCall?.user?.summary,
          },
        },
      };
    } catch (error) {
      logger.warn(
        `Failed to collect PagerDuty facts for ${entityRef}: ${error}`,
      );
      return {
        data: {
          available: false,
          reason: 'Failed to reach the PagerDuty API',
        },
      };
    }
  }
}
