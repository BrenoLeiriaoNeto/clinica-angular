import { Component, computed, inject, signal } from '@angular/core';
import { UserRole } from '../../../../core/models/auth.model';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../../core/auth/auth.service';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { Message } from '@openng/optimus-ui/message';
import { InputText } from '@openng/optimus-ui/inputtext';
import { Password } from '@openng/optimus-ui/password';
import { Button } from '@openng/optimus-ui/button';
import { ThemeService } from '../../../../core/theme/theme.service';

interface DemoAccount {
  label: string;
  role: UserRole;
  email: string;
  icon: string;
}

@Component({
  imports: [Message, ReactiveFormsModule, InputText, Password, Button],
  selector: 'app-login',
  styleUrl: './login.scss',
  templateUrl: './login.html',
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly themeService = inject(ThemeService);

  protected readonly isDarkMode = this.themeService.isDark;
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly passwordErrorVisible = signal(false);
  protected readonly passwordInputPt = computed(() => {
    const invalid = this.passwordErrorVisible();

    return {
      pcInputText: {
        root: {
          'aria-describedby': invalid ? 'password-error' : null,
          'aria-invalid': invalid ? 'true' : null,
        },
      },
    };
  });

  protected readonly demoAccounts: DemoAccount[] = [
    {
      label: 'Recepcionista',
      role: 'RECEPCIONISTA',
      email: 'recepcao@medicore.com',
      icon: 'pi pi-id-card',
    },
    { label: 'Médico', role: 'MEDICO', email: 'medico@medicore.com', icon: 'pi pi-user-plus' },
    {
      label: 'Ger. Estoque',
      role: 'GERENTE_ESTOQUE',
      email: 'estoque@medicore.com',
      icon: 'pi pi-box',
    },
    { label: 'Paciente', role: 'PACIENTE', email: 'paciente@medicore.com', icon: 'pi pi-user' },
  ];

  protected readonly loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  protected fillCredentials(email: string): void {
    this.errorMessage.set(null);
    this.loginForm.patchValue({
      email,
      password: 'Clinica@2026',
    });
    this.updatePasswordError();
    this.loginForm.markAsDirty();
  }

  protected updatePasswordError(): void {
    const passwordControl = this.loginForm.controls.password;
    this.passwordErrorVisible.set(passwordControl.touched && passwordControl.invalid);
  }

  protected onPasswordBlur(): void {
    this.loginForm.controls.password.markAsTouched();
    this.updatePasswordError();
  }

  protected onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.updatePasswordError();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const { email, password } = this.loginForm.getRawValue();

    this.authService
      .login(email, password)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: () => {
          this.router.navigateByUrl(this.authService.homeRouteByRole());
        },
        error: () =>
          this.errorMessage.set('Credenciais inválidas ou falha de conexão com o servidor'),
      });
  }

  protected toggleTheme(): void {
    this.themeService.toggleTheme();
  }
}
