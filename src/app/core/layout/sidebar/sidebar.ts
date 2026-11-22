import { Component, computed, ElementRef, inject, input, output } from '@angular/core';
import { UserRole } from '../../models/auth.model';
import { AuthService } from '../../auth/auth.service';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Button } from '@openng/optimus-ui/button';
import { Tag } from '@openng/optimus-ui/tag';

export interface NavItem {
  label: string;
  route: string;
  icon: string;
  roles: UserRole[];
}

const ROLE_LABELS: Record<UserRole, string> = {
  RECEPCIONISTA: 'Recepção',
  MEDICO: 'Corpo Clínico',
  GERENTE_ESTOQUE: 'Gestão de Estoque',
  PACIENTE: 'Portal do Paciente',
};

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    route: '/dashboard',
    icon: 'pi pi-home',
    roles: ['RECEPCIONISTA', 'MEDICO'],
  },
  {
    label: 'Agenda Médica',
    route: '/agendamentos',
    icon: 'pi pi-calendar',
    roles: ['RECEPCIONISTA', 'MEDICO'],
  },
  {
    label: 'Pacientes',
    route: '/pacientes',
    icon: 'pi pi-users',
    roles: ['RECEPCIONISTA'],
  },
  {
    label: 'Receituários',
    route: '/receituarios',
    icon: 'pi pi-file-edit',
    roles: ['MEDICO'],
  },
  {
    label: 'Estoque',
    route: '/estoque',
    icon: 'pi pi-box',
    roles: ['GERENTE_ESTOQUE', 'MEDICO'],
  },
  {
    label: 'Pedidos de Compra',
    route: '/pedidos-estoque',
    icon: 'pi pi-shopping-cart',
    roles: ['GERENTE_ESTOQUE'],
  },
  {
    label: 'Auditoria de Estoque',
    route: '/auditoria-estoque',
    icon: 'pi pi-history',
    roles: ['GERENTE_ESTOQUE'],
  },
  {
    label: 'Meu Portal',
    route: '/portal',
    icon: 'pi pi-user',
    roles: ['PACIENTE'],
  },
  {
    label: 'Minhas Consultas',
    route: '/minhas-consultas',
    icon: 'pi pi-calendar-clock',
    roles: ['PACIENTE'],
  },
  {
    label: 'Meus Receituários',
    route: '/meus-receituarios',
    icon: 'pi pi-file-check',
    roles: ['PACIENTE'],
  },
];

@Component({
  imports: [RouterLink, Button, Tag, RouterLinkActive],
  selector: 'app-sidebar',
  styleUrl: './sidebar.scss',
  templateUrl: './sidebar.html',
})
export class Sidebar {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly hostRef = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly mobileOpen = input<boolean>(false);
  readonly closeMobile = output<void>();

  protected readonly currentUser = this.authService.currentUser;
  protected readonly homeRoute = this.authService.homeRouteByRole;

  protected readonly roleLabel = computed(() => {
    const role = this.authService.currentRole();
    return role ? ROLE_LABELS[role] : '';
  });

  protected readonly visibleNavItems = computed(() => {
    const role = this.authService.currentRole();
    if (!role) return [];

    return NAV_ITEMS.filter((item) => item.roles.includes(role));
  });

  protected onNavigate(): void {
    this.closeMobile.emit();
  }

  protected onLogout(): void {
    this.closeMobile.emit();
    this.authService.logout();
    this.router.navigateByUrl('/login');
  }

  focusDrawer(): void {
    const target = this.hostRef.nativeElement.querySelector<HTMLElement>(
      'button.sidebar__close-btn, .sidebar__close-btn, .sidebar__link',
    )?.focus();
  }
}
