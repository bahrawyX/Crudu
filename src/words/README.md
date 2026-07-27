# Word lists

`en-1000.json` and `en-5000.json` are generated. Do not edit them by hand.

```bash
pnpm words
```

## Source and licence

Both files derive from
[first20hours/google-10000-english](https://github.com/first20hours/google-10000-english),
the `google-10000-english-usa-no-swears.txt` variant. That list is built from
the Google Web Trillion Word Corpus n-gram data and is public domain.

**Monkeytype's word lists were deliberately not used.** Monkeytype is GPLv3 and
this project is not, so copying its lists would relicense the repository.

## Filter

`scripts/build-wordlists.mjs` keeps a word only if it is:

- `a-z` only — no apostrophes, no accents, no digits, nothing shifted
- between 2 and 9 characters

Punctuation and numbers are independent toggles applied at generation time, not
baked into the list, so a word never carries a comma of its own.

8517 of the 10000 source entries survive the filter. The first 1000 and the
first 5000 are written out.

## Order

Frequency rank, most common first. Rank is load-bearing rather than incidental:
the adaptive generator draws 35% of every drill from the top-1000 list to keep
generated text reading like English, and the three calibration tests run plain
common-word English. Sorting these files alphabetically would break both.
