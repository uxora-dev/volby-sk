import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/elections/elections-list.page').then((m) => m.ElectionsListPage),
  },
  {
    path: 'election/:id',
    loadComponent: () =>
      import('./features/elections/election-detail.page').then((m) => m.ElectionDetailPage),
  },
  {
    path: 'settings',
    loadComponent: () => import('./features/settings/settings.page').then((m) => m.SettingsPage),
  },
];
