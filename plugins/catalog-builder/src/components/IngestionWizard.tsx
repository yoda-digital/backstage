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

import { useCallback, useEffect, useState } from 'react';
import { useAsync } from 'react-use';
import { Button, Step, StepLabel, Stepper } from '@material-ui/core';
import {
  Content,
  ContentHeader,
  Header,
  Page,
} from '@backstage/core-components';
import { errorApiRef, useApi } from '@backstage/core-plugin-api';
import { catalogBuilderApiRef } from '../api/ref';
import { OrganizationInfo, ProviderInfo, WizardState } from '../types';
import { ProviderStep } from './steps/ProviderStep';
import { ModeStep } from './steps/ModeStep';
import { OrgStep } from './steps/OrgStep';
import { RepoStep } from './steps/RepoStep';
import { DetailsStep } from './steps/DetailsStep';
import { ReviewStep } from './steps/ReviewStep';

const STEPS = [
  'Provider',
  'Mode',
  'Organization',
  'Repositories',
  'Details',
  'Review & Ingest',
] as const;

const JOB_POLL_INTERVAL_MS = 2000;

function initialState(): WizardState {
  return {
    repositories: [],
    selectedRepositoryIds: [],
    details: {},
  };
}

/**
 * A multi-step wizard for bulk repository ingestion into the catalog.
 *
 * @public
 */
export function IngestionWizard(): JSX.Element {
  const api = useApi(catalogBuilderApiRef);
  const errorApi = useApi(errorApiRef);

  const [activeStep, setActiveStep] = useState(0);
  const [state, setState] = useState<WizardState>(initialState);
  const [starting, setStarting] = useState(false);

  function patch(update: Partial<WizardState>): void {
    setState(prev => ({ ...prev, ...update }));
  }

  const { value: providers = [], loading: loadingProviders } = useAsync(
    () => api.listProviders(),
    [api],
  );

  const { value: organizations = [], loading: loadingOrganizations } =
    useAsync(async () => {
      if (!state.provider) {
        return [] as OrganizationInfo[];
      }
      return api.listOrganizations(state.provider.id);
    }, [api, state.provider]);

  const { value: repositories, loading: loadingRepositories } =
    useAsync(async () => {
      if (!state.provider || !state.organization) {
        return undefined;
      }
      return api.listRepositories(state.provider.id, state.organization.id);
    }, [api, state.provider, state.organization]);

  useEffect(() => {
    if (repositories) {
      patch({ repositories, selectedRepositoryIds: [] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repositories]);

  const pollJob = useCallback(
    (jobId: string) => {
      const interval = setInterval(async () => {
        try {
          const job = await api.getJob(jobId);
          patch({ job });
          if (job.status === 'completed' || job.status === 'failed') {
            clearInterval(interval);
          }
        } catch (error) {
          errorApi.post(error as Error);
          clearInterval(interval);
        }
      }, JOB_POLL_INTERVAL_MS);
      return interval;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api, errorApi],
  );

  async function handleStartIngestion(): Promise<void> {
    if (!state.provider || !state.organization || !state.mode) {
      return;
    }
    setStarting(true);
    try {
      const selected = state.repositories.filter(repository =>
        state.selectedRepositoryIds.includes(repository.id),
      );
      const job = await api.ingest({
        provider: state.provider.id,
        organization: state.organization.id,
        mode: state.mode,
        repositories: selected,
        details: state.details,
      });
      patch({ job });
      pollJob(job.id);
    } catch (error) {
      errorApi.post(error as Error);
    } finally {
      setStarting(false);
    }
  }

  function canAdvance(): boolean {
    switch (activeStep) {
      case 0:
        return Boolean(state.provider);
      case 1:
        return Boolean(state.mode);
      case 2:
        return Boolean(state.organization);
      case 3:
        return state.selectedRepositoryIds.length > 0;
      default:
        return true;
    }
  }

  function renderStep(): JSX.Element {
    switch (activeStep) {
      case 0:
        return (
          <ProviderStep
            providers={providers}
            loading={loadingProviders}
            selectedProviderId={state.provider?.id}
            onSelect={(provider: ProviderInfo) =>
              patch({ provider, organization: undefined })
            }
          />
        );
      case 1:
        return (
          <ModeStep mode={state.mode} onSelect={mode => patch({ mode })} />
        );
      case 2:
        return (
          <OrgStep
            organizations={organizations}
            loading={loadingOrganizations}
            selectedOrganizationId={state.organization?.id}
            onSelect={organization => patch({ organization })}
          />
        );
      case 3:
        return (
          <RepoStep
            repositories={state.repositories}
            loading={loadingRepositories}
            selectedIds={state.selectedRepositoryIds}
            onChangeSelected={selectedRepositoryIds =>
              patch({ selectedRepositoryIds })
            }
          />
        );
      case 4:
        return (
          <DetailsStep
            details={state.details}
            onChange={details => patch({ details })}
          />
        );
      case 5:
      default:
        return (
          <ReviewStep
            state={state}
            starting={starting}
            onStart={handleStartIngestion}
          />
        );
    }
  }

  return (
    <Page themeId="tool">
      <Header
        title="Catalog Builder"
        subtitle="Bulk-import repositories into the catalog"
      />
      <Content>
        <ContentHeader title="Ingestion Wizard" />
        <Stepper activeStep={activeStep} alternativeLabel>
          {STEPS.map(label => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
        <div style={{ margin: '24px 0' }}>{renderStep()}</div>
        <div>
          <Button
            disabled={activeStep === 0}
            onClick={() => setActiveStep(step => step - 1)}
          >
            Back
          </Button>
          {activeStep < STEPS.length - 1 && (
            <Button
              variant="contained"
              color="primary"
              disabled={!canAdvance()}
              onClick={() => setActiveStep(step => step + 1)}
            >
              Next
            </Button>
          )}
        </div>
      </Content>
    </Page>
  );
}
