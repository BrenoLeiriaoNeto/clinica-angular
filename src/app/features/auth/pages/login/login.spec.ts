import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { appConfig } from '../../../../app.config';
import { Observable, of, throwError } from 'rxjs';
import { Login } from './login';
import { UserProfile } from '../../../../core/models/auth.model';

describe('Login', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;
  let router: Router;

  const authServiceMock = {
    login: vi.fn((_email: string, _password: string): Observable<UserProfile> =>
      throwError(() => new Error('Invalid credentials'))),
    homeRouteByRole: vi.fn((): string => '/dashboard'),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [...appConfig.providers, { provide: AuthService, useValue: authServiceMock }],
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    authServiceMock.login.mockClear();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('associates the email validation message with the input and clears the invalid state when corrected', () => {
    const email = fixture.nativeElement.querySelector('#email') as HTMLInputElement;
    email.value = 'invalid-email';
    email.dispatchEvent(new Event('input', { bubbles: true }));
    email.dispatchEvent(new Event('blur'));
    fixture.detectChanges();

    expect(email.getAttribute('aria-invalid')).toBe('true');
    expect(email.getAttribute('aria-describedby')).toBe('email-error');
    expect(fixture.nativeElement.querySelector('#email-error')).toBeTruthy();

    email.value = 'user@example.com';
    email.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();

    expect(email.hasAttribute('aria-invalid')).toBe(false);
    expect(email.hasAttribute('aria-describedby')).toBe(false);
    expect(fixture.nativeElement.querySelector('#email-error')).toBeNull();
  });

  it('passes password validation attributes to the actual input and removes them when corrected', () => {
    const password = fixture.nativeElement.querySelector('#password') as HTMLInputElement;
    password.value = 'short';
    password.dispatchEvent(new Event('input', { bubbles: true }));
    password.dispatchEvent(new Event('blur'));
    fixture.detectChanges();

    expect(password.getAttribute('aria-invalid')).toBe('true');
    expect(password.getAttribute('aria-describedby')).toBe('password-error');
    expect(fixture.nativeElement.querySelector('#password-error')).toBeTruthy();

    password.value = 'long-enough-password';
    password.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();

    expect(password.hasAttribute('aria-invalid')).toBe(false);
    expect(password.hasAttribute('aria-describedby')).toBe(false);
    expect(fixture.nativeElement.querySelector('#password-error')).toBeNull();
  });

  it('announces an authentication failure to assistive technology', async () => {
    const email = fixture.nativeElement.querySelector('#email') as HTMLInputElement;
    const password = fixture.nativeElement.querySelector('#password') as HTMLInputElement;
    email.value = 'user@example.com';
    email.dispatchEvent(new Event('input', { bubbles: true }));
    password.value = 'long-enough-password';
    password.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();

    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement;
    expect(alert.getAttribute('aria-live')).toBe('assertive');
    expect(alert.textContent).toContain('Credenciais inválidas ou falha de conexão com o servidor');
  });

  it('fills credentials from demo chip and navigates to role home route on successful login', async () => {
    authServiceMock.login.mockReturnValueOnce(
      of({
        id: '22222222-2222-2222-2222-222222222222',
        email: 'medico@medicore.com',
        fullName: 'Dr. Henrique Vasconcelos',
        role: 'MEDICO',
      }),
    );

    const demoChips = fixture.nativeElement.querySelectorAll(
      '.demo-chip',
    ) as NodeListOf<HTMLButtonElement>;
    demoChips[1]?.click(); // Médico
    fixture.detectChanges();

    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(authServiceMock.login).toHaveBeenCalledWith('medico@medicore.com', 'Clinica@2026');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/dashboard');
  });

});
