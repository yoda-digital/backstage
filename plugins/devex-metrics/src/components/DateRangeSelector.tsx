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

import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Select, SelectedItems, SelectItem } from '@backstage/core-components';
import { MetricTimeRange } from '@backstage/plugin-devex-metrics-common';

/**
 * A rolling window measured in months, ending at the current ISO week.
 *
 * @public
 */
export type RollingMonths = 1 | 3 | 6;

/**
 * A fixed calendar period: one of the four quarters or two halves of a year.
 *
 * @public
 */
export type FixedPeriod = 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'H1' | 'H2';

/**
 * The value controlled by {@link DateRangeSelector}.
 *
 * @public
 */
export type DateRangeValue =
  | { readonly type: 'rolling'; readonly months: RollingMonths }
  | {
      readonly type: 'fixed';
      readonly period: FixedPeriod;
      readonly year: number;
    };

/**
 * A resolved, ISO-week-aligned `[from, to]` range.
 *
 * @public
 */
export interface ResolvedDateRange {
  readonly from: string;
  readonly to: string;
}

/**
 * The default date range shown when no selection has been made.
 *
 * @public
 */
export const DEFAULT_DATE_RANGE: DateRangeValue = {
  type: 'rolling',
  months: 3,
};

const FIXED_PERIODS: FixedPeriod[] = ['Q1', 'Q2', 'Q3', 'Q4', 'H1', 'H2'];
const ROLLING_MONTHS: RollingMonths[] = [1, 3, 6];
const RANGE_PARAM = 'range';

function startOfIsoWeek(date: Date): Date {
  const utc = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const daysSinceMonday = (utc.getUTCDay() + 6) % 7;
  utc.setUTCDate(utc.getUTCDate() - daysSinceMonday);
  return utc;
}

function endOfIsoWeek(date: Date): Date {
  const end = startOfIsoWeek(date);
  end.setUTCDate(end.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);
  return end;
}

function monthRangeForPeriod(period: FixedPeriod): [number, number] {
  switch (period) {
    case 'Q1':
      return [0, 3];
    case 'Q2':
      return [3, 6];
    case 'Q3':
      return [6, 9];
    case 'Q4':
      return [9, 12];
    case 'H1':
      return [0, 6];
    case 'H2':
    default:
      return [6, 12];
  }
}

/**
 * Resolves a {@link DateRangeValue} into a concrete `[from, to]` range,
 * snapped to ISO week boundaries (Monday start, Sunday end).
 *
 * @public
 */
export function resolveDateRange(
  value: DateRangeValue,
  now: Date = new Date(),
): ResolvedDateRange {
  if (value.type === 'rolling') {
    const to = endOfIsoWeek(now);
    const fromRaw = new Date(now);
    fromRaw.setMonth(fromRaw.getMonth() - value.months);
    const from = startOfIsoWeek(fromRaw);
    return { from: from.toISOString(), to: to.toISOString() };
  }

  const [startMonth, endMonthExclusive] = monthRangeForPeriod(value.period);
  const fromRaw = new Date(Date.UTC(value.year, startMonth, 1));
  const toRaw = new Date(Date.UTC(value.year, endMonthExclusive, 0));
  return {
    from: startOfIsoWeek(fromRaw).toISOString(),
    to: endOfIsoWeek(toRaw).toISOString(),
  };
}

/**
 * Resolves the period of equal length immediately preceding the given
 * range, for period-over-period overlay comparisons.
 *
 * @public
 */
export function previousDateRange(
  value: DateRangeValue,
  now: Date = new Date(),
): ResolvedDateRange {
  const current = resolveDateRange(value, now);
  const fromMs = new Date(current.from).getTime();
  const toMs = new Date(current.to).getTime();
  const durationMs = toMs - fromMs;
  const prevTo = new Date(fromMs - 1);
  const prevFrom = new Date(prevTo.getTime() - durationMs);
  return { from: prevFrom.toISOString(), to: prevTo.toISOString() };
}

/**
 * Picks a sensible query granularity for a resolved date range.
 *
 * @public
 */
export function granularityForDateRange(
  value: DateRangeValue,
): MetricTimeRange['granularity'] {
  if (value.type === 'rolling') {
    return value.months <= 1 ? 'day' : 'week';
  }
  return value.period.startsWith('H') ? 'month' : 'week';
}

/**
 * Encodes a {@link DateRangeValue} for storage in a URL query parameter.
 *
 * @public
 */
export function formatDateRangeParam(value: DateRangeValue): string {
  return value.type === 'rolling'
    ? `rolling:${value.months}`
    : `fixed:${value.period}:${value.year}`;
}

/**
 * Decodes a {@link DateRangeValue} from a URL query parameter, falling back
 * to {@link DEFAULT_DATE_RANGE} if the parameter is missing or invalid.
 *
 * @public
 */
export function parseDateRangeParam(
  param: string | null | undefined,
  now: Date = new Date(),
): DateRangeValue {
  if (!param) {
    return DEFAULT_DATE_RANGE;
  }
  const [type, a, b] = param.split(':');
  if (type === 'rolling') {
    const months = Number(a) as RollingMonths;
    if (ROLLING_MONTHS.includes(months)) {
      return { type: 'rolling', months };
    }
  }
  if (type === 'fixed' && FIXED_PERIODS.includes(a as FixedPeriod)) {
    const year = Number(b) || now.getFullYear();
    return { type: 'fixed', period: a as FixedPeriod, year };
  }
  return DEFAULT_DATE_RANGE;
}

function buildItems(year: number): SelectItem[] {
  return [
    { label: 'Last 1 month', value: 'rolling:1' },
    { label: 'Last 3 months', value: 'rolling:3' },
    { label: 'Last 6 months', value: 'rolling:6' },
    { label: 'Q1 (this year)', value: `fixed:Q1:${year}` },
    { label: 'Q2 (this year)', value: `fixed:Q2:${year}` },
    { label: 'Q3 (this year)', value: `fixed:Q3:${year}` },
    { label: 'Q4 (this year)', value: `fixed:Q4:${year}` },
    { label: 'H1 (this year)', value: `fixed:H1:${year}` },
    { label: 'H2 (this year)', value: `fixed:H2:${year}` },
  ];
}

/**
 * Props for {@link DateRangeSelector}.
 *
 * @public
 */
export interface DateRangeSelectorProps {
  readonly value: DateRangeValue;
  readonly onChange: (value: DateRangeValue) => void;
}

/**
 * A control for choosing a rolling (1/3/6 month) or fixed (quarter/half
 * year) date range, aligned to ISO weeks. The selection is mirrored to the
 * `range` URL query parameter so dashboards using it are shareable.
 *
 * @public
 */
export function DateRangeSelector(props: DateRangeSelectorProps): JSX.Element {
  const { value, onChange } = props;
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const fromUrl = searchParams.get(RANGE_PARAM);
    if (fromUrl && fromUrl !== formatDateRangeParam(value)) {
      onChange(parseDateRangeParam(fromUrl));
    }
    // Only seed from the URL once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleChange(selected: SelectedItems): void {
    const raw = String(Array.isArray(selected) ? selected[0] : selected);
    onChange(parseDateRangeParam(raw));
    const next = new URLSearchParams(searchParams);
    next.set(RANGE_PARAM, raw);
    setSearchParams(next, { replace: true });
  }

  const items = useMemo(() => buildItems(new Date().getFullYear()), []);

  return (
    <Select
      label="Date range"
      items={items}
      selected={formatDateRangeParam(value)}
      onChange={handleChange}
    />
  );
}
