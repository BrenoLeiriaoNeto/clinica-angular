import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { Card } from '@openng/optimus-ui/card';
import { Tag } from '@openng/optimus-ui/tag';
import { map } from 'rxjs';
import { AuthService } from '../../auth/auth.service';

@Component({
  selector: 'app-feature-placeholder',
  imports: [Card, Tag],
  template: `
    <p-card class="placeholder-card">
      <ng-template #header>
        <div class="placeholder-card__header">
          <p-tag [value]="'Módulo Autorizado • ' + role()" severity="info" />
        </div>
      </ng-template>

      <h1 class="placeholder-card__title">{{ routeData().title }}</h1>
      <p class="placeholder-card__description">{{ routeData().description }}</p>
    </p-card>
  `,
  styles: `
    :host ::ng-deep .placeholder-card {
      max-width: 720px;
    }

    .placeholder-card {
      &__header {
        padding: 1.25rem 1.25rem 0;
      }

      &__title {
        font-size: 1.35rem;
        margin: 0 0 0.5rem;
      }

      &__description {
        color: var(--p-text-muted-color, #475569);
        line-height: 1.5;
        margin: 0;
      }
    }
  `,
})
export class FeaturePlaceholder {
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);

  protected readonly role = this.authService.currentRole;

  protected readonly routeData = toSignal(
    this.route.data.pipe(
      map((data) => ({
        title: (data['title'] as string) ?? 'Módulo em Desenvolvimento',
        description:
          (data['description'] as string) ?? 'Rota protegida e validada por authGuard e roleGuard.',
      })),
    ),
    {
      initialValue: {
        title: 'Módulo em Desenvolvimento',
        description: 'Rota protegida e validada por authGuard e roleGuard.',
      },
    },
  );
}
