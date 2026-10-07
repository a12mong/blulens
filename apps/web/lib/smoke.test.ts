describe('test tooling', () => {
  it('runs vitest with jsdom', () => {
    expect(document.createElement('div')).toBeInstanceOf(HTMLElement);
  });
});
