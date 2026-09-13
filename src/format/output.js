export function formatWeatherReport(report) {
  const lines = [];
  lines.push(`City: ${report.city}`);
  lines.push(`Country: ${report.country}`);
  lines.push(`Coordinates: ${report.latitude}, ${report.longitude}`);
  lines.push('');
  lines.push('Date                Min °C   Max °C   Precipitation');
  lines.push('------------------  -------  -------  -------------');

  for (const day of report.days) {
    lines.push(`${day.date}  ${String(day.minTemp).padStart(6, ' ')}  ${String(day.maxTemp).padStart(6, ' ')}  ${String(day.precipitation).padStart(12, ' ')}`);
  }

  return lines.join('\n');
}
