import { createFrontendPlugin } from '@backstage/frontend-plugin-api';

export const pagesPlugin = createFrontendPlugin({
  pluginId: 'example-pages',
  extensions: [],
});
