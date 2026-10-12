/**
 * data-loader.js - manifest loading and participant/audio resolution.
 */
const DataLoader = (() => {
  let _manifest = null;
  let _datasets = [];
  const _participantByKey = new Map();

  function participantKey(timing, id) {
    return `${timing}:${id}`;
  }

  async function loadManifest() {
    const resp = await fetch('data/participants.json');
    if (!resp.ok) throw new Error('Failed to load data/participants.json');
    _manifest = await resp.json();
    buildDatasets();
    return _manifest;
  }

  function buildDatasets() {
    _participantByKey.clear();

    const baseDatasets = (_manifest.datasets || []).map(ds => {
      const participants = (ds.participants || []).map(p => {
        const normalized = {
          id: String(p.id),
          key: participantKey(ds.timing, String(p.id)),
          timing: ds.timing,
          sourceDatasetId: ds.id,
          sourceDatasetLabel: ds.label,
          audioRoot: ds.audioRoot,
          audioExtension: ds.audioExtension || _manifest.audioExtension || 'mp3',
          sessionDir: p.sessionDir,
          availableSlides: p.availableSlides || [],
          audioFiles: p.audioFiles || {},
          audioMode: p.audioMode || 'slides'
        };
        _participantByKey.set(normalized.key, normalized);
        return normalized;
      });

      return {
        id: ds.id,
        label: ds.label,
        timing: ds.timing,
        participants
      };
    });

    const allParticipants = baseDatasets
      .flatMap(ds => ds.participants)
      .slice()
      .sort((a, b) => {
        const na = Number(a.id.replace(/^[A-Za-z]+/, ''));
        const nb = Number(b.id.replace(/^[A-Za-z]+/, ''));
        if (na !== nb) return na - nb;
        return a.timing.localeCompare(b.timing);
      });

    _datasets = baseDatasets.length === 1 ? baseDatasets : [
      {
        id: 'all',
        label: 'All (Immediate + Delayed)',
        timing: 'mixed',
        participants: allParticipants
      },
      ...baseDatasets
    ];
  }

  function getManifest() {
    return _manifest;
  }

  function getDatasets() {
    return _datasets;
  }

  function getDataset(datasetId) {
    return _datasets.find(ds => ds.id === datasetId) || null;
  }

  function getTrialTemplate() {
    return _manifest ? (_manifest.trialTemplate || []) : [];
  }

  function getSkipSlides() {
    return _manifest ? (_manifest.skipSlides || []) : [];
  }

  function getScoringRule() {
    return _manifest ? (_manifest.scoring || null) : null;
  }

  function getParticipantByKey(key) {
    return _participantByKey.get(key) || null;
  }

  function getAudioFileName(participant, slide) {
    if (participant.audioFiles) {
      return (participant.audioFiles[String(slide)] || '').split('/').pop();
    }
    const slideStr = String(slide).padStart(2, '0');
    const ext = participant.audioExtension || (_manifest && _manifest.audioExtension) || 'mp3';
    return `${participant.sessionDir}_slide${slideStr}.${ext}`;
  }

  function getAudioUrl(participant, slide) {
    if (participant.audioFiles) return participant.audioFiles[String(slide)] || null;
    const file = getAudioFileName(participant, slide);
    return `${participant.audioRoot}/${participant.sessionDir}/${file}`;
  }

  return {
    loadManifest,
    getManifest,
    getDatasets,
    getDataset,
    getTrialTemplate,
    getSkipSlides,
    getScoringRule,
    getParticipantByKey,
    getAudioFileName,
    getAudioUrl
  };
})();
