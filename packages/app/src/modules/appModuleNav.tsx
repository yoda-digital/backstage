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
import HomeIcon from '@material-ui/icons/Home';
import CategoryIcon from '@material-ui/icons/Category';
import AddCircleOutlineIcon from '@material-ui/icons/AddCircleOutline';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import SecurityIcon from '@material-ui/icons/Security';
import AssessmentIcon from '@material-ui/icons/Assessment';
import ListAltIcon from '@material-ui/icons/ListAlt';
import CloudIcon from '@material-ui/icons/Cloud';
import ChatIcon from '@material-ui/icons/Chat';
import ExtensionIcon from '@material-ui/icons/Extension';
import TimelineIcon from '@material-ui/icons/Timeline';
import TrendingUpIcon from '@material-ui/icons/TrendingUp';
import TransformIcon from '@material-ui/icons/Transform';
import EditIcon from '@material-ui/icons/Edit';
import StorageIcon from '@material-ui/icons/Storage';
import FlagIcon from '@material-ui/icons/Flag';
import PeopleIcon from '@material-ui/icons/People';
import DashboardIcon from '@material-ui/icons/Dashboard';
import PublishIcon from '@material-ui/icons/Publish';
import LayersIcon from '@material-ui/icons/Layers';
import BuildIcon from '@material-ui/icons/Build';
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
    textTransform: 'uppercase',
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
                  {/* Core */}
                  <SidebarItem icon={HomeIcon} to="/" text="Home" />
                  <SidebarItem icon={CategoryIcon} to="/catalog" text="Catalog" />
                  <SidebarItem icon={AddCircleOutlineIcon} to="/create" text="Create" />

                  <SidebarDivider />
                  <SectionLabel>Quality</SectionLabel>
                  <SidebarItem icon={CheckCircleIcon} to="/soundcheck" text="Soundcheck" />

                  <SectionLabel>Governance</SectionLabel>
                  <SidebarItem icon={SecurityIcon} to="/rbac" text="RBAC" />
                  <SidebarItem icon={LayersIcon} to="/entity-overlays" text="Entity Overlays" />
                  <SidebarItem icon={AssessmentIcon} to="/audit-log" text="Audit Log" />

                  <SectionLabel>AI</SectionLabel>
                  <SidebarItem icon={CloudIcon} to="/ai-gateway" text="AI Gateway" />
                  <SidebarItem icon={ChatIcon} to="/ai-assistant" text="AI Assistant" />
                  <SidebarItem icon={ExtensionIcon} to="/ai-explorer" text="AI Explorer" />

                  <SectionLabel>Intelligence</SectionLabel>
                  <SidebarItem icon={TimelineIcon} to="/devex-metrics" text="DevEx Metrics" />
                  <SidebarItem icon={TrendingUpIcon} to="/insights" text="Insights" />
                  <SidebarItem icon={TransformIcon} to="/fleetshift" text="Fleetshift" />
                  <SidebarItem icon={EditIcon} to="/template-editor" text="Template Editor" />

                  <SectionLabel>Ecosystem</SectionLabel>
                  <SidebarItem icon={StorageIcon} to="/data-experience" text="Data Experience" />
                  <SidebarItem icon={FlagIcon} to="/growthbook" text="Feature Flags" />
                  <SidebarItem icon={PeopleIcon} to="/skill-exchange" text="Skill Exchange" />
                  <SidebarItem icon={DashboardIcon} to="/home-customizer" text="Home Customizer" />
                  <SidebarItem icon={PublishIcon} to="/catalog-builder" text="Catalog Builder" />

                  <SidebarDivider />
                  <SidebarItem icon={BuildIcon} to="/devtools" text="DevTools" />

                  {/* Any remaining nav items from plugins */}
                  {nav.rest({ sortBy: 'title' })}
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
                <SidebarItem icon={ListAltIcon} to="/settings" text="Settings" />
              </SidebarGroup>
            </Sidebar>
          );
        },
      },
    }),
  ],
});
