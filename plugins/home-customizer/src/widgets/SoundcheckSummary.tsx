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

import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import Typography from '@material-ui/core/Typography';

/**
 * Placeholder preview for the "Soundcheck Summary" homepage widget, shown
 * in the layout editor. The real widget content is supplied by the
 * Soundcheck plugin's summary extension at render time.
 */
export default function SoundcheckSummary(): JSX.Element {
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="subtitle2">Soundcheck Summary</Typography>
        <Typography variant="body2" color="textSecondary">
          A quality check overview for your entities will appear here.
        </Typography>
      </CardContent>
    </Card>
  );
}
