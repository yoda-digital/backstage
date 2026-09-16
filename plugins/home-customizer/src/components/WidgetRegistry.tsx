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

import { ComponentType, lazy } from 'react';

/**
 * The category a {@link HomeWidget} belongs to, used to group widgets in the
 * widget picker.
 *
 * @public
 */
export type HomeWidgetCategory = 'activity' | 'catalog' | 'metrics' | 'social';

/**
 * A widget that can be placed on the homepage layout grid.
 *
 * @public
 */
export interface HomeWidget {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly component: ComponentType;
  readonly defaultWidth: 1 | 2 | 3 | 4;
  readonly defaultHeight: 1 | 2;
  readonly category: HomeWidgetCategory;
}

/**
 * A single widget placement within a {@link HomeLayout}.
 *
 * @remarks
 *
 * Declared as a `type` rather than an `interface` so that it structurally
 * satisfies `JsonObject` when persisted through the storage API.
 *
 * @public
 */
export type HomeLayoutWidget = {
  widgetId: string;
  position: { row: number; col: number };
  width: number;
  height: number;
};

/**
 * The persisted homepage layout: an ordered set of widget placements plus
 * audit metadata about the last save.
 *
 * @remarks
 *
 * Declared as a `type` rather than an `interface` so that it structurally
 * satisfies `JsonObject` when persisted through the storage API.
 *
 * @public
 */
export type HomeLayout = {
  readonly widgets: HomeLayoutWidget[];
  readonly updatedAt: string;
  readonly updatedBy: string;
};

const builtinWidgets: HomeWidget[] = [
  {
    id: 'recently-visited',
    title: 'Recently Visited',
    description: 'Entities you recently viewed',
    component: lazy(() => import('../widgets/RecentlyVisited')),
    defaultWidth: 2,
    defaultHeight: 1,
    category: 'activity',
  },
  {
    id: 'owned-entities',
    title: 'Your Entities',
    description: 'Components and systems you own',
    component: lazy(() => import('../widgets/OwnedEntities')),
    defaultWidth: 2,
    defaultHeight: 1,
    category: 'catalog',
  },
  {
    id: 'starred',
    title: 'Starred',
    description: 'Your bookmarked entities',
    component: lazy(() => import('../widgets/Starred')),
    defaultWidth: 2,
    defaultHeight: 1,
    category: 'catalog',
  },
  {
    id: 'soundcheck-summary',
    title: 'Soundcheck Summary',
    description: 'Quality check overview for your entities',
    component: lazy(() => import('../widgets/SoundcheckSummary')),
    defaultWidth: 2,
    defaultHeight: 2,
    category: 'metrics',
  },
  {
    id: 'team-activity',
    title: 'Team Activity',
    description: 'Recent changes by your team',
    component: lazy(() => import('../widgets/TeamActivity')),
    defaultWidth: 2,
    defaultHeight: 1,
    category: 'social',
  },
];

/**
 * Returns the built-in set of widgets available to place on the homepage.
 *
 * @public
 */
export function getWidgetRegistry(): HomeWidget[] {
  return builtinWidgets;
}
