import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';

import { SettingsService } from '../services/settings.service';

/** Domovská obrazovka: kým používateľ neprejde úvodným sprievodcom, presmeruj naň. */
export const requireOnboarded: CanMatchFn = async () => {
  const settings = inject(SettingsService);
  const router = inject(Router);
  await settings.ready;
  return settings.settings().onboarded ? true : router.parseUrl('/onboarding');
};

/** Onboarding preskočí, ak už bol dokončený. */
export const skipIfOnboarded: CanMatchFn = async () => {
  const settings = inject(SettingsService);
  const router = inject(Router);
  await settings.ready;
  return settings.settings().onboarded ? router.parseUrl('/') : true;
};
