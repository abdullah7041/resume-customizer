const FEATURE_NAMES = new Set([
  'parse',
  'match',
  'clarification',
  'optimize',
  'metadata',
  'truth-check',
  'cover-letter',
  'interview',
]);

export const EVALUATION_USAGE = 'Usage: --feature <feature> [--baseline <model> --candidate <model>] [--models <model,model>] [--runs <positive integer>] [--fixture <id>] [--stage <0-3>] [--update-cache] [--report-dir <path>] [--selftest]';

const usageError = (message) => {
  const error = new Error(`${message}\n${EVALUATION_USAGE}`);
  error.code = 'EVALUATION_USAGE';
  return error;
};

const parseModelList = (value, flag) => {
  if (typeof value !== 'string' || value.length === 0) {
    throw usageError(`${flag} requires a model value.`);
  }

  const models = value.split(',').map((model) => model.trim());
  if (models.some((model) => !model || /\s/.test(model) || !model.includes('/'))) {
    throw usageError(`${flag} must be a comma-separated list of provider/model IDs.`);
  }
  return models;
};

const parseValue = (argv, index, flag) => {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw usageError(`${flag} requires a value.`);
  }
  return value;
};

export const parseEvaluationArgs = (argv) => {
  if (!Array.isArray(argv)) {
    throw new TypeError('Evaluation arguments must be an array.');
  }

  const values = {
    feature: null,
    baseline: null,
    candidate: null,
    models: [],
    runs: 1,
    fixture: null,
    stage: null,
    updateCache: false,
    reportDir: null,
    selftest: false,
  };
  const seen = new Set();

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (!flag.startsWith('--')) {
      throw usageError(`Unexpected argument "${flag}".`);
    }
    if (![
      '--feature', '--baseline', '--candidate', '--models', '--runs', '--fixture', '--stage',
      '--update-cache', '--report-dir', '--selftest',
    ].includes(flag)) {
      throw usageError(`Unknown option "${flag}".`);
    }
    if (seen.has(flag)) {
      throw usageError(`Duplicate option "${flag}".`);
    }
    seen.add(flag);

    if (flag === '--update-cache') {
      values.updateCache = true;
      continue;
    }
    if (flag === '--selftest') {
      values.selftest = true;
      continue;
    }

    const value = parseValue(argv, index, flag);
    index += 1;

    if (flag === '--feature') {
      if (!FEATURE_NAMES.has(value)) throw usageError(`Invalid --feature value "${value}".`);
      values.feature = value;
    } else if (flag === '--baseline' || flag === '--candidate') {
      values[flag.slice(2)] = parseModelList(value, flag)[0];
      if (value.includes(',')) throw usageError(`${flag} accepts exactly one provider/model ID.`);
    } else if (flag === '--models') {
      values.models = parseModelList(value, flag);
    } else if (flag === '--runs') {
      if (!/^[1-9]\d*$/.test(value)) throw usageError('--runs must be a positive integer.');
      values.runs = Number(value);
    } else if (flag === '--fixture') {
      if (!value.trim()) throw usageError('--fixture requires a non-empty fixture ID.');
      values.fixture = value;
    } else if (flag === '--stage') {
      if (!/^[0-3]$/.test(value)) throw usageError('--stage must be 0, 1, 2, or 3.');
      values.stage = Number(value);
    } else if (flag === '--report-dir') {
      if (!value.trim()) throw usageError('--report-dir requires a non-empty path.');
      values.reportDir = value;
    }
  }

  if (!values.feature) throw usageError('--feature is required.');
  if (Boolean(values.baseline) !== Boolean(values.candidate)) {
    throw usageError('--baseline and --candidate must be provided together.');
  }

  const models = [values.baseline, values.candidate, ...values.models].filter(Boolean);
  if (new Set(models).size !== models.length) {
    throw usageError('Duplicate model IDs are not allowed.');
  }

  return { ...values, models };
};
