import { Grip, Home, PanelTopClose, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { applications, findCurrentApplication } from './apps';
import {
  clampPosition,
  defaultLauncherPreferences,
  launcherStorageKey,
  parseLauncherPreferences,
  type LauncherPosition,
  type LauncherPreferences,
} from './storage';

const orbDiameter = 56;
const orbMargin = 12;

function getViewport() {
  return { height: window.innerHeight, width: window.innerWidth };
}

function getSiteRoot() {
  const configuredRoot = document
    .querySelector<HTMLScriptElement>('script[data-perception-navigation-script]')
    ?.getAttribute('data-site-root');
  if (configuredRoot) return new URL(configuredRoot, window.location.href);

  return new URL(/* @vite-ignore */ '../', import.meta.url);
}

function getDefaultPosition(): LauncherPosition {
  return clampPosition(
    { x: window.innerWidth - orbDiameter - 20, y: window.innerHeight - orbDiameter - 20 },
    getViewport(),
    orbDiameter,
    orbMargin,
  );
}

function readPreferences() {
  try {
    return parseLauncherPreferences(window.localStorage.getItem(launcherStorageKey));
  } catch {
    return defaultLauncherPreferences;
  }
}

function savePreferences(preferences: LauncherPreferences) {
  try {
    window.localStorage.setItem(launcherStorageKey, JSON.stringify(preferences));
  } catch {
    // The launcher still works when storage is unavailable.
  }
}

export function App({ host }: { host: HTMLElement }) {
  const initialPreferences = useMemo(readPreferences, []);
  const [collapsed, setCollapsed] = useState(initialPreferences.collapsed);
  const [position, setPosition] = useState<LauncherPosition>(
    initialPreferences.position
      ? clampPosition(initialPreferences.position, getViewport(), orbDiameter, orbMargin)
      : getDefaultPosition(),
  );
  const drag = useRef<{
    moved: boolean;
    offsetX: number;
    offsetY: number;
    pointerId: number;
  } | null>(null);
  const suppressNextClick = useRef(false);
  const siteRoot = useMemo(getSiteRoot, []);
  const currentApplication = findCurrentApplication(window.location.pathname);

  useEffect(() => {
    host.dataset.collapsed = String(collapsed);
    savePreferences({ collapsed, position });
  }, [collapsed, host, position]);

  useEffect(() => {
    const handleResize = () => {
      setPosition((current) => clampPosition(current, getViewport(), orbDiameter, orbMargin));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      moved: false,
      offsetX: event.clientX - position.x,
      offsetY: event.clientY - position.y,
      pointerId: event.pointerId,
    };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;

    const nextPosition = clampPosition(
      {
        x: event.clientX - drag.current.offsetX,
        y: event.clientY - drag.current.offsetY,
      },
      getViewport(),
      orbDiameter,
      orbMargin,
    );

    if (Math.abs(nextPosition.x - position.x) > 3 || Math.abs(nextPosition.y - position.y) > 3) {
      drag.current.moved = true;
    }
    setPosition(nextPosition);
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    const shouldExpand = !drag.current.moved;
    suppressNextClick.current = drag.current.moved;
    drag.current = null;
    if (shouldExpand) setCollapsed(false);
  };

  const handleOrbClick = () => {
    if (suppressNextClick.current) {
      suppressNextClick.current = false;
      return;
    }
    setCollapsed(false);
  };

  if (collapsed) {
    return (
      <button
        aria-label="Open Perception application navigation. Drag to reposition."
        className="orb"
        onClick={handleOrbClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{ '--orb-x': `${position.x}px`, '--orb-y': `${position.y}px` } as React.CSSProperties}
        type="button"
      >
        <Sparkles aria-hidden="true" size={23} strokeWidth={2.2} />
        <Grip aria-hidden="true" className="orb-grip" size={12} />
      </button>
    );
  }

  return (
    <nav aria-label="Perception applications" className="bar">
      <a className="home-link" href={siteRoot.href} title="Return to all applications">
        <span className="brand-mark">
          <Home aria-hidden="true" size={19} strokeWidth={2.4} />
        </span>
        <span className="brand-copy">
          <span className="brand-name">Perception</span>
          <span className="brand-action">All applications</span>
        </span>
      </a>

      <span aria-hidden="true" className="divider" />

      <div className="app-list">
        {applications.map((application) => {
          const Icon = application.icon;
          const isCurrent = currentApplication?.slug === application.slug;
          return (
            <a
              aria-current={isCurrent ? 'page' : undefined}
              className="app-link"
              href={new URL(application.path, siteRoot).href}
              key={application.slug}
              title={application.description}
            >
              <Icon aria-hidden="true" size={17} strokeWidth={2.15} />
              <span className="app-name">{application.name}</span>
            </a>
          );
        })}
      </div>

      <button
        aria-label="Collapse application navigation into a draggable button"
        className="collapse-button"
        onClick={() => setCollapsed(true)}
        title="Collapse navigation"
        type="button"
      >
        <PanelTopClose aria-hidden="true" size={19} />
      </button>
    </nav>
  );
}
