import { TestBed } from '@angular/core/testing';
import { DirectionService } from './direction.service';

describe('DirectionService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.dir = 'ltr';
  });

  it('starts in the direction of the language (right to left for the default Arabic), and puts it on <html>', () => {
    const service = TestBed.inject(DirectionService);
    TestBed.tick();

    expect(service.direction()).toBe('rtl');
    expect(service.isRtl()).toBe(true);
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('starts left to right when the saved language is English', () => {
    localStorage.setItem('jtalk:locale', 'en');
    expect(TestBed.inject(DirectionService).direction()).toBe('ltr');
  });

  it('switches the whole page and remembers the choice', () => {
    const service = TestBed.inject(DirectionService);

    service.toggle();
    TestBed.tick();
    expect(service.isRtl()).toBe(false);
    expect(document.documentElement.dir).toBe('ltr');
    expect(localStorage.getItem('jtalk:direction')).toBe('ltr');

    service.toggle();
    TestBed.tick();
    expect(document.documentElement.dir).toBe('rtl');
    expect(localStorage.getItem('jtalk:direction')).toBe('rtl');
  });

  it('restores a saved direction, and ignores junk', () => {
    localStorage.setItem('jtalk:direction', 'ltr');
    expect(TestBed.inject(DirectionService).direction()).toBe('ltr');

    TestBed.resetTestingModule();
    localStorage.setItem('jtalk:direction', 'sideways');
    expect(TestBed.inject(DirectionService).direction()).toBe('rtl');
  });

  it('can be set directly', () => {
    const service = TestBed.inject(DirectionService);
    service.set('ltr');
    TestBed.tick();
    expect(document.documentElement.dir).toBe('ltr');
  });
});
