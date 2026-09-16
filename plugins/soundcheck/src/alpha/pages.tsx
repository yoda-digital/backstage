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

import { PageBlueprint } from '@backstage/frontend-plugin-api';

/** @alpha */
export const soundcheckPage = PageBlueprint.make({
  params: {
    path: '/soundcheck',
    title: 'Soundcheck',
    loader: () =>
      import('../components/SoundcheckPage').then(m => <m.SoundcheckPage />),
  },
});

/** @alpha */
export const soundcheckCheckInsightsPage = PageBlueprint.make({
  name: 'check-insights',
  params: {
    path: '/soundcheck/checks/:id/insights',
    title: 'Check insights',
    loader: () =>
      import('../components/Insights/CheckInsights').then(m => (
        <m.CheckInsights />
      )),
  },
});

/** @alpha */
export const soundcheckTrackInsightsPage = PageBlueprint.make({
  name: 'track-insights',
  params: {
    path: '/soundcheck/tracks/:id/insights',
    title: 'Track insights',
    loader: () =>
      import('../components/Insights/TrackInsights').then(m => (
        <m.TrackInsights />
      )),
  },
});

/** @alpha */
export const soundcheckCampaignInsightsPage = PageBlueprint.make({
  name: 'campaign-insights',
  params: {
    path: '/soundcheck/campaigns/:id/insights',
    title: 'Campaign insights',
    loader: () =>
      import('../components/Insights/CampaignInsights').then(m => (
        <m.CampaignInsights />
      )),
  },
});
