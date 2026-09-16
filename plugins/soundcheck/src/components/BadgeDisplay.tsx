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

import { SoundcheckLevel } from '@backstage/plugin-soundcheck-common';
import Chip from '@material-ui/core/Chip';
import Tooltip from '@material-ui/core/Tooltip';

/** Default medal emoji shown for the first three certification ranks. */
const DEFAULT_RANK_EMOJI: Record<number, string> = {
  1: '🥉',
  2: '🥈',
  3: '🥇',
};

/** Generic fallback emoji for ranks beyond the default medal set. */
const DEFAULT_EMOJI = '🏅';

function defaultEmojiForRank(rank: number): string {
  return DEFAULT_RANK_EMOJI[rank] ?? DEFAULT_EMOJI;
}

/**
 * Props for {@link BadgeDisplay}.
 *
 * @public
 */
export interface BadgeDisplayProps {
  /** The certification level whose badge should be rendered. */
  level: Pick<SoundcheckLevel, 'name' | 'rank' | 'badge'>;
  /** Visual size of the badge. Defaults to `medium`. */
  size?: 'small' | 'medium';
}

/**
 * Renders the badge earned for a Soundcheck certification level: a custom
 * inline SVG when {@link SoundcheckLevel.badge} provides `svgContent`,
 * otherwise a styled chip showing an emoji (custom, or a default bronze/
 * silver/gold medal keyed off the level's rank) and the level's name.
 *
 * Custom SVG markup is rendered through an `<img>` data URI rather than
 * `dangerouslySetInnerHTML`, so it can never execute script content even if
 * a badge definition originates from an untrusted source.
 *
 * @public
 */
export function BadgeDisplay(props: BadgeDisplayProps) {
  const { level, size = 'medium' } = props;
  const badge = level.badge;
  const dimensionPx = size === 'small' ? 20 : 32;

  if (badge?.svgContent) {
    const src = `data:image/svg+xml;utf8,${encodeURIComponent(
      badge.svgContent,
    )}`;
    return (
      <Tooltip title={level.name}>
        <img
          src={src}
          alt={level.name}
          width={dimensionPx}
          height={dimensionPx}
        />
      </Tooltip>
    );
  }

  const emoji = badge?.emoji ?? defaultEmojiForRank(level.rank);
  return (
    <Chip
      size={size}
      variant={badge?.color ? 'default' : 'outlined'}
      label={`${emoji} ${level.name}`}
      style={
        badge?.color
          ? { backgroundColor: badge.color, color: '#fff' }
          : undefined
      }
    />
  );
}
