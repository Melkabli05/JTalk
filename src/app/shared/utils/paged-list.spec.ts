import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { type Page, pagedList } from './paged-list';

interface Item {
  readonly id: string;
}

@Component({ template: '' })
class HostComponent {
  readonly calls: (number | null)[] = [];
  readonly answers: Subject<Page<Item, number>>[] = [];
  readonly list = pagedList<Item, number>((cursor) => {
    this.calls.push(cursor);
    const answer = new Subject<Page<Item, number>>();
    this.answers.push(answer);
    return answer;
  });
}

describe('pagedList', () => {
  function setup() {
    return TestBed.createComponent(HostComponent).componentInstance;
  }
  const page = (ids: string[], next: number | null): Page<Item, number> => ({
    items: ids.map((id) => ({ id })),
    next,
  });

  it('reads the first page once, however often it is asked', () => {
    const host = setup();

    host.list.load();
    host.list.load();
    expect(host.calls).toEqual([null]);
    expect(host.list.loading()).toBe(true);

    host.answers[0].next(page(['a', 'b'], 1));
    expect(host.list.items().map((i) => i.id)).toEqual(['a', 'b']);
    expect(host.list.loading()).toBe(false);
    expect(host.list.loaded()).toBe(true);

    host.list.load();
    expect(host.calls).toEqual([null]);
  });

  it('adds the next page after the last one, and stops when there is none', () => {
    const host = setup();
    host.list.load();
    host.answers[0].next(page(['a', 'b'], 1));
    expect(host.list.hasMore()).toBe(true);

    host.list.more();
    expect(host.calls).toEqual([null, 1]);
    host.answers[1].next(page(['b', 'c'], null));

    expect(host.list.items().map((i) => i.id)).toEqual(['a', 'b', 'c']);
    expect(host.list.hasMore()).toBe(false);
    host.list.more();
    expect(host.calls).toHaveLength(2);
  });

  it('does not ask for another page while one is coming', () => {
    const host = setup();
    host.list.load();
    host.answers[0].next(page(['a'], 1));

    host.list.more();
    host.list.more();

    expect(host.calls).toEqual([null, 1]);
  });

  it('says it failed, keeps what it has, and tries again on reload', () => {
    const host = setup();
    host.list.load();
    host.answers[0].next(page(['a'], 1));
    host.list.more();

    host.answers[1].error(new Error('down'));
    expect(host.list.failed()).toBe(true);
    expect(host.list.loading()).toBe(false);
    expect(host.list.items().map((i) => i.id)).toEqual(['a']);

    host.list.reload();
    expect(host.list.failed()).toBe(false);
    host.answers[2].next(page(['z'], null));
    expect(host.list.items().map((i) => i.id)).toEqual(['z']);
  });

  it('takes someone out without asking again', () => {
    const host = setup();
    host.list.load();
    host.answers[0].next(page(['a', 'b'], null));

    host.list.remove('a');

    expect(host.list.items().map((i) => i.id)).toEqual(['b']);
    expect(host.calls).toHaveLength(1);
  });
});
