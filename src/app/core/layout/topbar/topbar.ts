import { DOCUMENT } from '@angular/common';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { AuthService } from '../../auth/auth.service';
import { Button } from '@openng/optimus-ui/button';
import { Avatar } from '@openng/optimus-ui/avatar';

@Component({
  imports: [Button, Avatar],
  selector: 'app-topbar',
  styleUrl: './topbar.scss',
  templateUrl: './topbar.html',
})
export class Topbar {
  private readonly authService = inject(AuthService);
  private readonly document = inject(DOCUMENT);

  readonly mobileMenuOpen = input<boolean>(false);
  readonly toggleMobileMenu = output<void>();

  protected readonly currentUser = this.authService.currentUser;
  protected readonly isDarkMode = signal(
    this.document.documentElement.classList.contains('app-dark'),
  );

  protected readonly userInitial = computed(() => {
    const name = this.currentUser()?.fullName?.trim();
    return name ? name.charAt(0).toUpperCase() : 'U';
  });

  protected toggleTheme(): void {
    const nextDark = !this.isDarkMode();
    this.isDarkMode.set(nextDark);
    this.document.documentElement.classList.toggle('app-dark', nextDark);
  }
}
