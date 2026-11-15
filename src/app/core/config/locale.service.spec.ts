import { TestBed } from '@angular/core/testing';
import { I18n } from '@shared/utils/i18n/i18n.service';
import { DirectionService } from './direction.service';
import { LocaleService } from './locale.service';

describe('LocaleService', () => {
  beforeEach(() => localStorage.clear());
  afterEach(async () => {
    await TestBed.inject(LocaleService).switchTo('en');
    localStorage.clear();
  });

  it('gives the page the reading direction of the language it switches to', async () => {
    const service = TestBed.inject(LocaleService);
    const direction = TestBed.inject(DirectionService);

    await service.switchTo('ar');
    expect(TestBed.inject(I18n).locale()).toBe('ar');
    expect(direction.isRtl()).toBe(true);

    await service.switchTo('en');
    expect(direction.isRtl()).toBe(false);
  });

  it('lets the reader flip the direction afterwards, whatever the language', async () => {
    const service = TestBed.inject(LocaleService);
    const direction = TestBed.inject(DirectionService);
    await service.switchTo('ar');

    direction.toggle();

    expect(direction.isRtl()).toBe(false);
    expect(service.locale()).toBe('ar');
  });
});
