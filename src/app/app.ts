import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Button } from '@openng/optimus-ui/button';

@Component({
  imports: [RouterOutlet, Button],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('infnet-angular-entrega');
}
