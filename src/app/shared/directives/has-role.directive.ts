import { Directive, effect, inject, input, TemplateRef, ViewContainerRef } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { UserRole } from '../../core/models/auth.model';


@Directive({
  selector: '[appHasRole]'
})
export class HasRoleDirective {
  private readonly templateRef = inject(TemplateRef<unknown>);
  private readonly viewContainer = inject(ViewContainerRef);
  private readonly authService = inject(AuthService);

  readonly appHasRole = input.required<UserRole | UserRole[]>();

  private hasView = false;

  constructor() {
    effect(() => {
      const allowed = this.appHasRole();
      const roles = Array.isArray(allowed) ? allowed : [allowed];
      const canRender = this.authService.hasAnyRole(roles);

      if (canRender && !this.hasView) {
        this.viewContainer.createEmbeddedView(this.templateRef);
        this.hasView = true;
      } else if (!canRender && this.hasView) {
        this.viewContainer.clear();
        this.hasView = false;
      }
    });
  }
}
