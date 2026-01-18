export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);
  const secs = Math.round((minutes % 1) * 60);

  if (hours === 0 && mins === 0) {
    return `${secs} second${secs !== 1 ? 's' : ''}`;
  }

  if (hours === 0) {
    return `${mins} minute${mins !== 1 ? 's' : ''} ${secs} second${secs !== 1 ? 's' : ''}`;
  }

  return `${hours} hour${hours !== 1 ? 's' : ''} ${mins} minute${mins !== 1 ? 's' : ''} ${secs} second${secs !== 1 ? 's' : ''}`;
}

export function formatTimestamp(timestamp: number): string {
  return `<t:${Math.floor(timestamp / 1000)}:F>`;
}

export function formatRelativeTime(timestamp: number): string {
  return `<t:${Math.floor(timestamp / 1000)}:R>`;
}

export function formatShortTimestamp(timestamp: number): string {
  return `<t:${Math.floor(timestamp / 1000)}:f>`;
}

export function getCurrentShiftDuration(startTime: number): number {
  const now = Date.now();
  return (now - startTime) / 1000 / 60; // Keep decimal for seconds precision
}

export function formatDateForCycleEnd(date: Date): string {
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  };

  return new Intl.DateTimeFormat('en-US', options).format(date);
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
