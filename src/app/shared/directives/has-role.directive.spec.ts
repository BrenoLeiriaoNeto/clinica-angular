import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthService } from '../../core/auth/auth.service';
import { UserRole } from '../../core/models/auth.model';
import { HasRoleDirective } from './has-role.directive';

@Component({
  selector: 'app-has-role-host',
  imports: [HasRoleDirective],
  template: `
    <span *appHasRole="'GERENTE_ESTOQUE'" class="gerente-only">Gerente</span>
    <span *appHasRole="['MEDICO', 'GERENTE_ESTOQUE']" class="clinico-ou-gerente">
      Médico ou Gerente
    </span>
  `,
})
class HasRoleHost {}

describe('HasRoleDirective', () => {
  let fixture: ComponentFixture<HasRoleHost>;
  const currentRole = signal<UserRole | null>(null);

  beforeEach(async () => {
    currentRole.set(null);

    await TestBed.configureTestingModule({
      imports: [HasRoleHost],
      providers: [
        {
          provide: AuthService,
          useValue: {
            hasAnyRole: (allowed: UserRole[]) => {
              const role = currentRole();
              return role !== null && allowed.includes(role);
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HasRoleHost);
  });

  it('hides restricted elements when unauthenticated or lacking role', () => {
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.gerente-only')).toBeNull();
    expect(el.querySelector('.clinico-ou-gerente')).toBeNull();

    currentRole.set('PACIENTE');
    fixture.detectChanges();

    expect(el.querySelector('.gerente-only')).toBeNull();
    expect(el.querySelector('.clinico-ou-gerente')).toBeNull();
  });

  it('renders and clears views reactively as user role changes without duplicating elements', () => {
    currentRole.set('MEDICO');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.gerente-only')).toBeNull();
    expect(el.querySelectorAll('.clinico-ou-gerente').length).toBe(1);

    currentRole.set('GERENTE_ESTOQUE');
    fixture.detectChanges();

    expect(el.querySelectorAll('.gerente-only').length).toBe(1);
    expect(el.querySelectorAll('.clinico-ou-gerente').length).toBe(1);

    currentRole.set(null);
    fixture.detectChanges();

    expect(el.querySelector('.gerente-only')).toBeNull();
    expect(el.querySelector('.clinico-ou-gerente')).toBeNull();
  });
});
