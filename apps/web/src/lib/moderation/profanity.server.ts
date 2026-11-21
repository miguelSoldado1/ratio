import { DataSet, englishDataset, englishRecommendedTransformers, RegExpMatcher } from "obscenity";

const slurWords = new Set([
  "abeed",
  "abo",
  "africoon",
  "arabush",
  "boonga",
  "chingchong",
  "chink",
  "dyke",
  "fag",
  "kike",
  "nigger",
  "retard",
  "spastic",
  "tranny",
]);

const profanityMatcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

const slurMatcher = new RegExpMatcher({
  ...new DataSet<{ originalWord: string }>()
    .addAll(englishDataset)
    .removePhrasesIf((phrase) => !slurWords.has(phrase.metadata?.originalWord ?? ""))
    .build(),
  ...englishRecommendedTransformers,
});

export function hasProfanity(text: string) {
  return profanityMatcher.hasMatch(text);
}

export function assertNoSlurs(...texts: (string | null | undefined)[]) {
  if (texts.some((text) => text && slurMatcher.hasMatch(text))) {
    throw new Error("Your text contains language that isn't allowed. Edit it and try again.");
  }
}
