import { Component, computed, input } from '@angular/core';
import { Tag } from '@openng/optimus-ui/tag';
import { getStatusSeverity, StatusLabelPipe } from '../../pipes/status-label.pipe';

@Component({
  selector: 'app-status-badge',
  imports: [Tag, StatusLabelPipe],
  template: `
    <p-tag [value]="status() | statusLabel" [severity]="severity()" />
  `
})
export class StatusBadge {
  readonly status = input.required<string>();
  protected readonly severity = computed(() =>
    getStatusSeverity(this.status()));
}
