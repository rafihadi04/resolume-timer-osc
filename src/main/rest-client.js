const REQUEST_TIMEOUT = 2500;

function baseUrl (settings = {}) {
  const rawHost = String(settings.host || '127.0.0.1').trim();
  const host = rawHost.replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
  const port = Number(settings.restPort) || 8080;
  return `http://${host}:${port}`;
}

async function request (settings, pathname, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeout || REQUEST_TIMEOUT);

  try {
    const response = await fetch(`${baseUrl(settings)}${pathname}`, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {})
      }
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      const error = new Error(
        `HTTP ${response.status}${detail ? `: ${detail.slice(0, 160)}` : ''}`
      );
      error.status = response.status;
      throw error;
    }

    if (options.raw) return response;

    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch (_error) {
      return text;
    }
  } finally {
    clearTimeout(timeout);
  }
}

function valueOf (node) {
  if (node === undefined || node === null) return undefined;
  if (typeof node === 'object' && node.value !== undefined) return node.value;
  return node;
}

function nameOf (node, fallback) {
  const value = valueOf(node);
  if (value === undefined || value === null || value === '') return fallback;
  return String(value);
}

function normalizeParams (params) {
  if (!params || typeof params !== 'object') return [];

  if (Array.isArray(params)) {
    return params.map((param, index) => {
      if (param && typeof param === 'object') {
        return { name: param.name || String(index), ...param };
      }
      return { id: index, name: String(index), value: param };
    });
  }

  return Object.entries(params).map(([key, value]) => {
    if (value && typeof value === 'object') {
      return {
        id: value.id !== undefined ? value.id : key,
        name: value.name || key,
        ...value
      };
    }
    return { id: key, name: key, value };
  });
}

function pickTextParam (params) {
  const list = normalizeParams(params).filter(
    (param) => param && param.id !== undefined && param.id !== null
  );

  const exact = list.find(
    (param) => String(param.name || '').trim().toLowerCase() === 'text'
  );
  if (exact) return exact;

  const textType = list.find(
    (param) => String(param.valuetype || param.type || '').toLowerCase() === 'paramtext'
  );
  if (textType) return textType;

  return list.find((param) => /text/i.test(String(param.name || ''))) || null;
}

function pickColorParam (params) {
  const list = normalizeParams(params).filter(
    (param) => param && param.id !== undefined && param.id !== null
  );

  const exact = list.find(
    (param) => String(param.name || '').trim().toLowerCase() === 'color'
  );
  if (exact) return exact;

  return list.find(
    (param) => String(param.valuetype || param.type || '').toLowerCase() === 'paramcolor'
  ) || null;
}

function pickEffectTextParam (effect) {
  if (!effect || typeof effect !== 'object') return null;
  const param = pickTextParam(effect.params);
  if (!param) return null;

  const effectName = String(effect.name || effect.display_name || effect.description || '');
  const valueType = String(param.valuetype || param.type || '').toLowerCase();

  if (/text/i.test(effectName) || valueType === 'paramtext') {
    return param;
  }

  return null;
}

function oscSlug (value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function sourceOscKey (video) {
  const description = String(video?.description || '').toLowerCase();
  if (description.includes('text animator')) return 'textgenerator';
  return 'blocktextgenerator';
}

function effectOscKey (effect) {
  const effectName = String(effect?.name || effect?.display_name || '').toLowerCase();
  if (effectName.includes('text animator')) return 'texteffect';
  if (effectName.includes('text block')) return 'textblock';
  return oscSlug(effectName) || 'textblock';
}

function addTarget (targets, seen, entry) {
  const {
    kind,
    layerNumber = null,
    clipNumber = null,
    effectNumber = null,
    groupNumber = null,
    layerLabel = '',
    clipLabel = '',
    effectLabel = '',
    groupLabel = '',
    param,
    colorParam = null,
    sourceType = null,
    sourceKey = 'blocktextgenerator',
    effectKey = 'textblock'
  } = entry;

  if (!param || param.id === undefined || param.id === null) return;

  const paramId = String(param.id);
  const colorParamId =
    colorParam && colorParam.id !== undefined && colorParam.id !== null
      ? String(colorParam.id)
      : null;
  let oscPath = null;
  let oscPaths = [];
  let scope;

  if (kind === 'source') {
    oscPath = `/composition/layers/${layerNumber}/clips/${clipNumber}/video/source/${sourceKey}/text`;
    oscPaths = [
      oscPath,
      `/composition/layers/${layerNumber}/clips/${clipNumber}/source/blocktext/text`
    ];
    scope = `${layerLabel} / ${clipLabel} / Source`;
  } else if (kind === 'clip-effect') {
    oscPath = `/composition/layers/${layerNumber}/clips/${clipNumber}/video/effects/${effectKey}/effect/text`;
    oscPaths = [
      oscPath,
      `/composition/layers/${layerNumber}/clips/${clipNumber}/effects/textblock/effect/text`
    ];
    scope = `${layerLabel} / ${clipLabel} / ${effectLabel}`;
  } else if (kind === 'layer-effect') {
    oscPath = `/composition/layers/${layerNumber}/video/effects/${effectKey}/effect/text`;
    oscPaths = [
      oscPath,
      `/composition/layers/${layerNumber}/effects/textblock/effect/text`
    ];
    scope = `${layerLabel} / ${effectLabel}`;
  } else if (kind === 'group-effect') {
    oscPath = null;
    oscPaths = [];
    scope = `${groupLabel} / ${effectLabel}`;
  } else {
    oscPath = `/composition/video/effects/${effectKey}/effect/text`;
    oscPaths = [
      oscPath,
      '/composition/effects/textblock/effect/text'
    ];
    scope = `Composition / ${effectLabel}`;
  }

  const id = [
    kind,
    layerNumber === null ? '-' : layerNumber,
    clipNumber === null ? '-' : clipNumber,
    effectNumber === null ? '-' : effectNumber,
    groupNumber === null ? '-' : groupNumber,
    paramId
  ].join(':');

  if (seen.has(id)) return;
  seen.add(id);

  targets.push({
    id,
    kind,
    scope,
    layer: layerNumber,
    clip: clipNumber,
    effect: effectNumber,
    group: groupNumber,
    paramName: String(param.name || 'Text'),
    paramId,
    currentValue: param.value !== undefined ? param.value : null,
    colorParamId,
    colorParamName: colorParam ? String(colorParam.name || 'Color') : null,
    colorValue: colorParam && colorParam.value !== undefined ? colorParam.value : null,
    sourceType,
    sourceKey: sourceKey || null,
    effectName: effectLabel || null,
    effectKey: effectKey || null,
    oscPath,
    oscPaths
  });
}

function scanComposition (composition) {
  const targets = [];
  const seen = new Set();

  const layers = Array.isArray(composition?.layers) ? composition.layers : [];

  layers.forEach((layer, layerIndex) => {
    const layerNumber = layerIndex + 1;
    const layerLabel = nameOf(layer?.name, `Layer ${layerNumber}`);
    const layerEffects = Array.isArray(layer?.video?.effects) ? layer.video.effects : [];

    layerEffects.forEach((effect, effectIndex) => {
      const param = pickEffectTextParam(effect);
      if (!param) return;
      addTarget(targets, seen, {
        kind: 'layer-effect',
        layerNumber,
        effectNumber: effectIndex + 1,
        layerLabel,
        effectLabel: nameOf(effect?.name || effect?.display_name, 'Text Block Effect'),
        effectKey: effectOscKey(effect),
        param,
        colorParam: pickColorParam(effect?.params)
      });
    });

    const clips = Array.isArray(layer?.clips) ? layer.clips : [];

    clips.forEach((clip, clipIndex) => {
      const video = clip?.video;
      if (!video) return;

      const clipNumber = clipIndex + 1;
      const clipLabel = nameOf(clip?.name, `Clip ${clipNumber}`);
      const sourceParam = pickTextParam(video.sourceparams);

      if (sourceParam) {
        addTarget(targets, seen, {
          kind: 'source',
          layerNumber,
          clipNumber,
          layerLabel,
          clipLabel,
          param: sourceParam,
          colorParam: pickColorParam(video.sourceparams),
          sourceType: video.description ? String(video.description) : null,
          sourceKey: sourceOscKey(video)
        });
      }

      const clipEffects = Array.isArray(video.effects) ? video.effects : [];

      clipEffects.forEach((effect, effectIndex) => {
        const param = pickEffectTextParam(effect);
        if (!param) return;
        addTarget(targets, seen, {
          kind: 'clip-effect',
          layerNumber,
          clipNumber,
          effectNumber: effectIndex + 1,
          layerLabel,
          clipLabel,
          effectLabel: nameOf(effect?.name || effect?.display_name, 'Text Block Effect'),
          effectKey: effectOscKey(effect),
          param,
          colorParam: pickColorParam(effect?.params)
        });
      });
    });
  });

  const groups = Array.isArray(composition?.layergroups) ? composition.layergroups : [];

  groups.forEach((group, groupIndex) => {
    const groupNumber = groupIndex + 1;
    const groupLabel = nameOf(group?.name, `Group ${groupNumber}`);
    const effects = Array.isArray(group?.video?.effects) ? group.video.effects : [];

    effects.forEach((effect, effectIndex) => {
      const param = pickEffectTextParam(effect);
      if (!param) return;
      addTarget(targets, seen, {
        kind: 'group-effect',
        groupNumber,
        groupLabel,
        effectNumber: effectIndex + 1,
        effectLabel: nameOf(effect?.name || effect?.display_name, 'Text Block Effect'),
        effectKey: effectOscKey(effect),
        param,
        colorParam: pickColorParam(effect?.params)
      });
    });
  });

  const compositionEffects = Array.isArray(composition?.video?.effects)
    ? composition.video.effects
    : [];

  compositionEffects.forEach((effect, effectIndex) => {
    const param = pickEffectTextParam(effect);
    if (!param) return;
    addTarget(targets, seen, {
      kind: 'composition-effect',
      effectNumber: effectIndex + 1,
      effectLabel: nameOf(effect?.name || effect?.display_name, 'Text Block Effect'),
      effectKey: effectOscKey(effect),
      param,
      colorParam: pickColorParam(effect?.params)
    });
  });

  return targets;
}

async function discover (settings) {
  try {
    const composition = await request(settings, '/api/v1/composition');
    const targets = scanComposition(composition);
    return { ok: true, targets };
  } catch (error) {
    return { ok: false, error: error.message, targets: [] };
  }
}

async function health (settings) {
  try {
    await request(settings, '/api/v1/composition', { timeout: 1500 });
    return { rest: true, at: Date.now() };
  } catch (error) {
    return { rest: false, error: error.message, at: Date.now() };
  }
}

async function trigger (settings, path) {
  await request(settings, path, { method: 'POST' });
  return { ok: true, path };
}

async function setParamValue (settings, paramId, value) {
  const id = encodeURIComponent(String(paramId));
  const text = String(value);

  try {
    await request(settings, `/api/v1/parameter/by-id/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ value: text })
    });
    return { ok: true, endpoint: 'parameter' };
  } catch (error) {
    if (error.status !== 404 && error.status !== 405) {
      throw error;
    }

    await request(settings, `/api/v1/param/by-id/${id}/value`, {
      method: 'PUT',
      body: JSON.stringify(text)
    });
    return { ok: true, endpoint: 'param-value' };
  }
}

module.exports = { discover, health, setParamValue, trigger, scanComposition, baseUrl };
