import { Component, signal } from '@angular/core';
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
  protected readonly isMobileSidebarOpen = signal(false);

  protected toggleMobileSidebar(): void {
    this.isMobileSidebarOpen.update((isOpen) => !isOpen);
  }

  protected closeMobileSidebar(): void {
    this.isMobileSidebarOpen.set(false);
  }
}
