import { TestBed } from '@angular/core/testing';
import { DirectionService } from './direction.service';

describe('DirectionService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.dir = 'ltr';
  });

  it('starts in the direction of the language (left to right for the default English), and puts it on <html>', () => {
    const service = TestBed.inject(DirectionService);
    TestBed.tick();

    expect(service.direction()).toBe('ltr');
    expect(service.isRtl()).toBe(false);
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('starts right to left when the saved language is Arabic', () => {
    localStorage.setItem('jtalk:locale', 'ar');
    const service = TestBed.inject(DirectionService);
    TestBed.tick();

    expect(service.direction()).toBe('rtl');
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('switches the whole page and remembers the choice', () => {
    const service = TestBed.inject(DirectionService);

    service.toggle();
    TestBed.tick();
    expect(service.isRtl()).toBe(true);
    expect(document.documentElement.dir).toBe('rtl');
    expect(localStorage.getItem('jtalk:direction')).toBe('rtl');

    service.toggle();
    TestBed.tick();
    expect(document.documentElement.dir).toBe('ltr');
    expect(localStorage.getItem('jtalk:direction')).toBe('ltr');
  });

  it('restores a saved direction, and ignores junk', () => {
    localStorage.setItem('jtalk:direction', 'rtl');
    expect(TestBed.inject(DirectionService).direction()).toBe('rtl');

    TestBed.resetTestingModule();
    localStorage.setItem('jtalk:direction', 'sideways');
    expect(TestBed.inject(DirectionService).direction()).toBe('ltr');
  });

  it('can be set directly', () => {
    const service = TestBed.inject(DirectionService);
    service.set('rtl');
    TestBed.tick();
    expect(document.documentElement.dir).toBe('rtl');
  });
});
