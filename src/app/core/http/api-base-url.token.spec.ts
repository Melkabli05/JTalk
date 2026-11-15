import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { API_BASE_URL } from './api-base-url.token';

describe('API_BASE_URL', () => {
  it('defaults to the configured environment URL', () => {
    expect(TestBed.inject(API_BASE_URL)).toBe(environment.apiUrl);
  });

  it('can be overridden', () => {
    TestBed.configureTestingModule({ providers: [{ provide: API_BASE_URL, useValue: '/v2' }] });
    expect(TestBed.inject(API_BASE_URL)).toBe('/v2');
  });
});
