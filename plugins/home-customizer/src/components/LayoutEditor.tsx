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

import { DragEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Button from '@material-ui/core/Button';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import Chip from '@material-ui/core/Chip';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Grid from '@material-ui/core/Grid';
import IconButton from '@material-ui/core/IconButton';
import Switch from '@material-ui/core/Switch';
import Typography from '@material-ui/core/Typography';
import AddIcon from '@material-ui/icons/Add';
import CloseIcon from '@material-ui/icons/Close';
import RemoveIcon from '@material-ui/icons/Remove';
import {
  identityApiRef,
  storageApiRef,
  useApi,
} from '@backstage/core-plugin-api';
import { InfoCard, Progress } from '@backstage/core-components';
import { useTranslationRef } from '@backstage/frontend-plugin-api';
import { homeCustomizerTranslationRef } from '../translation';
import {
  getWidgetRegistry,
  HomeLayout,
  HomeLayoutWidget,
} from './WidgetRegistry';

const GRID_COLUMNS = 4;
const STORAGE_BUCKET = 'home-customizer';
const ORG_DEFAULT_KEY = 'org-default-layout';
const PERSONAL_OVERRIDE_KEY = 'home-customizer:personal-layout';

/**
 * Packs the given widgets into a {@link GRID_COLUMNS}-wide grid, row by row,
 * assigning each a `position` based on its order and width.
 */
function packLayout(
  widgets: Array<{ widgetId: string; width: number; height: number }>,
): HomeLayoutWidget[] {
  let row = 0;
  let col = 0;
  const packed: HomeLayoutWidget[] = [];
  for (const widget of widgets) {
    if (col + widget.width > GRID_COLUMNS) {
      row += 1;
      col = 0;
    }
    packed.push({
      widgetId: widget.widgetId,
      width: widget.width,
      height: widget.height,
      position: { row, col },
    });
    col += widget.width;
  }
  return packed;
}

function readPersonalOverride(): HomeLayoutWidget[] | undefined {
  try {
    const raw = window.localStorage.getItem(PERSONAL_OVERRIDE_KEY);
    return raw ? (JSON.parse(raw) as HomeLayoutWidget[]) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * A drag-and-drop grid configurator for the homepage layout: available
 * widgets on the left, the current layout on the right. Saves the org
 * default via the storage API, and layers a personal override on top using
 * `localStorage`.
 *
 * @public
 */
export function LayoutEditor(): JSX.Element {
  const { t } = useTranslationRef(homeCustomizerTranslationRef);
  const storageApi = useApi(storageApiRef).forBucket(STORAGE_BUCKET);
  const identityApi = useApi(identityApiRef);
  const registry = useMemo(() => getWidgetRegistry(), []);

  const [placed, setPlaced] = useState<
    Array<{ widgetId: string; width: number; height: number }>
  >([]);
  const [usePersonal, setUsePersonal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dragIndex, setDragIndex] = useState<number>();
  const [dragOverIndex, setDragOverIndex] = useState<number>();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const snapshot = storageApi.snapshot<HomeLayout>(ORG_DEFAULT_KEY);
      const orgWidgets = snapshot.value?.widgets ?? [];
      const personal = readPersonalOverride();
      if (!cancelled) {
        if (personal) {
          setUsePersonal(true);
          setPlaced(personal.map(w => ({ ...w })));
        } else {
          setPlaced(orgWidgets.map(w => ({ ...w })));
        }
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const layout = useMemo(() => packLayout(placed), [placed]);

  const handleAdd = useCallback(
    (widgetId: string) => {
      const widget = registry.find(w => w.id === widgetId);
      if (!widget) {
        return;
      }
      setPlaced(prev => [
        ...prev,
        {
          widgetId,
          width: widget.defaultWidth,
          height: widget.defaultHeight,
        },
      ]);
    },
    [registry],
  );

  const handleRemove = useCallback((index: number) => {
    setPlaced(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleResize = useCallback(
    (index: number, dimension: 'width' | 'height', delta: number) => {
      setPlaced(prev =>
        prev.map((item, i) => {
          if (i !== index) {
            return item;
          }
          const max = dimension === 'width' ? GRID_COLUMNS : 2;
          const next = Math.min(max, Math.max(1, item[dimension] + delta));
          return { ...item, [dimension]: next };
        }),
      );
    },
    [],
  );

  const handleDragStart = (index: number) => (event: DragEvent) => {
    setDragIndex(index);
    event.dataTransfer.effectAllowed = 'move';
    // Firefox requires data to be set for the drag to initiate.
    event.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragEnter = (index: number) => (event: DragEvent) => {
    event.preventDefault();
    if (dragIndex !== undefined && dragIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragEnd = () => {
    setDragIndex(undefined);
    setDragOverIndex(undefined);
  };

  const handleDrop = (index: number) => (event: DragEvent) => {
    event.preventDefault();
    if (dragIndex === undefined || dragIndex === index) {
      handleDragEnd();
      return;
    }
    setPlaced(prev => {
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(index, 0, moved);
      return next;
    });
    handleDragEnd();
  };

  const handleSaveOrgDefault = useCallback(async () => {
    setSaving(true);
    try {
      const identity = await identityApi.getBackstageIdentity();
      await storageApi.set<HomeLayout>(ORG_DEFAULT_KEY, {
        widgets: layout,
        updatedAt: new Date().toISOString(),
        updatedBy: identity.userEntityRef,
      });
    } finally {
      setSaving(false);
    }
  }, [storageApi, identityApi, layout]);

  const handleTogglePersonal = useCallback(
    (checked: boolean) => {
      setUsePersonal(checked);
      if (checked) {
        window.localStorage.setItem(
          PERSONAL_OVERRIDE_KEY,
          JSON.stringify(layout),
        );
      } else {
        window.localStorage.removeItem(PERSONAL_OVERRIDE_KEY);
      }
    },
    [layout],
  );

  useEffect(() => {
    if (usePersonal && !loading) {
      window.localStorage.setItem(
        PERSONAL_OVERRIDE_KEY,
        JSON.stringify(layout),
      );
    }
  }, [usePersonal, layout, loading]);

  if (loading) {
    return <Progress />;
  }

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} md={4}>
        <InfoCard title={t('layoutEditor.availableWidgetsTitle')}>
          {registry.map(widget => (
            <Card
              key={widget.id}
              variant="outlined"
              style={{ marginBottom: 8, padding: 8 }}
            >
              <Grid
                container
                alignItems="center"
                justifyContent="space-between"
              >
                <Grid item xs={9}>
                  <Typography variant="subtitle2">{widget.title}</Typography>
                  <Typography variant="caption" color="textSecondary">
                    {widget.description}
                  </Typography>
                </Grid>
                <Grid item>
                  <IconButton
                    size="small"
                    aria-label={`Add ${widget.title}`}
                    onClick={() => handleAdd(widget.id)}
                  >
                    <AddIcon fontSize="small" />
                  </IconButton>
                </Grid>
              </Grid>
            </Card>
          ))}
        </InfoCard>
      </Grid>

      <Grid item xs={12} md={8}>
        <InfoCard
          title={t('layoutEditor.layoutTitle')}
          action={
            <FormControlLabel
              control={
                <Switch
                  checked={usePersonal}
                  onChange={e => handleTogglePersonal(e.target.checked)}
                />
              }
              label={t('layoutEditor.personalOverrideLabel')}
            />
          }
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${GRID_COLUMNS}, 1fr)`,
              gap: 8,
            }}
          >
            {placed.map((item, index) => {
              const widget = registry.find(w => w.id === item.widgetId);
              const position = layout[index]?.position ?? { row: 0, col: 0 };
              const isDragging = dragIndex === index;
              const isDropTarget =
                dragOverIndex === index && dragIndex !== index;
              return (
                <Card
                  key={`${item.widgetId}-${index}`}
                  draggable
                  onDragStart={handleDragStart(index)}
                  onDragEnter={handleDragEnter(index)}
                  onDragOver={e => e.preventDefault()}
                  onDragEnd={handleDragEnd}
                  onDrop={handleDrop(index)}
                  variant="outlined"
                  style={{
                    gridColumn: `${position.col + 1} / span ${item.width}`,
                    gridRow: `${position.row + 1} / span ${item.height}`,
                    cursor: 'grab',
                    opacity: isDragging ? 0.4 : 1,
                    outline: isDropTarget
                      ? '2px dashed #1976d2'
                      : '2px dashed transparent',
                    outlineOffset: -2,
                    transition: 'opacity 0.15s ease, outline-color 0.15s ease',
                  }}
                >
                  <CardContent>
                    <Grid
                      container
                      justifyContent="space-between"
                      alignItems="center"
                    >
                      <Grid item>
                        <Typography variant="subtitle2">
                          {widget?.title ?? item.widgetId}
                        </Typography>
                      </Grid>
                      <Grid item>
                        <IconButton
                          size="small"
                          aria-label={`Remove ${item.widgetId}`}
                          onClick={() => handleRemove(index)}
                        >
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </Grid>
                    </Grid>
                    <div style={{ marginTop: 8 }}>
                      <Chip
                        size="small"
                        label={`width ${item.width}`}
                        onDelete={() => handleResize(index, 'width', -1)}
                        deleteIcon={<RemoveIcon />}
                      />
                      <IconButton
                        size="small"
                        aria-label="Increase width"
                        onClick={() => handleResize(index, 'width', 1)}
                      >
                        <AddIcon fontSize="small" />
                      </IconButton>
                      <Chip
                        size="small"
                        label={`height ${item.height}`}
                        onDelete={() => handleResize(index, 'height', -1)}
                        deleteIcon={<RemoveIcon />}
                        style={{ marginLeft: 8 }}
                      />
                      <IconButton
                        size="small"
                        aria-label="Increase height"
                        onClick={() => handleResize(index, 'height', 1)}
                      >
                        <AddIcon fontSize="small" />
                      </IconButton>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {!usePersonal && (
            <Button
              variant="contained"
              color="primary"
              disabled={saving}
              onClick={handleSaveOrgDefault}
              style={{ marginTop: 16 }}
            >
              {saving
                ? t('layoutEditor.savingButton')
                : t('layoutEditor.saveOrgDefaultButton')}
            </Button>
          )}
        </InfoCard>
      </Grid>
    </Grid>
  );
}
