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

import { useMemo, useState } from 'react';
import Box from '@material-ui/core/Box';
import Grid from '@material-ui/core/Grid';
import Tab from '@material-ui/core/Tab';
import Tabs from '@material-ui/core/Tabs';
import Typography from '@material-ui/core/Typography';
import { useTheme } from '@material-ui/core/styles';
import useAsync from 'react-use/esm/useAsync';
import { useApi } from '@backstage/core-plugin-api';
import {
  Content,
  ContentHeader,
  Header,
  InfoCard,
  Page,
  Progress,
  ResponseErrorPanel,
} from '@backstage/core-components';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import {
  DoraMetricName,
  MetricDataPoint,
  MetricSegment,
  MetricTimeRange,
} from '@backstage/plugin-devex-metrics-common';
import { useTranslationRef } from '@backstage/frontend-plugin-api';
import { devexMetricsApiRef } from '../api/ref';
import { devexMetricsTranslationRef } from '../translation';
import { TimeseriesChart } from './charts/TimeseriesChart';
import {
  DateRangeSelector,
  DateRangeValue,
  DEFAULT_DATE_RANGE,
  granularityForDateRange,
  previousDateRange,
  resolveDateRange,
} from './DateRangeSelector';
import { Segmentation, SegmentationSelector } from './SegmentationSelector';
import { MetricOverlay, OverlayMode } from './MetricOverlay';
import { DiagnosePanel } from './DiagnosePanel';
import { AiUsageMetrics } from './AiUsageMetrics';

const DORA_METRICS: { title: string; metric: DoraMetricName }[] = [
  { title: 'Deployment Frequency', metric: 'deployment_frequency' },
  { title: 'Lead Time for Changes', metric: 'lead_time_for_changes' },
  { title: 'Mean Time to Restore', metric: 'mean_time_to_restore' },
  { title: 'Change Failure Rate', metric: 'change_failure_rate' },
];

interface CardOverlay {
  readonly mode: OverlayMode;
  readonly metric?: DoraMetricName;
}

function defaultOverlays(): Record<DoraMetricName, CardOverlay> {
  return Object.fromEntries(
    DORA_METRICS.map(({ metric }) => [metric, { mode: 'off' as OverlayMode }]),
  ) as Record<DoraMetricName, CardOverlay>;
}

interface MetricCardProps {
  readonly title: string;
  readonly metric: DoraMetricName;
  readonly points: MetricDataPoint[];
  readonly loading: boolean;
  readonly dateRange: DateRangeValue;
  readonly granularity: MetricTimeRange['granularity'];
  readonly segment: MetricSegment;
  readonly overlay: CardOverlay;
  readonly onOverlayChange: (overlay: CardOverlay) => void;
}

function MetricCard(props: MetricCardProps): JSX.Element {
  const {
    title,
    metric,
    points,
    loading,
    dateRange,
    granularity,
    segment,
    overlay,
    onOverlayChange,
  } = props;
  const { t } = useTranslationRef(devexMetricsTranslationRef);
  const api = useApi(devexMetricsApiRef);
  const theme = useTheme();

  const { value: overlayPoints } = useAsync(async () => {
    if (overlay.mode === 'previous-period') {
      const previous = previousDateRange(dateRange);
      return api.queryDora({
        metric,
        timeRange: { ...previous, granularity },
        segment,
      });
    }
    if (overlay.mode === 'metric' && overlay.metric) {
      const current = resolveDateRange(dateRange);
      return api.queryDora({
        metric: overlay.metric,
        timeRange: { ...current, granularity },
        segment,
      });
    }
    return undefined;
  }, [
    api,
    overlay.mode,
    overlay.metric,
    metric,
    dateRange,
    granularity,
    segment.team,
    segment.entityRef,
  ]);

  const overlayLabel =
    overlay.mode === 'previous-period'
      ? t('dashboard.previousPeriodLabel')
      : DORA_METRICS.find(candidate => candidate.metric === overlay.metric)
          ?.title;

  const latest = points[points.length - 1]?.value;

  return (
    <InfoCard title={title}>
      <Box mb={1}>
        <MetricOverlay
          mode={overlay.mode}
          onModeChange={mode => onOverlayChange({ ...overlay, mode })}
          excludeMetric={metric}
          availableMetrics={DORA_METRICS}
          metric={overlay.metric}
          onMetricChange={selected =>
            onOverlayChange({ ...overlay, metric: selected })
          }
        />
      </Box>
      {loading ? (
        <Progress />
      ) : (
        <>
          <Typography variant="h4">
            {latest ?? t('dashboard.noDataLabel')}
          </Typography>
          <TimeseriesChart
            yLabel={title}
            series={[
              {
                label: title,
                color: theme.palette.primary.main,
                data: points.map(point => ({
                  date: point.date,
                  value: point.value,
                })),
              },
            ]}
            overlay={
              overlayPoints && overlayLabel
                ? [
                    {
                      label: overlayLabel,
                      color: theme.palette.text.secondary,
                      data: overlayPoints.map(point => ({
                        date: point.date,
                        value: point.value,
                      })),
                    },
                  ]
                : undefined
            }
          />
        </>
      )}
    </InfoCard>
  );
}

/**
 * A page that shows the four DORA metrics and AI usage over a
 * date range, segmented by team and/or Soundcheck track, with
 * period-over-period and cross-metric comparison overlays and a diagnose
 * panel explaining the query scope and data completeness.
 *
 * @public
 */
export function DoraDashboard(): JSX.Element {
  const { t } = useTranslationRef(devexMetricsTranslationRef);
  const api = useApi(devexMetricsApiRef);
  const catalogApi = useApi(catalogApiRef);

  const [dateRange, setDateRange] =
    useState<DateRangeValue>(DEFAULT_DATE_RANGE);
  const [segmentation, setSegmentation] = useState<Segmentation>({});
  const [overlays, setOverlays] =
    useState<Record<DoraMetricName, CardOverlay>>(defaultOverlays);
  const [tab, setTab] = useState(0);

  const resolvedRange = useMemo(() => resolveDateRange(dateRange), [dateRange]);
  const granularity = granularityForDateRange(dateRange);
  const segment: MetricSegment = useMemo(
    () => ({ team: segmentation.team }),
    [segmentation.team],
  );

  const {
    value: metricPoints,
    loading,
    error,
  } = useAsync(async () => {
    const entries = await Promise.all(
      DORA_METRICS.map(async ({ metric }) => {
        const points = await api.queryDora({
          metric,
          timeRange: { ...resolvedRange, granularity },
          segment,
        });
        return [metric, points] as const;
      }),
    );
    return Object.fromEntries(entries) as Record<
      DoraMetricName,
      MetricDataPoint[]
    >;
  }, [
    api,
    resolvedRange.from,
    resolvedRange.to,
    granularity,
    segment.team,
    segment.entityRef,
  ]);

  const { value: scopeEntities } = useAsync(async () => {
    const filter: Record<string, string> = { kind: 'Component' };
    if (segmentation.team) {
      filter['relations.ownedBy'] = segmentation.team;
    }
    const response = await catalogApi.getEntities({
      filter,
      fields: ['metadata.name', 'metadata.namespace', 'kind'],
    });
    return response.items;
  }, [catalogApi, segmentation.team]);

  const diagnose = useMemo(() => {
    const entityCount = scopeEntities?.length ?? 0;
    const allPoints = Object.values(metricPoints ?? {}).flat();
    const distinctEntityRefs = new Set(
      allPoints
        .map(point => point.entityRef)
        .filter((ref): ref is string => Boolean(ref)),
    );
    const total = Math.max(entityCount, distinctEntityRefs.size);
    const warnings = DORA_METRICS.filter(
      ({ metric }) => (metricPoints?.[metric]?.length ?? 0) === 0,
    ).map(({ title }) => `No data points found for ${title} in this range`);

    return {
      scope: {
        entityCount,
        filterDescription: segmentation.team
          ? `Owned by ${segmentation.team}`
          : 'All components',
      },
      attribution: { withData: distinctEntityRefs.size, total },
      warnings,
      missingAnnotations: [] as string[],
    };
  }, [scopeEntities, metricPoints, segmentation.team]);

  function handleOverlayChange(metric: DoraMetricName, overlay: CardOverlay) {
    setOverlays(current => ({ ...current, [metric]: overlay }));
  }

  return (
    <Page themeId="tool">
      <Header title={t('dashboard.title')} subtitle={t('dashboard.subtitle')} />
      <Content>
        <ContentHeader title={t('dashboard.dashboardHeading')}>
          <Box display="flex" flexWrap="wrap" gridGap={8}>
            <DateRangeSelector value={dateRange} onChange={setDateRange} />
            <SegmentationSelector
              value={segmentation}
              onChange={setSegmentation}
            />
          </Box>
        </ContentHeader>

        <Tabs
          value={tab}
          onChange={(_event, next) => setTab(next)}
          indicatorColor="primary"
          textColor="primary"
        >
          <Tab label={t('dashboard.tabDoraMetrics')} />
          <Tab label={t('dashboard.tabAiUsage')} />
        </Tabs>

        {error && (
          <Box mt={2}>
            <ResponseErrorPanel error={error} />
          </Box>
        )}

        {!error && tab === 0 && (
          <Box mt={2}>
            <Grid container spacing={2}>
              {DORA_METRICS.map(({ title, metric }) => (
                <Grid item xs={12} sm={6} key={metric}>
                  <MetricCard
                    title={title}
                    metric={metric}
                    points={metricPoints?.[metric] ?? []}
                    loading={loading}
                    dateRange={dateRange}
                    granularity={granularity}
                    segment={segment}
                    overlay={overlays[metric]}
                    onOverlayChange={overlay =>
                      handleOverlayChange(metric, overlay)
                    }
                  />
                </Grid>
              ))}
            </Grid>
            <Box mt={2}>
              <DiagnosePanel
                scope={diagnose.scope}
                attribution={diagnose.attribution}
                warnings={diagnose.warnings}
                missingAnnotations={diagnose.missingAnnotations}
              />
            </Box>
          </Box>
        )}

        {!error && tab === 1 && (
          <Box mt={2}>
            <AiUsageMetrics
              from={resolvedRange.from}
              to={resolvedRange.to}
              segment={segment}
            />
          </Box>
        )}
      </Content>
    </Page>
  );
}
