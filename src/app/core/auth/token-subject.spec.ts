import { tokenSubject } from './token-subject';

function token(claims: object): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${encode({ alg: 'HS256' })}.${encode(claims)}.signature`;
}

describe('tokenSubject', () => {
  it('reads the subject of a token', () => {
    expect(tokenSubject(token({ sub: '5c1b2f0e-4c1e-4a39-8c1a-0a6f3d9e7b11' }))).toBe(
      '5c1b2f0e-4c1e-4a39-8c1a-0a6f3d9e7b11',
    );
  });

  it.each([
    null,
    '',
    'not-a-token',
    'a.b.c',
    `x.${btoa('[1]')}.z`,
    token({ name: 'no subject' }),
    token({ sub: 7 }),
  ])('gives null for %j', (value) => {
    expect(tokenSubject(value)).toBeNull();
  });
});
