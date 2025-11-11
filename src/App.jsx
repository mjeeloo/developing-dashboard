import { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import logo from './assets/logo.svg';
import { useClickUpTasks } from './hooks/useClickUpTasks.js';

const PLACEHOLDER = '—';

const capitalizeWords = (value) => {
  if (typeof value !== 'string') {
    return '';
  }

  const formatSegment = (segment) => {
    if (!segment) {
      return segment;
    }

    if (/^[A-Z0-9]+$/.test(segment)) {
      return segment;
    }

    return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase();
  };

  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.split('-').map(formatSegment).join('-'))
    .join(' ');
};

const normalizeHexColor = (value) => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (/^#([0-9a-f]{3})$/i.test(trimmed)) {
    return `#${trimmed
      .slice(1)
      .split('')
      .map((char) => char + char)
      .join('')}`.toUpperCase();
  }

  if (/^#([0-9a-f]{6})$/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  if (/^#([0-9a-f]{8})$/i.test(trimmed)) {
    return trimmed.slice(0, 7).toUpperCase();
  }

  return null;
};

const hexToRgba = (hex, alpha) => {
  const normalized = normalizeHexColor(hex);
  if (!normalized) {
    return null;
  }

  const numeric = normalized.slice(1);
  const r = parseInt(numeric.slice(0, 2), 16);
  const g = parseInt(numeric.slice(2, 4), 16);
  const b = parseInt(numeric.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const createChipStyle = (accentColor, fallbackAccent) => {
  const resolvedAccent = accentColor || fallbackAccent;
  const normalizedAccent = normalizeHexColor(resolvedAccent);
  const style = { '--chip-accent': resolvedAccent || '#38BDF8' };

  if (normalizedAccent) {
    style['--chip-bg'] = hexToRgba(normalizedAccent, 0.2);
    style['--chip-border'] = hexToRgba(normalizedAccent, 0.35);
  }

  return style;
};

const PRIORITY_FALLBACK_COLORS = {
  urgent: '#EF4444',
  high: '#F97316',
  normal: '#38BDF8',
  medium: '#38BDF8',
  low: '#22C55E',
  none: '#64748B',
};

const getPriorityPresentation = (priority, color) => {
  const normalized = typeof priority === 'string' ? priority.trim().toLowerCase() : '';
  const key = normalized || 'none';
  const label = capitalizeWords(key) || 'None';
  const fallbackAccent = PRIORITY_FALLBACK_COLORS[key] || PRIORITY_FALLBACK_COLORS.none;
  const accent = normalizeHexColor(color) || fallbackAccent;

  return {
    label,
    style: createChipStyle(accent, fallbackAccent),
  };
};

const deriveStatusFallbackColor = (status, isClosed) => {
  if (isClosed) {
    return '#22C55E';
  }

  const normalized = typeof status === 'string' ? status.toLowerCase() : '';
  if (/block|hold|wait/i.test(normalized)) {
    return '#F97316';
  }
  if (/review|approval/i.test(normalized)) {
    return '#F59E0B';
  }
  if (/progress|working|doing/i.test(normalized)) {
    return '#38BDF8';
  }
  if (/todo|backlog|ready/i.test(normalized)) {
    return '#6366F1';
  }

  return '#38BDF8';
};

const useMasonryLayout = (containerRef, dependencyKey) => {
  useEffect(() => {
    const grid = containerRef.current;
    if (
      !grid ||
      typeof ResizeObserver === 'undefined' ||
      typeof MutationObserver === 'undefined'
    ) {
      return undefined;
    }

    const baseRowHeight = 2;
    let animationFrameId = null;

    const scheduleLayout = () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }

      animationFrameId = requestAnimationFrame(() => {
        animationFrameId = null;
        const cards = Array.from(grid.children).filter((node) =>
          node instanceof HTMLElement,
        );

        if (cards.length === 0) {
          grid.style.removeProperty('grid-auto-rows');
          return;
        }

        const computedStyles = getComputedStyle(grid);
        const gapValue = computedStyles.rowGap || computedStyles.gap || '0';
        const gap = Number.parseFloat(gapValue) || 0;

        grid.style.gridAutoRows = `${baseRowHeight}px`;

        cards.forEach((card) => {
          const totalHeight = card.getBoundingClientRect().height;
          const span = Math.max(
            1,
            Math.ceil((totalHeight + gap) / (baseRowHeight + gap)),
          );
          card.style.gridRowEnd = `span ${span}`;
        });
      });
    };

    const resizeObserver = new ResizeObserver(() => {
      scheduleLayout();
    });

    resizeObserver.observe(grid);

    const mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            resizeObserver.observe(node);
          }
        });
        mutation.removedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            resizeObserver.unobserve(node);
            node.style.removeProperty('grid-row-end');
          }
        });
      });

      scheduleLayout();
    });

    mutationObserver.observe(grid, { childList: true });

    Array.from(grid.children).forEach((child) => {
      if (child instanceof HTMLElement) {
        resizeObserver.observe(child);
      }
    });

    scheduleLayout();

    return () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }

      mutationObserver.disconnect();
      resizeObserver.disconnect();
      grid.style.removeProperty('grid-auto-rows');

      Array.from(grid.children).forEach((node) => {
        if (node instanceof HTMLElement) {
          node.style.removeProperty('grid-row-end');
        }
      });
    };
  }, [containerRef, dependencyKey]);
};

const getStatusPresentation = (status, color, isClosed) => {
  const label = capitalizeWords(status || 'Unknown');
  const fallbackAccent = deriveStatusFallbackColor(status, isClosed);
  const accent = normalizeHexColor(color) || fallbackAccent;

  return {
    label,
    style: createChipStyle(accent, fallbackAccent),
  };
};

const PriorityBadge = ({ priority, color }) => {
  const { label, style } = getPriorityPresentation(priority, color);
  return (
    <span className="chip chip-priority" style={style}>
      <span className="chip-flag" aria-hidden="true">
        ⚑
      </span>
      <span className="chip-label">{label}</span>
    </span>
  );
};

const StatusBadge = ({ status, color, isClosed }) => {
  const { label, style } = getStatusPresentation(status, color, isClosed);
  return (
    <span className="chip chip-status" style={style}>
      <span className="chip-dot" aria-hidden="true" />
      <span className="chip-label">{label}</span>
    </span>
  );
};

const MetricCard = ({ title, value, subtitle }) => (
  <article className="metric-card surface-card">
    <h3>{title}</h3>
    <p className="metric-value">{value}</p>
    {subtitle ? <p className="metric-subtitle">{subtitle}</p> : null}
  </article>
);

const formatShortDate = (value, fallback) => {
  if (!value) {
    return fallback;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(date);
};

const formatDate = (value) => formatShortDate(value, 'No due date');

const formatDeadline = (value) => formatShortDate(value, PLACEHOLDER);

const clampAlpha = (value) => {
  if (Number.isNaN(value) || value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
};

const withAlpha = (color, alpha = 0.2) => {
  if (typeof color !== 'string' || color.length === 0) {
    return null;
  }

  const normalized = color.trim();
  if (!normalized.startsWith('#')) {
    return normalized;
  }

  let hex = normalized.slice(1);
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((char) => `${char}${char}`)
      .join('');
  }

  if (hex.length !== 6) {
    return normalized;
  }

  const parsed = Number.parseInt(hex, 16);
  if (Number.isNaN(parsed)) {
    return normalized;
  }

  const r = (parsed >> 16) & 255;
  const g = (parsed >> 8) & 255;
  const b = parsed & 255;

  return `rgba(${r}, ${g}, ${b}, ${clampAlpha(alpha)})`;
};

const getPriorityStyles = (color) => {
  if (!color) {
    return {};
  }

  return {
    color,
    borderColor: withAlpha(color, 0.35) || color,
    backgroundColor: withAlpha(color, 0.16) || color,
  };
};

const getTagStyles = (color) => {
  if (!color) {
    return {};
  }

  return {
    color,
    borderColor: withAlpha(color, 0.35) || color,
    backgroundColor: withAlpha(color, 0.18) || color,
  };
};

function App() {
  const { tasks, status, error } = useClickUpTasks();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(new Date());
    }, 1000 * 30);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  const currentTime = useMemo(
    () =>
      new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(now),
    [now],
  );

  const currentDate = useMemo(
    () =>
      new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }).format(now),
    [now],
  );

  const activeTasks = useMemo(
    () => tasks.filter((task) => !task.isClosed),
    [tasks],
  );

  const supportTasks = useMemo(
    () => activeTasks.filter((task) => task.tags.includes('Support')),
    [activeTasks],
  );

  const vulnerabilityCount = useMemo(
    () => activeTasks.filter((task) => task.tags.includes('Vulnerability')).length,
    [activeTasks],
  );

  const downtimeCount = useMemo(
    () => activeTasks.filter((task) => task.tags.includes('Downtime')).length,
    [activeTasks],
  );

  const urgentCount = useMemo(
    () => activeTasks.filter((task) => task.priority.toLowerCase() === 'urgent').length,
    [activeTasks],
  );

  const assignedTasks = useMemo(
    () =>
      activeTasks.filter((task) => {
        return Boolean(task.assignee);
      }),
    [activeTasks],
  );

  const tasksByAssignee = useMemo(() => {
    return assignedTasks.reduce((accumulator, task) => {
      const owner = task.assignee;
      if (!accumulator[owner]) {
        accumulator[owner] = [];
      }
      accumulator[owner].push(task);
      return accumulator;
    }, {});
  }, [assignedTasks]);

  const assigneeGridRef = useRef(null);

  const masonryDependencyKey = useMemo(() => {
    return Object.entries(tasksByAssignee)
      .map(([assignee, ownedTasks]) => `${assignee}:${ownedTasks.length}`)
      .join('|');
  }, [tasksByAssignee]);

  useMasonryLayout(assigneeGridRef, masonryDependencyKey);

  return (
    <div className="app">
      <div className="app-grid">
        <header className="header">
          <div className="header-image header-card" role="img" aria-label="TV dashboard header image">
            <img src={logo} alt="" />
          </div>
          <div className="header-time clock-card surface-card" aria-live="polite">
            <h3 className="time-label">Current time</h3>
            <p className="time-value">{currentTime}</p>
            <p className="time-date">{currentDate}</p>
          </div>
        </header>
        <section className="metrics" aria-label="Key risk indicators">
          <MetricCard
            title="Vulnerabilities"
            value={status === 'success' ? vulnerabilityCount : '—'}
            subtitle='Tagged with "Vulnerability"'
          />
          <MetricCard
            title="Downtime follow-ups"
            value={status === 'success' ? downtimeCount : '—'}
            subtitle='Tagged with "Downtime"'
          />
          <MetricCard
            title="Urgent priority tasks"
            value={status === 'success' ? urgentCount : '—'}
            subtitle='Priority set to "Urgent"'
          />
        </section>

        <section className="panel support-panel" aria-labelledby="support-tasks-heading">
        <div className="panel-header">
          <h2 id="support-tasks-heading">Support tasks</h2>
          <p className="panel-subtitle">All tasks labeled with the "Support" tag</p>
        </div>
        <div className="panel-body">
          {status === 'loading' ? (
            <p className="status-message" role="status">
              Loading tasks from ClickUp…
            </p>
          ) : null}
          {status === 'error' ? (
            <p className="status-message error" role="alert">
              {error?.message ?? 'Unable to load tasks from ClickUp.'}
            </p>
          ) : null}
          {status === 'success' && supportTasks.length === 0 ? (
            <p className="status-message" role="status">
              No tasks with the 'Support' tag are currently open.
            </p>
          ) : null}
          {supportTasks.length > 0 ? (
            <div className="table-wrapper">
              <table className="support-table">
                <thead>
                  <tr>
                    <th scope="col">Task</th>
                    <th scope="col">Status</th>
                    <th scope="col" className="assignee-column">Assignee</th>
                    <th scope="col" className="project-column">Project</th>
                    <th scope="col">Priority</th>
                    <th scope="col">Deadline</th>
                  </tr>
                </thead>
                <tbody>
                  {supportTasks.map((task) => (
                  <tr key={task.id}>
                    <th scope="row" className="task-cell">
                      <span className="task-name">{task.name}</span>
                    </th>
                    <td className="status-cell">
                      <StatusBadge status={task.status} color={task.statusColor} isClosed={task.isClosed} />
                    </td>
                    <td className="assignee-column">{task.assignee ?? PLACEHOLDER}</td>
                    <td className="project-column">{task.projectName ?? PLACEHOLDER}</td>
                    <td className="priority-cell">
                      <PriorityBadge priority={task.priority} color={task.priorityColor} />
                    </td>
                    <td>{formatDeadline(task.deadline ?? task.dueDate)}</td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          ) : null}
        </div>
        </section>

        <section className="panel assignee-panel" aria-labelledby="assignee-heading">
        <div className="panel-header">
          <h2 id="assignee-heading">Tasks by assignee</h2>
          <p className="panel-subtitle">
            Overview of all tasks by assignee
          </p>
        </div>
        <div className="panel-body">
          {status === 'loading' ? (
            <p className="status-message" role="status">
              Loading tasks from ClickUp…
            </p>
          ) : null}
          {status === 'error' ? (
            <p className="status-message error" role="alert">
              {error?.message ?? 'Unable to load tasks from ClickUp.'}
            </p>
          ) : null}
          {status === 'success' && Object.keys(tasksByAssignee).length === 0 ? (
            <p className="status-message" role="status">
              No tasks available for the workload overview.
            </p>
          ) : null}
          {Object.keys(tasksByAssignee).length > 0 ? (
            <div className="assignee-grid" ref={assigneeGridRef}>
              {Object.entries(tasksByAssignee).map(([assignee, ownedTasks]) => (
                <article className="assignee-card" key={assignee}>
                  <header>
                    <h3>{assignee}</h3>
                    <span className="assignee-count">{ownedTasks.length} tasks</span>
                  </header>
                  <ul>
                    {ownedTasks.map((task) => {
                      const normalizedStatus = task.status?.trim();
                      const showStatus =
                        normalizedStatus && normalizedStatus.toLowerCase() !== 'to do';

                      return (
                        <li key={task.id} className="assignee-task-card">
                          <div className="assignee-task-heading">
                            <p className="task-name">{task.name}</p>
                          </div>
                          <div className="task-meta-row">
                            {showStatus ? (
                              <StatusBadge
                                status={task.status}
                                color={task.statusColor}
                                isClosed={task.isClosed}
                              />
                            ) : null}
                          <span
                            className="priority-chip"
                            style={getPriorityStyles(task.priorityColor)}
                            title={`${task.priority} priority`}
                          >
                            <svg
                              className="priority-flag-icon"
                              viewBox="0 0 16 16"
                              role="img"
                              aria-hidden="true"
                            >
                              <path
                                d="M4 2.25a.75.75 0 0 1 .75-.75h6.147a.75.75 0 0 1 .534 1.284L9.414 5l2.017 2.216A.75.75 0 0 1 10.896 8.5H5.5v5.75a.75.75 0 0 1-1.5 0Z"
                                fill="currentColor"
                              />
                            </svg>
                            <span className="sr-only">{`${task.priority} priority`}</span>
                          </span>
                          {(task.tagDetails && task.tagDetails.length > 0
                            ? task.tagDetails
                            : task.tags.map((tag) => ({ name: tag, color: null }))
                          ).map((tag) => (
                            <span className="tag-pill" key={tag.name} style={getTagStyles(tag.color)}>
                              {tag.name}
                            </span>
                          ))}
                          {task.projectName ? (
                            <span className="meta-pill task-project">{task.projectName}</span>
                          ) : null}
                          {task.deadline ? (
                            <span className="meta-pill task-deadline">Due {formatDate(task.deadline)}</span>
                          ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </article>
              ))}
            </div>
          ) : null}
        </div>
        </section>
      </div>
    </div>
  );
}

export default App;
