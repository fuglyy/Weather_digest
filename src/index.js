#!/usr/bin/env node

import { parseArgs } from './cli/args.js';
import { formatWeatherReport } from './format/output.js';
import { getCityWeather } from './services/weatherService.js';

async function main() {
  try {
    const options = parseArgs();
    const results = await Promise.allSettled(
      options.cities.map((city) => getCityWeather(city, options.days, { noCache: options.noCache }))
    );

    let exitCode = 0;

    for (const result of results) {
      if (result.status === 'fulfilled') {
        console.log(formatWeatherReport(result.value));
        console.log('');
        continue;
      }

      exitCode = 1;
      console.error(`Error: ${result.reason.message || 'Unexpected error'}`);
    }

    process.exitCode = exitCode;
  } catch (error) {
    if (error && error.message === 'HELP') {
      console.log('Usage: node src/index.js --city "City Name" --days 3 [--no-cache]');
      process.exitCode = 0;
      return;
    }

    console.error(`Error: ${error.message || 'Unexpected error'}`);
    process.exitCode = 1;
  }
}

main();
