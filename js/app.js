/**
 * app.js - main controller for Nonword Repetition scoring app.
 */
const App = (() => {
  let _dataset = null;
  let _participants = [];
  let _items = [];
  let _audioKey = null;
  let _loadGeneration = 0;
  let _setupListenersAttached = false;
  let _scoringListenersAttached = false;

  async function init() {
    try {
      await DataLoader.loadManifest();
      _items = DataLoader.getTrialTemplate();
    } catch (e) {
      document.body.innerHTML = `<div style="padding:24px;color:#ef4444;">` +
        `<h2>Failed to load manifest</h2><p>${e.message}</p>` +
        `<p>ページを再読み込みしてください。解消しない場合は管理者へ連絡してください。</p></div>`;
      return;
    }

    renderSetupScreen();
    setupKeyboardShortcuts();
    window.addEventListener('nwr-playback', updatePlayButton);
    window.addEventListener('pagehide', () => State.save());
    document.addEventListener('visibilitychange', () => { if (document.hidden) State.save(); });
    window.addEventListener('nwr-saved', e => {
      const el = document.getElementById('save-status');
      el.textContent = e.detail.success ? 'このブラウザに保存済み' : '保存できません。Excel / CSVで出力してください';
      el.style.color = e.detail.success ? 'var(--ok)' : 'var(--danger)';
    });
  }

  function renderSetupScreen() {
    document.getElementById('setup-screen').style.display = '';
    document.getElementById('scoring-screen').style.display = 'none';

    renderDatasetSelector();
    renderParticipantSelector();

    if (!_setupListenersAttached) {
      _setupListenersAttached = true;

      document.getElementById('dataset-selector').addEventListener('change', () => {
        renderParticipantSelector();
        checkResume();
      });

      document.getElementById('select-all-btn').addEventListener('click', () => {
        document.querySelectorAll('#participant-selector label:not([hidden]) input[type="checkbox"]').forEach(cb => {
          cb.checked = true;
        });
        updateStartButton();
      });

      document.getElementById('deselect-all-btn').addEventListener('click', () => {
        document.querySelectorAll('#participant-selector input[type="checkbox"]').forEach(cb => {
          cb.checked = false;
        });
        updateStartButton();
      });

      document.getElementById('participant-selector').addEventListener('change', updateStartButton);
      document.getElementById('participant-search').addEventListener('input', filterParticipants);
      document.getElementById('recording-filter').addEventListener('change', filterParticipants);
      document.getElementById('rater-id').addEventListener('input', () => {
        updateStartButton();
        checkResume();
      });

      document.getElementById('start-btn').addEventListener('click', startScoring);
      document.getElementById('resume-btn').addEventListener('click', resumeScoring);
    }

    updateStartButton();
    checkResume();
  }

  function renderDatasetSelector() {
    const container = document.getElementById('dataset-selector');
    const datasets = DataLoader.getDatasets();

    container.innerHTML = '';
    datasets.forEach((ds, i) => {
      const label = document.createElement('label');
      label.innerHTML =
        `<input type="radio" name="dataset" value="${ds.id}" ${i === 0 ? 'checked' : ''}>` +
        `<span>${ds.label}（${ds.participants.length}名）</span>`;
      container.appendChild(label);
    });
  }

  function renderParticipantSelector() {
    const container = document.getElementById('participant-selector');
    const ds = DataLoader.getDataset(getSelectedDatasetId());
    if (!ds) return;

    container.innerHTML = '';

    ds.participants.forEach(p => {
      const label = document.createElement('label');
      const audioTag = p.audioMode === 'full' ? ' [全体録音]' :
        p.availableSlides.length < DataLoader.getManifest().scoredSlides.length ? ' [一部の録音なし]' : '';
      label.innerHTML = `<input type="checkbox" value="${p.key}" checked> ${p.id}${audioTag}`;
      label.dataset.id = p.id;
      label.dataset.mode = p.audioMode === 'full' ? 'full' :
        p.availableSlides.length < DataLoader.getManifest().scoredSlides.length ? 'partial' : 'slides';
      container.appendChild(label);
    });

    document.getElementById('participant-count').textContent = ds.participants.length;
    filterParticipants();
  }

  function filterParticipants() {
    const query = document.getElementById('participant-search').value.trim().toLowerCase();
    const mode = document.getElementById('recording-filter').value;
    document.querySelectorAll('#participant-selector label').forEach(label => {
      label.hidden = !label.dataset.id.toLowerCase().includes(query) || (mode !== 'all' && mode !== label.dataset.mode);
    });
    updateStartButton();
  }

  function getSelectedDatasetId() {
    const checked = document.querySelector('input[name="dataset"]:checked');
    return checked ? checked.value : null;
  }

  function getSelectedParticipantKeys() {
    return Array.from(document.querySelectorAll('#participant-selector input[type="checkbox"]:checked'))
      .map(cb => cb.value);
  }

  function updateStartButton() {
    const rater = document.getElementById('rater-id').value.trim();
    const selected = getSelectedParticipantKeys();
    document.getElementById('start-btn').disabled = !rater || selected.length === 0;
    document.getElementById('selection-count').textContent = `${selected.length}名を選択中`;
  }

  function checkResume() {
    const rater = document.getElementById('rater-id').value.trim();
    const datasetId = getSelectedDatasetId();
    const section = document.getElementById('resume-section');

    if (!rater || !datasetId) {
      section.style.display = 'none';
      return;
    }

    const existing = State.load(rater, datasetId);
    if (!existing) {
      section.style.display = 'none';
      return;
    }

    const scored = State.getAssignedScoredCount(_items.length);
    document.getElementById('resume-info').textContent =
      `${existing.assignedParticipants.length}名・${scored}項目を採点済み。最終保存：${new Date(existing.lastSaved).toLocaleString('ja-JP')}`;
    section.style.display = 'block';
  }

  function startScoring() {
    const rater = document.getElementById('rater-id').value.trim();
    const datasetId = getSelectedDatasetId();
    const participantKeys = getSelectedParticipantKeys();

    State.create(rater, datasetId, participantKeys);
    enterScoringScreen(datasetId, participantKeys, 0, 0);
  }

  function resumeScoring() {
    const state = State.get();
    if (!state) return;

    enterScoringScreen(
      state.datasetId,
      state.assignedParticipants,
      state.currentParticipantIndex,
      state.currentItemIndex
    );
  }

  function enterScoringScreen(datasetId, participantKeys, startPIndex, startIIndex) {
    _dataset = DataLoader.getDataset(datasetId);
    _items = DataLoader.getTrialTemplate();
    _participants = participantKeys
      .map(k => resolveParticipant(_dataset, k))
      .filter(Boolean);

    if (!_dataset || _participants.length === 0) {
      alert('No participants available for scoring.');
      return;
    }

    document.getElementById('setup-screen').style.display = 'none';
    document.getElementById('scoring-screen').style.display = '';
    document.getElementById('dataset-label').textContent = _dataset.label;
    document.getElementById('participant-jump').replaceChildren(..._participants.map((p,i) => new Option(p.id,i)));
    document.getElementById('item-jump').replaceChildren(..._items.map((item,i) => new Option(`${item.index}. ${item.item}`,i)));

    try {
      WaveformViewer.init();
    } catch (e) {
      console.error('Waveform initialization failed:', e);
      alert('Waveform initialization failed. The app will continue in basic mode.');
    }
    ScoringUI.init(() => {
      Navigation.updateProgress();
      showSaveStatus();
    });

    if (!_scoringListenersAttached) {
      _scoringListenersAttached = true;

      document.getElementById('back-to-setup').addEventListener('click', () => {
        ScoringUI.saveCurrentScore();
        WaveformViewer.destroy();
        _audioKey = null;
        renderSetupScreen();
      });

      document.getElementById('play-btn').addEventListener('click', () => {
        WaveformViewer.play();
        updatePlayButton();
      });

      document.getElementById('stop-btn').addEventListener('click', () => {
        WaveformViewer.stop();
        updatePlayButton();
      });
      document.getElementById('rewind-btn').addEventListener('click', () => WaveformViewer.skip(-3));
      document.getElementById('forward-btn').addEventListener('click', () => WaveformViewer.skip(3));
      document.getElementById('participant-jump').addEventListener('change', e => {
        ScoringUI.saveCurrentScore();
        Navigation.navigate(Number(e.target.value), 0);
      });
      document.getElementById('item-jump').addEventListener('change', e => {
        ScoringUI.saveCurrentScore();
        Navigation.navigate(_participants.indexOf(Navigation.getCurrentParticipant()), Number(e.target.value));
      });

      document.getElementById('playback-speed').addEventListener('change', e => {
        WaveformViewer.setPlaybackRate(parseFloat(e.target.value));
      });

      document.getElementById('export-participant').addEventListener('click', () => {
        Export.exportCurrentParticipant(_dataset, _items);
      });

      document.getElementById('export-all-csv').addEventListener('click', () => {
        Export.exportSelectedCSV(_dataset, _participants, _items);
      });
    }

    Navigation.init(_dataset, _participants, _items, {
      onNavigate: loadItem,
      onParticipantComplete: (participant, dataset, items) => {
        Export.showParticipantExportPopup(participant, dataset, items);
      }
    });

    const safeP = Math.min(startPIndex, _participants.length - 1);
    const safeI = Math.min(startIIndex, _items.length - 1);
    _audioKey = null;
    Navigation.navigate(safeP, safeI);
  }

  function resolveParticipant(dataset, keyOrId) {
    const direct = DataLoader.getParticipantByKey(String(keyOrId));
    if (direct) return direct;
    if (!dataset) return null;

    // Backward compatibility: older saved sessions may store bare participant IDs.
    const asId = String(keyOrId);
    return dataset.participants.find(p => p.id === asId) || null;
  }

  async function loadItem(_pIndex, _iIndex, participant, item) {
    const generation = ++_loadGeneration;

    ScoringUI.renderItem(participant, item, _items.length);

    const audioUrl = DataLoader.getAudioUrl(participant, item.slide);
    const audioKey = `${participant.key}:${audioUrl}`;
    if (!audioUrl) {
      WaveformViewer.destroy();
      _audioKey = null;
      document.getElementById('waveform-container').textContent = 'このスライドの録音ファイルはありません。';
      document.getElementById('waveform-time').textContent = '--';
      document.getElementById('waveform-timeline').textContent = '';
      document.getElementById('waveform-minimap').textContent = '';
      document.getElementById('play-btn').disabled = true;
      updatePlayButton();
      return;
    }
    document.getElementById('play-btn').disabled = true;
    if (audioKey === _audioKey) {
      ScoringUI.setAudioReady(true);
      document.getElementById('play-btn').disabled = false;
      updatePlayButton();
      return;
    }

    try {
      await WaveformViewer.loadAudio(audioUrl);
      if (generation !== _loadGeneration) return;
      _audioKey = audioKey;
      ScoringUI.setAudioReady(true);
      document.getElementById('play-btn').disabled = false;
      updatePlayButton();
    } catch (e) {
      if (generation !== _loadGeneration) return;
      console.error('Audio load failed:', e);
      _audioKey = null;
      WaveformViewer.destroy();
      ScoringUI.setAudioReady(false);
      alert(`Audio load failed: ${audioUrl}`);
    }
  }

  function updatePlayButton() {
    const btn = document.getElementById('play-btn');
    if (!btn) return;
    btn.textContent = WaveformViewer.isPlaying() ? '一時停止' : '再生';
  }

  function showSaveStatus() {
    const el = document.getElementById('save-status');
    el.textContent = '保存中…';
    el.style.color = 'var(--warn)';
  }

  function setupKeyboardShortcuts() {
    document.addEventListener('keydown', e => {
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') {
        if (e.key === 'Escape') e.target.blur();
        return;
      }

      if (document.getElementById('scoring-screen').style.display === 'none') return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          if (!document.getElementById('play-btn').disabled) WaveformViewer.play();
          updatePlayButton();
          break;
        case '0':
          ScoringUI.scoreByKey('0');
          break;
        case '1':
          ScoringUI.scoreByKey('1');
          break;
        case 'ArrowRight':
        case 'Enter':
          e.preventDefault();
          Navigation.nextItem();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          Navigation.prevItem();
          break;
        case 'PageDown':
          e.preventDefault();
          Navigation.nextParticipant();
          break;
        case 'PageUp':
          e.preventDefault();
          Navigation.prevParticipant();
          break;
        case 'n':
        case 'N':
          document.getElementById('item-notes').focus();
          break;
        case '+':
        case '=':
          WaveformViewer.zoomIn();
          break;
        case '-':
          WaveformViewer.zoomOut();
          break;
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);

  return { init };
})();
