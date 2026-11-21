import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { BreadcrumbService } from './breadcrumb.service';

@Component({ selector: 'app-dummy', template: '' })
class DummyPage {}

describe('BreadcrumbService', () => {
  let service: BreadcrumbService;
  let router: Router;

  const authServiceMock = {
    homeRouteByRole: signal('/dashboard').asReadonly(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: 'estoque',
            data: { title: 'Controle de Estoque' },
            component: DummyPage,
          },
          {
            path: 'auditoria-estoque',
            data: { title: 'Auditoria de Movimentações' },
            component: DummyPage,
          },
        ]),
        { provide: AuthService, useValue: authServiceMock },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    service = TestBed.inject(BreadcrumbService);
  });

  it('builds breadcrumb trail from active route title and user home route', async () => {
    await router.navigateByUrl('/estoque');

    expect(service.items()).toEqual([
      { label: 'Início', route: '/dashboard', isLast: false },
      { label: 'Controle de Estoque', route: '/estoque', isLast: true },
    ]);
  });

  it('updates breadcrumbs reactively on subsequent navigation', async () => {
    await router.navigateByUrl('/auditoria-estoque');

    expect(service.items()).toEqual([
      { label: 'Início', route: '/dashboard', isLast: false },
      { label: 'Auditoria de Movimentações', route: '/auditoria-estoque', isLast: true },
    ]);
  });
});
