import { Routes } from '@angular/router';

export const estoqueRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/estoque-list/estoque-list').then((m) => m.EstoqueListPage),
  },
  {
    path: ':id',
    data: {
      breadcrumb: 'Detalhes do Medicamento',
      title: 'Detalhes do Medicamento',
    },
    loadComponent: () =>
      import('./pages/medicamento-detail/medicamento-detail').then(
        (m) => m.MedicamentoDetailPage
      ),
  },
];
