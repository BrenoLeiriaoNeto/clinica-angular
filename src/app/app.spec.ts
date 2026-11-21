import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { App } from './app';
import { appConfig } from './app.config';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: appConfig.providers,
    })
      .compileComponents();
  });

  it('redirects the root URL to the login page', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);

    fixture.detectChanges();
    await router.navigateByUrl('/');
    fixture.detectChanges();

    expect(router.url).toBe('/login');
    expect((fixture.nativeElement as HTMLElement).querySelector('app-login')).toBeTruthy();
  });

  it('renders the login page when navigating directly to /login', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);

    fixture.detectChanges();
    await router.navigateByUrl('/login');
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('app-login')).toBeTruthy();
  });
});
