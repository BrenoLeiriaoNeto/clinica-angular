import { Routes } from '@angular/router';

export const pacientesRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/pacientes-list/pacientes-list').then((m) => m.PacientesListPage),
  },
  {
    path: ':id',
    data: {
      breadcrumb: 'Ficha do Paciente',
      title: 'Ficha do Paciente',
    },
    loadComponent: () =>
      import('./pages/paciente-detail/paciente-detail').then((m) => m.PacienteDetailPage),
  },
];
