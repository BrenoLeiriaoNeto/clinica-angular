import { computed, inject, Service } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, startWith } from 'rxjs';

export interface BreadcrumbItem {
  label: string;
  route: string;
  isLast: boolean;
}

@Service()
export class BreadcrumbService {
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);

  private readonly navigationTick = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      startWith(null),
    ),
    { initialValue: null},
  );

  readonly items = computed<BreadcrumbItem[]>(() => {
    this.navigationTick();
    const homeRoute = this.authService.homeRouteByRole();
    const trail = this.collectRouteBreadcrumbs(this.activatedRoute.root);

    const rawItems: Array<{ label: string; route: string }> = [
      { label: 'Início', route: homeRoute },
      ...trail,
    ];

    return rawItems.map((item, index) => ({
      ...item,
      isLast: index === rawItems.length - 1,
    }));
  });

  private collectRouteBreadcrumbs(
    route: ActivatedRoute,
    accumulatedUrl = '',
    items: Array<{ label: string; route: string }> = [],
  ): Array<{ label: string; route: string }> {
    const child = route.firstChild;
    if (!child) {
      return items;
    }

    const segmentPath = child.snapshot.url.map((segment) =>
      segment.path).join('/');
    const nextUrl = segmentPath ?
      `${accumulatedUrl}/${segmentPath}` :
      accumulatedUrl;

    const label =
      (child.snapshot.data['breadcrumb'] as string | undefined) ??
      (child.snapshot.data['title'] as string | undefined);

    if (label && items[items.length - 1]?.label !== label) {
      items.push({
        label,
        route: nextUrl || '/',
      });
    }

    return this.collectRouteBreadcrumbs(child, nextUrl, items);
  }
}
