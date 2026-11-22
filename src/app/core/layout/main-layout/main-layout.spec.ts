import { ComponentFixture, TestBed } from '@angular/core/testing';
import { appConfig } from '../../../app.config';
import { MainLayout } from './main-layout';

describe('MainLayout', () => {
  let component: MainLayout;
  let fixture: ComponentFixture<MainLayout>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MainLayout],
      providers: [...appConfig.providers],
    }).compileComponents();

    fixture = TestBed.createComponent(MainLayout);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('toggles mobile drawer, sets background inert, and closes on Escape', () => {
    const menuBtn = fixture.nativeElement.querySelector(
      'button.topbar__menu-btn, .topbar__menu-btn button',
    ) as HTMLButtonElement;
    const shellBody = fixture.nativeElement.querySelector('.app-shell__body') as HTMLElement;

    expect(shellBody.inert).toBe(false);

    menuBtn.click();
    fixture.detectChanges();

    expect(shellBody.inert).toBe(true);
    expect(fixture.nativeElement.querySelector('.app-shell__backdrop')).toBeTruthy();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(shellBody.inert).toBe(false);
    expect(fixture.nativeElement.querySelector('.app-shell__backdrop')).toBeNull();
  });
});
