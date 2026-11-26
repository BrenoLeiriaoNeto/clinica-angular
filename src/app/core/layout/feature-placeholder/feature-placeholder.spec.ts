import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { AuthService } from '../../auth/auth.service';
import { UserRole } from '../../models/auth.model';
import { FeaturePlaceholder } from './feature-placeholder';

describe('FeaturePlaceholder', () => {
  let fixture: ComponentFixture<FeaturePlaceholder>;
  let routeData$: BehaviorSubject<Record<string, unknown>>;
  const currentRole = signal<UserRole | null>('MEDICO');

  beforeEach(async () => {
    routeData$ = new BehaviorSubject<Record<string, unknown>>({
      title: 'Agenda Médica',
      description: 'Gestão de consultas e turnos.',
    });
    currentRole.set('MEDICO');

    await TestBed.configureTestingModule({
      imports: [FeaturePlaceholder],
      providers: [
        { provide: ActivatedRoute, useValue: { data: routeData$.asObservable() } },
        { provide: AuthService, useValue: { currentRole: currentRole.asReadonly() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FeaturePlaceholder);
    fixture.detectChanges();
  });

  it('renders route title, description, and authenticated role badge', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('Módulo Autorizado • MEDICO');
    expect(text).toContain('Agenda Médica');
    expect(text).toContain('Gestão de consultas e turnos.');
  });

  it('falls back to default texts when route data omits title and description', () => {
    routeData$.next({});
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('Módulo em Desenvolvimento');
    expect(text).toContain('Rota protegida e validada por authGuard e roleGuard.');
  });
});
