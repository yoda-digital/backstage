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

import { useCallback, useState } from 'react';
import useAsync from 'react-use/esm/useAsync';
import Button from '@material-ui/core/Button';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import Chip from '@material-ui/core/Chip';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Grid from '@material-ui/core/Grid';
import MenuItem from '@material-ui/core/MenuItem';
import Switch from '@material-ui/core/Switch';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import DeleteIcon from '@material-ui/icons/Delete';
import IconButton from '@material-ui/core/IconButton';
import { useApi } from '@backstage/core-plugin-api';
import {
  Content,
  Header,
  Page,
  Progress,
  ResponseErrorPanel,
} from '@backstage/core-components';
import { SkillProfile } from '@backstage/plugin-skill-exchange-common';
import { skillExchangeApiRef } from '../api/ref';

type SkillLevel = SkillProfile['skills'][number]['level'];

const skillLevels: SkillLevel[] = ['beginner', 'intermediate', 'expert'];

/**
 * A page for editing the current user's skill profile: skills with
 * proficiency levels, interests, and availability.
 *
 * @public
 */
export function ProfileEditor(): JSX.Element {
  const skillExchangeApi = useApi(skillExchangeApiRef);
  const [profile, setProfile] = useState<SkillProfile>();
  const [newSkill, setNewSkill] = useState('');
  const [newSkillLevel, setNewSkillLevel] = useState<SkillLevel>('beginner');
  const [newInterest, setNewInterest] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<Error>();

  const {
    value: loadedProfile,
    loading,
    error,
  } = useAsync(async () => skillExchangeApi.getProfile(), [skillExchangeApi]);

  const current = profile ?? loadedProfile;

  const save = useCallback(
    async (updates: Partial<SkillProfile>) => {
      if (!current) {
        return;
      }
      const next = { ...current, ...updates };
      setProfile(next);
      setSaving(true);
      setSaveError(undefined);
      try {
        await skillExchangeApi.updateProfile(updates);
      } catch (e) {
        setSaveError(e as Error);
      } finally {
        setSaving(false);
      }
    },
    [current, skillExchangeApi],
  );

  const handleAddSkill = () => {
    if (!current || !newSkill.trim()) {
      return;
    }
    const skills = [
      ...current.skills,
      { name: newSkill.trim(), level: newSkillLevel },
    ];
    save({ skills });
    setNewSkill('');
  };

  const handleRemoveSkill = (name: string) => {
    if (!current) {
      return;
    }
    save({ skills: current.skills.filter(s => s.name !== name) });
  };

  const handleAddInterest = () => {
    if (!current || !newInterest.trim()) {
      return;
    }
    save({ interests: [...current.interests, newInterest.trim()] });
    setNewInterest('');
  };

  const handleRemoveInterest = (interest: string) => {
    if (!current) {
      return;
    }
    save({ interests: current.interests.filter(i => i !== interest) });
  };

  const handleAvailabilityChange = (available: boolean) => {
    save({ availability: available ? 'full' : 'none' });
  };

  if (error) {
    return (
      <Page themeId="tool">
        <Header title="Skill Profile" />
        <Content>
          <ResponseErrorPanel error={error} />
        </Content>
      </Page>
    );
  }

  if (loading || !current) {
    return (
      <Page themeId="tool">
        <Header title="Skill Profile" />
        <Content>
          <Progress />
        </Content>
      </Page>
    );
  }

  return (
    <Page themeId="tool">
      <Header
        title="Skill Profile"
        subtitle="Manage your skills and availability"
      />
      <Content>
        {saveError && <ResponseErrorPanel error={saveError} />}
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6">Skills</Typography>
                {current.skills.map(skill => (
                  <div
                    key={skill.name}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginTop: 8,
                    }}
                  >
                    <Chip label={`${skill.name} · ${skill.level}`} />
                    <IconButton
                      size="small"
                      onClick={() => handleRemoveSkill(skill.name)}
                      aria-label={`Remove ${skill.name}`}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </div>
                ))}
                <Grid container spacing={1} style={{ marginTop: 16 }}>
                  <Grid item xs={6}>
                    <TextField
                      label="Skill"
                      value={newSkill}
                      onChange={e => setNewSkill(e.target.value)}
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={4}>
                    <TextField
                      select
                      label="Level"
                      value={newSkillLevel}
                      onChange={e =>
                        setNewSkillLevel(e.target.value as SkillLevel)
                      }
                      fullWidth
                    >
                      {skillLevels.map(level => (
                        <MenuItem key={level} value={level}>
                          {level}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid item xs={2}>
                    <Button
                      onClick={handleAddSkill}
                      disabled={saving || !newSkill.trim()}
                    >
                      Add
                    </Button>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6">Interests</Typography>
                {current.interests.map(interest => (
                  <Chip
                    key={interest}
                    label={interest}
                    onDelete={() => handleRemoveInterest(interest)}
                    style={{ marginRight: 8, marginTop: 8 }}
                  />
                ))}
                <Grid container spacing={1} style={{ marginTop: 16 }}>
                  <Grid item xs={9}>
                    <TextField
                      label="Interest"
                      value={newInterest}
                      onChange={e => setNewInterest(e.target.value)}
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={3}>
                    <Button
                      onClick={handleAddInterest}
                      disabled={saving || !newInterest.trim()}
                    >
                      Add
                    </Button>
                  </Grid>
                </Grid>

                <FormControlLabel
                  style={{ marginTop: 24 }}
                  control={
                    <Switch
                      checked={current.availability !== 'none'}
                      onChange={e => handleAvailabilityChange(e.target.checked)}
                    />
                  }
                  label={
                    current.availability === 'none'
                      ? 'Unavailable'
                      : `Available (${current.availability})`
                  }
                />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
}
