import { Component, computed, ElementRef, inject, input, output } from '@angular/core';
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
  private readonly hostRef = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly mobileMenuOpen = input<boolean>(false);
  readonly toggleMobileMenu = output<void>();

  protected readonly currentUser = this.authService.currentUser;
  protected readonly isDarkMode = this.themeService.isDark;
  protected readonly breadcrumbs = this.breadcrumbService.items;

  protected readonly userInitial = computed(() => {
    const name = this.currentUser()?.fullName?.trim();
    return name ? name.charAt(0).toUpperCase() : 'U';
  });

  protected toggleTheme(event?: MouseEvent): void {
    const origin = this.resolveThemeOrigin(event);
    if (origin) {
      this.themeService.toggleTheme(origin);
    } else {
      this.themeService.toggleTheme();
    }
  }

  private resolveThemeOrigin(event?: MouseEvent): { x: number; y: number } | undefined {
    if (!event) return undefined;

    if (event.clientX > 0 || event.clientY > 0) {
      return { x: event.clientX, y: event.clientY };
    }

    const target = event.currentTarget as HTMLElement | null;
    if (target) {
      const rect = target.getBoundingClientRect();
      if (rect.width > 0 || rect.height > 0) {
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      }
    }

    return undefined;
  }

  focusMenuTrigger(): void {
    this.hostRef.nativeElement
      .querySelector<HTMLButtonElement>('.button.topbar__menu-btn, .topbar_menu-btn button')
      ?.focus();
  }
}
