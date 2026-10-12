# fMRI UCL — Nonword Repetition Scoring

Japanese nonword repetition scoring for the fMRI UCL study, adapted from
[Nonword_Repetition_Scoring](https://github.com/Ryuya-dot-com/Nonword_Repetition_Scoring).

The original 53-item template and binary scoring rules are unchanged.

## Use

1. Open the scoring site and enter your Rater ID.
2. Select the participants to score and click 採点を始める.
3. Play the recording and score each nonword: completely correct = 1, otherwise = 0.
4. Use この参加者のExcelを保存 or 選択した参加者のCSVを保存 to download results.

Scores and notes are saved in the current browser. Enter the same Rater ID and
use 続きから再開 to continue in that browser.

R01, B02, V03 and R04 use full-session recordings. Select the relevant position
in the waveform; navigating between items retains the playback position.
V63 and V99 have recordings for slides 1 and 2 only. Items without an audio
file remain unscored, with blank accuracy in exports.

## Data

`data/participants.json` contains the participant/audio mapping and scoring
template. `data/audio/` contains 374 audio files for 67 participants.
PCM recordings are stored as lossless FLAC; existing MP3 audio is not recompressed.
Decoded PCM hashes were verified to match the source recordings for every file.
File preparation does not constitute a listening review or an assessment of
recording quality or response correctness.

To run locally, serve this directory with `python3 -m http.server 8080` and open
`http://localhost:8080/`. Third-party libraries and their licenses are in `vendor/`.
