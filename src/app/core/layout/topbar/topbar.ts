import { Component, computed, inject, input, output } from '@angular/core';
import { AuthService } from '../../auth/auth.service';
import { Button } from '@openng/optimus-ui/button';
import { Avatar } from '@openng/optimus-ui/avatar';
import { ThemeService } from '../../theme/theme.service';
import { BreadcrumbService } from '../breadcrumb/breadcrumb.service';
import { RouterLink } from '@angular/router';

@Component({
  imports: [Button, Avatar, RouterLink],
  selector: 'app-topbar',
  styleUrl: './topbar.scss',
  templateUrl: './topbar.html',
})
export class Topbar {
  private readonly authService = inject(AuthService);
  private readonly themeService = inject(ThemeService);
  private readonly breadcrumbService = inject(BreadcrumbService);

  readonly mobileMenuOpen = input<boolean>(false);
  readonly toggleMobileMenu = output<void>();

  protected readonly currentUser = this.authService.currentUser;
  protected readonly isDarkMode = this.themeService.isDark;
  protected readonly breadcrumbs = this.breadcrumbService.items;

  protected readonly userInitial = computed(() => {
    const name = this.currentUser()?.fullName?.trim();
    return name ? name.charAt(0).toUpperCase() : 'U';
  });

  protected toggleTheme(): void {
    this.themeService.toggleTheme();
  }
}
