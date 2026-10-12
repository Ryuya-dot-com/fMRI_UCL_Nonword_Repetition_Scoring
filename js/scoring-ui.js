/**
 * scoring-ui.js - accuracy/notes controls for a single nonword item.
 */
const ScoringUI = (() => {
  let _initialized = false;
  let _onScoreChanged = null;
  let _currentParticipant = null;
  let _currentItem = null;
  let _audioReady = false;

  function init(onScoreChanged) {
    _onScoreChanged = onScoreChanged;
    if (_initialized) return;
    _initialized = true;
    setupScoreButtons();
    setupNotesField();
    document.getElementById('clear-score').addEventListener('click', () => setAccuracyScore(null));
  }

  function setupScoreButtons() {
    document.querySelectorAll('.btn-score').forEach(btn => {
      btn.addEventListener('click', () => {
        const score = parseInt(btn.dataset.score, 10);
        setAccuracyScore(score);
      });
    });
  }

  function setupNotesField() {
    const notes = document.getElementById('item-notes');
    if (!notes) return;
    notes.addEventListener('input', () => {
      saveCurrentScore();
      if (_onScoreChanged) _onScoreChanged();
    });
  }

  function renderItem(participant, item, itemCount) {
    _currentParticipant = participant;
    _currentItem = item;

    const wordEl = document.getElementById('item-word');
    const taskEl = document.getElementById('task-badge');
    const detailsEl = document.getElementById('trial-details');
    const audioFileEl = document.getElementById('audio-file-label');

    wordEl.textContent = item.item;
    taskEl.textContent = ({one_word:'1語',two_word:'2語',three_word:'3語',four_word:'4語'})[item.task] || item.task;

    detailsEl.innerHTML =
      `スライド ${item.slide} · 項目 ${item.index} / ${itemCount} · 提示内の順番 ${item.itemOrderInSlide}`;

    const audioFile = DataLoader.getAudioFileName(participant, item.slide);
    audioFileEl.textContent = audioFile
      ? `Audio: ${audioFile}${participant.audioMode === 'full' ? '（全体録音：波形で再生位置を選択）' : ''}`
      : '録音ファイルなし（この項目は未採点）';
    setAudioReady(false);

    const existing = State.getScore(participant.key, item.index);
    if (existing) {
      highlightScoreButton(existing.accuracy);
      document.getElementById('item-notes').value = existing.note || '';
    } else {
      clearScoreButtons();
      document.getElementById('item-notes').value = '';
    }
  }

  function getActiveScore() {
    const active = document.querySelector('.btn-score.active');
    return active ? parseInt(active.dataset.score, 10) : null;
  }

  function setAccuracyScore(score) {
    if (!_audioReady) return;
    highlightScoreButton(score);
    saveCurrentScore();
    if (_onScoreChanged) _onScoreChanged();
  }

  function highlightScoreButton(score) {
    document.querySelectorAll('.btn-score').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.score, 10) === score);
    });
  }

  function setAudioReady(ready) {
    _audioReady = ready;
    document.querySelectorAll('.btn-score').forEach(btn => { btn.disabled = !ready; });
    document.getElementById('clear-score').disabled = !ready;
  }

  function clearScoreButtons() {
    document.querySelectorAll('.btn-score').forEach(btn => btn.classList.remove('active'));
  }

  function saveCurrentScore() {
    if (!_currentParticipant || !_currentItem) return;

    const accuracy = getActiveScore();
    const note = document.getElementById('item-notes').value.trim();

    if (accuracy == null && !note && !State.getScore(_currentParticipant.key, _currentItem.index)) return;

    State.setScore(_currentParticipant.key, _currentItem.index, {
      accuracy,
      note
    });
  }

  function scoreByKey(key) {
    if (key === '0') setAccuracyScore(0);
    if (key === '1') setAccuracyScore(1);
  }

  return {
    init,
    renderItem,
    setAudioReady,
    saveCurrentScore,
    getActiveScore,
    scoreByKey
  };
})();
