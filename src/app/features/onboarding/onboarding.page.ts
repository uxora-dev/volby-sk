import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonContent, IonButton, IonIcon } from '@ionic/angular/standalone';

import { SettingsService } from '../../core/services/settings.service';
import { NotificationsService } from '../../core/services/notifications.service';

interface Step {
  icon: string;
  title: string;
  text: string;
  accent: string; // CSS premenná farby (adaptívna v dark)
}

@Component({
  selector: 'app-onboarding',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IonContent, IonButton, IonIcon],
  templateUrl: './onboarding.page.html',
  styleUrl: './onboarding.page.scss',
})
export class OnboardingPage {
  private readonly settings = inject(SettingsService);
  private readonly notifications = inject(NotificationsService);
  private readonly router = inject(Router);

  protected readonly steps: Step[] = [
    {
      icon: 'ballot-outline',
      title: 'Všetky voľby na jednom mieste',
      text: 'Parlamentné, prezidentské, referendá, eurovoľby, župné aj komunálne — s termínmi, históriou a výsledkami od vzniku Slovenska.',
      accent: 'var(--type-parliamentary)',
    },
    {
      icon: 'lock-closed-outline',
      title: 'Vaše súkromie je základ',
      text: 'Žiadne prihlásenie, žiadna poloha. Kraj a obec si vyberáte ručne a ostávajú len vo Vašom zariadení. Nezbierame osobné údaje.',
      accent: 'var(--type-european)',
    },
    {
      icon: 'notifications-outline',
      title: 'Nezmeškajte žiadne voľby',
      text: 'Zapnite si upozornenia na termíny volieb, ktoré Vás zaujímajú. Kedykoľvek ich vypnete alebo doladíte v nastaveniach.',
      accent: 'var(--type-referendum)',
    },
  ];

  protected readonly index = signal(0);
  protected readonly step = computed(() => this.steps[this.index()]);
  protected readonly isLast = computed(() => this.index() === this.steps.length - 1);
  protected readonly isNotifStep = computed(() => this.index() === 2);
  protected readonly notifAsked = signal(false);

  protected next(): void {
    if (this.isLast()) this.finish();
    else this.index.update((i) => i + 1);
  }

  protected back(): void {
    this.index.update((i) => Math.max(0, i - 1));
  }

  protected async enableNotifications(): Promise<void> {
    this.notifAsked.set(true);
    await this.notifications.enable(); // vyžiada systémové povolenie (na natíve)
  }

  protected skip(): void {
    this.finish();
  }

  private finish(): void {
    this.settings.patch({ onboarded: true });
    void this.router.navigateByUrl('/');
  }
}
