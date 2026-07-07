import { bootstrapApplication } from '@angular/platform-browser';
import { addIcons } from 'ionicons';
import {
  business, person, helpCircle, globeOutline, map, home,
  calendarOutline, chevronForward, openOutline, notificationsOutline,
  informationCircleOutline, documentTextOutline, settingsOutline,
} from 'ionicons/icons';

import { App } from './app/app';
import { appConfig } from './app/app.config';

// Standalone Ionic nenačítava ikony automaticky — zaregistrujeme použité.
addIcons({
  business, person, 'help-circle': helpCircle, 'globe-outline': globeOutline, map, home,
  'calendar-outline': calendarOutline, 'chevron-forward': chevronForward, 'open-outline': openOutline,
  'notifications-outline': notificationsOutline, 'information-circle-outline': informationCircleOutline,
  'document-text-outline': documentTextOutline, 'settings-outline': settingsOutline,
});

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
