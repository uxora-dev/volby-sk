import { Routes } from '@angular/router';

import { requireOnboarded, skipIfOnboarded } from './core/guards/onboarding.guard';

export const routes: Routes = [
  {
    path: '',
    canMatch: [requireOnboarded],
    loadComponent: () =>
      import('./features/elections/elections-list.page').then((m) => m.ElectionsListPage),
  },
  {
    path: 'onboarding',
    canMatch: [skipIfOnboarded],
    loadComponent: () => import('./features/onboarding/onboarding.page').then((m) => m.OnboardingPage),
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
  {
    path: 'privacy',
    data: { doc: 'privacy' },
    loadComponent: () => import('./features/legal/legal.page').then((m) => m.LegalPage),
  },
  {
    path: 'terms',
    data: { doc: 'terms' },
    loadComponent: () => import('./features/legal/legal.page').then((m) => m.LegalPage),
  },
];
