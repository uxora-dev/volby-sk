import { bootstrapApplication } from '@angular/platform-browser';
import { addIcons } from 'ionicons';
import {
  business, person, helpCircle, globeOutline, map, home,
  calendarOutline, chevronForward, chevronDown, chevronUp, openOutline,
  notifications, notificationsOutline, informationCircleOutline, documentTextOutline,
  settingsOutline, closeCircle, close, checkmarkCircle, arrowForward,
  newspaperOutline, lockClosedOutline,
} from 'ionicons/icons';

import { App } from './app/app';
import { appConfig } from './app/app.config';

// Standalone Ionic nenačítava ikony automaticky — zaregistrujeme všetky použité (jeden zdroj).
addIcons({
  business, person, 'help-circle': helpCircle, 'globe-outline': globeOutline, map, home,
  'calendar-outline': calendarOutline, 'chevron-forward': chevronForward,
  'chevron-down': chevronDown, 'chevron-up': chevronUp, 'open-outline': openOutline,
  notifications, 'notifications-outline': notificationsOutline,
  'information-circle-outline': informationCircleOutline, 'document-text-outline': documentTextOutline,
  'settings-outline': settingsOutline, 'close-circle': closeCircle, close,
  'checkmark-circle': checkmarkCircle, 'arrow-forward': arrowForward,
  'newspaper-outline': newspaperOutline, 'lock-closed-outline': lockClosedOutline,
});

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
