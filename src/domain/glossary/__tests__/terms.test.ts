import { GLOSSARY_TERMS, glossaryTerm, type GlossaryTermKey } from '../terms';

describe('glossary terms', () => {
  const keys = Object.keys(GLOSSARY_TERMS) as GlossaryTermKey[];

  it('has a non-empty label and definition for every term', () => {
    for (const key of keys) {
      const entry = GLOSSARY_TERMS[key];
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.definition.length).toBeGreaterThan(0);
    }
  });

  it('glossaryTerm looks up the same entry as the raw map', () => {
    for (const key of keys) {
      expect(glossaryTerm(key)).toBe(GLOSSARY_TERMS[key]);
    }
  });
});
