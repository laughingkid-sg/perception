export const launcherStorageKey = 'perception-app-navigation:v1';

export interface LauncherPosition {
  x: number;
  y: number;
}

export interface LauncherPreferences {
  collapsed: boolean;
  position: LauncherPosition | null;
}

export const defaultLauncherPreferences: LauncherPreferences = {
  collapsed: false,
  position: null,
};

export function clampPosition(
  position: LauncherPosition,
  viewport: { height: number; width: number },
  diameter = 56,
  margin = 12,
): LauncherPosition {
  return {
    x: Math.min(Math.max(position.x, margin), Math.max(margin, viewport.width - diameter - margin)),
    y: Math.min(Math.max(position.y, margin), Math.max(margin, viewport.height - diameter - margin)),
  };
}

export function parseLauncherPreferences(value: string | null): LauncherPreferences {
  if (!value) return defaultLauncherPreferences;

  try {
    const parsed = JSON.parse(value) as Partial<LauncherPreferences>;
    const position = parsed.position;
    const hasValidPosition =
      position !== null &&
      typeof position === 'object' &&
      typeof position.x === 'number' &&
      Number.isFinite(position.x) &&
      typeof position.y === 'number' &&
      Number.isFinite(position.y);

    return {
      collapsed: parsed.collapsed === true,
      position: hasValidPosition ? { x: position.x, y: position.y } : null,
    };
  } catch {
    return defaultLauncherPreferences;
  }
}
