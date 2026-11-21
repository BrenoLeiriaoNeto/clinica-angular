import { Routes } from '@angular/router';
import { authGuard, guestGuard, roleGuard } from './core/auth/auth.guards';
import { MainLayout } from './core/layout/main-layout/main-layout';

const loadPlaceholder = () =>
  import('./core/layout/feature-placeholder/feature-placeholder').then((m) => m.FeaturePlaceholder);

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/pages/login/login').then((module) => module.Login),
  },
  {
    path: '',
    component: MainLayout,
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        canActivate: [roleGuard],
        data: {
          roles: ['RECEPCIONISTA', 'MEDICO'],
          title: 'Dashboard Clínico',
          description: 'Visão geral de atendimentos do dia, indicadores e status da agenda.',
        },
        loadComponent: loadPlaceholder,
      },
      {
        path: 'agendamentos',
        canActivate: [roleGuard],
        data: {
          roles: ['RECEPCIONISTA', 'MEDICO'],
          title: 'Agenda Médica',
          description: 'Gestão de consultas, confirmação de turnos e reagendamentos.',
        },
        loadComponent: loadPlaceholder,
      },
      {
        path: 'pacientes',
        canActivate: [roleGuard],
        data: {
          roles: ['RECEPCIONISTA'],
          title: 'Cadastro de Pacientes',
          description: 'Gerenciamento de perfis, documentos e histórico cadastral.',
        },
        loadComponent: loadPlaceholder,
      },
      {
        path: 'receituarios',
        canActivate: [roleGuard],
        data: {
          roles: ['MEDICO'],
          title: 'Consultas e Receituários',
          description: 'Emissão de prescrições digitais e análise de solicitações retroativas.',
        },
        loadComponent: loadPlaceholder,
      },
      {
        path: 'estoque',
        canActivate: [roleGuard],
        data: {
          roles: ['GERENTE_ESTOQUE', 'MEDICO'],
          title: 'Controle de Estoque',
          description: 'Monitoramento de medicamentos, alertas de reposição e solicitações.',
        },
        loadComponent: loadPlaceholder,
      },
      {
        path: 'pedidos-estoque',
        canActivate: [roleGuard],
        data: {
          roles: ['GERENTE_ESTOQUE'],
          title: 'Pedidos de Reestoque',
          description: 'Aprovação e recebimento de pedidos de compra de medicamentos.',
        },
        loadComponent: loadPlaceholder,
      },
      {
        path: 'auditoria-estoque',
        canActivate: [roleGuard],
        data: {
          roles: ['GERENTE_ESTOQUE'],
          title: 'Auditoria de Movimentações',
          description: 'Histórico imutável de entradas, saídas e ajustes de inventário.',
        },
        loadComponent: loadPlaceholder,
      },
      {
        path: 'portal',
        canActivate: [roleGuard],
        data: {
          roles: ['PACIENTE'],
          title: 'Portal do Paciente',
          description: 'Resumo de próximas consultas e receituários ativos.',
        },
        loadComponent: loadPlaceholder,
      },
      {
        path: 'minhas-consultas',
        canActivate: [roleGuard],
        data: {
          roles: ['PACIENTE'],
          title: 'Minhas Consultas',
          description: 'Acompanhamento de agendamentos e solicitação de reagendamento.',
        },
        loadComponent: loadPlaceholder,
      },
      {
        path: 'meus-receituarios',
        canActivate: [roleGuard],
        data: {
          roles: ['PACIENTE'],
          title: 'Meus Receituários',
          description: 'Visualização de receitas válidas e solicitação de re-emissão retroativa.',
        },
        loadComponent: loadPlaceholder,
      },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
