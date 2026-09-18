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

import {
  Sidebar,
  SidebarDivider,
  SidebarGroup,
  SidebarItem,
  SidebarScrollWrapper,
  SidebarSpace,
} from '@backstage/core-components';
import SearchIcon from '@material-ui/icons/Search';
import MenuIcon from '@material-ui/icons/Menu';
import { createFrontendModule } from '@backstage/frontend-plugin-api';
import { NavContentBlueprint } from '@backstage/plugin-app-react';
import { SidebarSearchModal } from '@backstage/plugin-search';
import { NotificationsSidebarItem } from '@backstage/plugin-notifications';
import { UserSettingsSignInAvatar } from '@backstage/plugin-user-settings';
import { makeStyles, Typography } from '@material-ui/core';

const useLogoStyles = makeStyles({
  root: {
    display: 'flex',
    alignItems: 'center',
    padding: '16px 24px',
    marginBottom: 4,
  },
  text: {
    color: '#7df3e1',
    fontWeight: 700,
    fontSize: 20,
    letterSpacing: 1,
  },
});

function SidebarLogo() {
  const classes = useLogoStyles();
  return (
    <div className={classes.root}>
      <Typography className={classes.text}>DevPane</Typography>
    </div>
  );
}

const useSectionStyles = makeStyles(theme => ({
  label: {
    color: theme.palette.text.secondary,
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: 1.2,
    padding: '12px 24px 4px',
  },
}));

function SectionLabel(props: { children: string }) {
  const classes = useSectionStyles();
  return <div className={classes.label}>{props.children}</div>;
}

export const appModuleNav = createFrontendModule({
  pluginId: 'app',
  extensions: [
    NavContentBlueprint.make({
      params: {
        component: ({ navItems }) => {
          const nav = navItems.withComponent(item => (
            <SidebarItem
              icon={() => item.icon}
              to={item.href}
              text={item.title}
            />
          ));

          // Consume search separately (handled by modal)
          nav.take('page:search');

          return (
            <Sidebar>
              <SidebarLogo />
              <SidebarGroup label="Search" icon={<SearchIcon />} to="/search">
                <SidebarSearchModal />
              </SidebarGroup>
              <SidebarDivider />
              <SidebarGroup label="Menu" icon={<MenuIcon />}>
                <SidebarScrollWrapper>
                  {/* Core — using nav.take to get REAL plugin routes */}
                  {nav.take('page:home')}
                  {nav.take('page:catalog')}
                  {nav.take('page:scaffolder')}

                  <SidebarDivider />
                  <SectionLabel>Quality</SectionLabel>
                  {nav.take('page:soundcheck')}

                  <SectionLabel>Governance</SectionLabel>
                  {nav.take('page:rbac')}
                  {nav.take('page:entity-overlays')}
                  {nav.take('page:audit-log')}

                  <SectionLabel>AI</SectionLabel>
                  {nav.take('page:ai-gateway')}
                  {nav.take('page:ai-assistant')}
                  {nav.take('page:ai-explorer')}

                  <SectionLabel>Intelligence</SectionLabel>
                  {nav.take('page:devex-metrics')}
                  {nav.take('page:insights')}
                  {nav.take('page:fleetshift')}
                  {nav.take('page:template-editor')}

                  <SectionLabel>Ecosystem</SectionLabel>
                  {nav.take('page:data-experience')}
                  {nav.take('page:growthbook')}
                  {nav.take('page:skill-exchange')}
                  {nav.take('page:home-customizer')}
                  {nav.take('page:catalog-builder')}

                  <SidebarDivider />
                  {nav.take('page:devtools')}
                  {nav.take('page:app-visualizer')}
                </SidebarScrollWrapper>
              </SidebarGroup>
              <SidebarDivider />
              <SidebarSpace />
              <SidebarDivider />
              <SidebarGroup
                label="Settings"
                icon={<UserSettingsSignInAvatar />}
                to="/settings"
              >
                <NotificationsSidebarItem />
                {nav.take('page:user-settings')}
              </SidebarGroup>
            </Sidebar>
          );
        },
      },
    }),
  ],
});
