export function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    cities: [],
    days: 3,
    noCache: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--help' || token === '-h') {
      throw new Error('HELP');
    }

    if (token.startsWith('--city=')) {
      const value = token.slice('--city='.length).trim();
      options.cities = splitCities(value);
      continue;
    }

    if (token === '--city') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error('Parameter --city is required.');
      }
      options.cities = splitCities(value);
      index += 1;
      continue;
    }

    if (token.startsWith('--days=')) {
      const value = token.slice('--days='.length);
      options.days = parseDayCount(value);
      continue;
    }

    if (token === '--days') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error('Parameter --days must be an integer between 1 and 7.');
      }
      options.days = parseDayCount(value);
      index += 1;
      continue;
    }

    if (token === '--no-cache') {
      options.noCache = true;
      continue;
    }

    throw new Error(`Unknown argument: ${token}`);
  }

  if (options.cities.length === 0) {
    throw new Error('Parameter --city is required.');
  }

  return options;
}

function splitCities(value) {
  const chunks = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  if (chunks.length === 0) {
    throw new Error('Parameter --city is required.');
  }

  return chunks;
}

function parseDayCount(value) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 7) {
    throw new Error('Parameter --days must be an integer between 1 and 7.');
  }

  return parsed;
}
