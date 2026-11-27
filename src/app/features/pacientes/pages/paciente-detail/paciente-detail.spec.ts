import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MessageService } from '@openng/optimus-ui/api';
import { environment } from '../../../../../environments/environment';
import { Paciente } from '../../models/paciente.model';
import { PacienteDetailPage } from './paciente-detail';

describe('PacienteDetailPage (Integração)', () => {
  let fixture: ComponentFixture<PacienteDetailPage>;
  let httpMock: HttpTestingController;

  const mockLucas: Paciente = {
    id: 'pac-1',
    email: 'paciente@medicore.com',
    nome_completo: 'Lucas Mendes',
    role: 'PACIENTE',
    documento: '***.482.910-**',
    data_nascimento: '1994-05-18',
    telefone: '(11) 99123-4567',
    ativo: true,
    criado_em: '2026-11-20T10:00:00Z',
    atualizado_em: '2026-11-20T10:00:00Z',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PacienteDetailPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        MessageService,
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PacienteDetailPage);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('exibe dados cadastrais e histórico de agendamentos pelo input id', () => {
    fixture.componentRef.setInput('id', 'pac-1');
    fixture.detectChanges();

    httpMock
      .expectOne((r) => r.url === `${environment.supabaseUrl}/rest/v1/perfis`)
      .flush([mockLucas]);

    httpMock
      .expectOne(
        (r) =>
          r.url === `${environment.supabaseUrl}/rest/v1/agendamentos` &&
          r.params.get('paciente_id') === 'eq.pac-1',
      )
      .flush([
        {
          id: 'ag-1',
          paciente_id: 'pac-1',
          medico_id: 'med-1',
          data_hora_inicio: '2026-11-23T14:00:00Z',
          data_hora_fim: '2026-11-23T14:30:00Z',
          status: 'CONCLUIDO',
          observacoes: 'Retorno e avaliação de exames',
          medico: {
            id: 'med-1',
            nome_completo: 'Dr. Henrique Vasconcelos',
            especialidade: 'Clínica Geral / Cardiologia',
          },
        },
      ]);

    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Lucas Mendes');
    expect(text).toContain('18/05/1994');
    expect(text).toContain('Dr. Henrique Vasconcelos');
    expect(text).toContain('Retorno e avaliação de exames');
    expect(text).toContain('Concluído');
  });

  it('exibe alerta quando o paciente não é encontrado', () => {
    fixture.componentRef.setInput('id', 'id-inexistente');
    fixture.detectChanges();

    httpMock
      .expectOne((r) => r.url === `${environment.supabaseUrl}/rest/v1/perfis`)
      .flush([mockLucas]);

    httpMock
      .expectOne((r) => r.url === `${environment.supabaseUrl}/rest/v1/agendamentos`)
      .flush([]);

    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Paciente não encontrado');
  });
});
