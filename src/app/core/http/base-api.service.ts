import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Service()
export class BaseApiService {
  private readonly http = inject(HttpClient);
  private readonly restBaseUrl = `${environment.supabaseUrl}/rest/v1`;

  get<T>(table: string, queryParams?: Record<string, string>): Observable<T> {
    return this.http.get<T>(`${this.restBaseUrl}/${table}`, {
      params: this.buildParams(queryParams),
    });
  }

  post<T>(table: string, body: unknown, queryParams?: Record<string, string>): Observable<T> {
    return this.http.post<T>(`${this.restBaseUrl}/${table}`, body, {
      params: this.buildParams(queryParams),
      headers: { Prefer: 'return=representation' },
    });
  }

  postOne<T>(
    table: string,
    body: unknown,
    errorMessage = 'Nenhum registro retornado ao criar recurso.',
    queryParams?: Record<string, string>,
  ): Observable<T> {
    return this.post<T[]>(table, body, queryParams).pipe(
      map((items) => this.extractFirst(items, errorMessage)),
    );
  }

  patch<T>(table: string, body: unknown, queryParams: Record<string, string>): Observable<T> {
    return this.http.patch<T>(`${this.restBaseUrl}/${table}`, body, {
      params: this.buildParams(queryParams),
      headers: { Prefer: 'return=representation' },
    });
  }

  patchOne<T>(
    table: string,
    body: unknown,
    queryParams: Record<string, string>,
    errorMessage = 'Nenhum registro encontrado para atualização.',
  ): Observable<T> {
    return this.patch<T[]>(table, body, queryParams).pipe(
      map((items) => this.extractFirst(items, errorMessage)),
    );
  }

  rpc<T>(fnName: string, params: Record<string, unknown>): Observable<T> {
    return this.http.post<T>(`${this.restBaseUrl}/rpc/${fnName}`, params);
  }

  private extractFirst<T>(items: T[], errorMessage: string): T {
    const first = items[0];
    if (!first) {
      throw new Error(errorMessage);
    }
    return first;
  }

  private buildParams(queryParams?: Record<string, string>): HttpParams {
    let params = new HttpParams();
    if (!queryParams) return params;

    for (const [key, value] of Object.entries(queryParams)) {
      params = params.set(key, value);
    }
    return params;
  }
}
