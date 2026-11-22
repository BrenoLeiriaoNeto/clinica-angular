import { Component, signal, viewChild } from '@angular/core';
import { Sidebar } from '../sidebar/sidebar';
import { Topbar } from '../topbar/topbar';
import { RouterOutlet } from '@angular/router';

@Component({
  imports: [Sidebar, Topbar, RouterOutlet],
  selector: 'app-main-layout',
  styleUrl: './main-layout.scss',
  templateUrl: './main-layout.html',
  host: {
    '(document:keydown.escape)': 'closeMobileSidebar()',
  },
})
export class MainLayout {
  private readonly sidebar = viewChild(Sidebar);
  private readonly topbar = viewChild(Topbar);

  protected readonly isMobileSidebarOpen = signal(false);

  protected toggleMobileSidebar(): void {
    const nextState = !this.isMobileSidebarOpen();
    this.isMobileSidebarOpen.set(nextState);

    if (nextState) {
      queueMicrotask(() => this.sidebar()?.focusDrawer());
    } else {
      queueMicrotask(() => this.topbar()?.focusMenuTrigger());
    }
  }

  protected closeMobileSidebar(): void {
    if (!this.isMobileSidebarOpen()) return;
    this.isMobileSidebarOpen.set(false);
    queueMicrotask(() => this.topbar()?.focusMenuTrigger());
  }
}
