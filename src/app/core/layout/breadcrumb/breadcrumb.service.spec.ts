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
            data: { breadcrumb: 'Estoque', title: 'Controle de Estoque' },
            children: [
              { path: '', component: DummyPage },
              {
                path: ':id',
                data: { breadcrumb: 'Detalhes do Medicamento' },
                component: DummyPage,
              },
            ],
          },
          {
            path: 'auditoria-estoque',
            data: { title: 'Auditoria de Movimentações' },
            component: DummyPage,
          },
          {
            path: 'duplicado',
            data: { breadcrumb: 'Mesmo' },
            children: [
              {
                path: 'filho',
                data: { breadcrumb: 'Mesmo' },
                component: DummyPage,
              },
            ],
          },
        ]),
        { provide: AuthService, useValue: authServiceMock },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    service = TestBed.inject(BreadcrumbService);
  });

  it('builds breadcrumb trail preferring data.breadcrumb over data.title', async () => {
    await router.navigateByUrl('/estoque');

    expect(service.items()).toEqual([
      { label: 'Início', route: '/dashboard', isLast: false },
      { label: 'Estoque', route: '/estoque', isLast: true },
    ]);
  });

  it('builds nested multi-level breadcrumb trails for child routes', async () => {
    await router.navigateByUrl('/estoque/med-1');

    expect(service.items()).toEqual([
      { label: 'Início', route: '/dashboard', isLast: false },
      { label: 'Estoque', route: '/estoque', isLast: false },
      { label: 'Detalhes do Medicamento', route: '/estoque/med-1', isLast: true },
    ]);
  });

  it('updates breadcrumbs reactively on subsequent navigation', async () => {
    await router.navigateByUrl('/auditoria-estoque');

    expect(service.items()).toEqual([
      { label: 'Início', route: '/dashboard', isLast: false },
      { label: 'Auditoria de Movimentações', route: '/auditoria-estoque', isLast: true },
    ]);
  });

  it('deduplicates consecutive breadcrumb labels across nested routes', async () => {
    await router.navigateByUrl('/duplicado/filho');

    expect(service.items()).toEqual([
      { label: 'Início', route: '/dashboard', isLast: false },
      { label: 'Mesmo', route: '/duplicado', isLast: true },
    ]);
  });
});
