import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PageHeader } from './page-header';

describe('PageHeader', () => {
  let component: PageHeader;
  let fixture: ComponentFixture<PageHeader>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PageHeader],
    }).compileComponents();

    fixture = TestBed.createComponent(PageHeader);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('title', 'Controle de Estoque');
    fixture.detectChanges();
  });

  it('should create and render the required title', () => {
    expect(component).toBeTruthy();

    const heading = fixture.nativeElement.querySelector('h1') as HTMLElement;
    expect(heading.textContent?.trim()).toBe('Controle de Estoque');
  });

  it('renders subtitle when provided', () => {
    fixture.componentRef.setInput('subtitle', 'Monitoramento de medicamentos e alertas');
    fixture.detectChanges();

    const subtitle = fixture.nativeElement.querySelector('.page-header__subtitle') as HTMLElement;
    expect(subtitle.textContent?.trim()).toBe('Monitoramento de medicamentos e alertas');
  });
});
