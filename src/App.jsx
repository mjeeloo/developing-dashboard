import { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import logo from './assets/logo.svg';
import { useClickUpTasks } from './hooks/useClickUpTasks.js';

const PLACEHOLDER = '—';

const getInitials = (name) => {
  if (typeof name !== 'string' || name.trim().length === 0) {
    return '';
  }

  const segments = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (segments.length === 0) {
    return '';
  }

  const [first, second] = segments;
  if (!second) {
    return first.charAt(0).toUpperCase();
  }

  return `${first.charAt(0)}${second.charAt(0)}`.toUpperCase();
};

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

const MetricCard = ({ title, value, subtitle, className }) => (
  <article className={`metric-card surface-card${className ? ` ${className}` : ''}`}>
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

  useEffect(() => {
    const root = document.body;
    const INACTIVITY_MS = 4000;
    let timeoutId = null;

    const showCursor = () => {
      root.classList.remove('hide-cursor');
    };

    const scheduleHide = () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      timeoutId = window.setTimeout(() => {
        root.classList.add('hide-cursor');
      }, INACTIVITY_MS);
    };

    const onActivity = () => {
      showCursor();
      scheduleHide();
    };

    const events = ['mousemove', 'mousedown', 'touchstart', 'keydown', 'wheel'];
    events.forEach((event) => {
      window.addEventListener(event, onActivity, { passive: true });
    });

    // start timer initially
    scheduleHide();

    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      events.forEach((event) => {
        window.removeEventListener(event, onActivity);
      });
      root.classList.remove('hide-cursor');
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
    () =>
      activeTasks.filter(
        (task) => Array.isArray(task.tags) && task.tags.includes('Support'),
      ),
    [activeTasks],
  );

  const vulnerabilityCount = useMemo(
    () =>
      activeTasks.filter(
        (task) => Array.isArray(task.tags) && task.tags.includes('Vulnerability'),
      ).length,
    [activeTasks],
  );

  const downtimeCount = useMemo(
    () =>
      activeTasks.filter(
        (task) => Array.isArray(task.tags) && task.tags.includes('Downtime'),
      ).length,
    [activeTasks],
  );

  const urgentCount = useMemo(
    () =>
      activeTasks.filter(
        (task) =>
          typeof task.priority === 'string' && task.priority.toLowerCase() === 'urgent',
      ).length,
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
      if (!owner) {
        return accumulator;
      }

      const primaryAssignee = Array.isArray(task.assignees) && task.assignees.length > 0 ? task.assignees[0] : null;

      if (!accumulator[owner]) {
        accumulator[owner] = {
          tasks: [],
          avatar: primaryAssignee?.avatar ?? null,
        };
      }

      accumulator[owner].tasks.push(task);

      if (!accumulator[owner].avatar && primaryAssignee?.avatar) {
        accumulator[owner].avatar = primaryAssignee.avatar;
      }

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
            className={status === 'success' && urgentCount > 0 ? 'urgent-pulse' : ''}
          />
        </section>

        <section className="panel support-panel" aria-labelledby="support-tasks-heading">
          <div className="panel-header">
            <h2 id="support-tasks-heading">Support tasks</h2>
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
                  {supportTasks.map((task) => {
                    const primaryAssignee =
                      Array.isArray(task.assignees) && task.assignees.length > 0
                        ? task.assignees[0]
                        : null;
                    const assigneeName =
                      typeof task.assignee === 'string' && task.assignee.trim().length > 0
                        ? task.assignee
                        : null;
                    const displayName = assigneeName ?? primaryAssignee?.name ?? PLACEHOLDER;
                    const titleValue = displayName === PLACEHOLDER ? undefined : displayName;
                    const bubbleInitialSource = primaryAssignee?.name ?? assigneeName ?? '';
                    const deadlineValue = task.deadline ?? task.dueDate;
                    const deadlineDate = deadlineValue ? new Date(deadlineValue) : null;
                    const isValidDeadline = !!deadlineDate && !Number.isNaN(deadlineDate.getTime());
                    const nowY = now.getFullYear();
                    const nowM = now.getMonth();
                    const nowD = now.getDate();
                    const isSameDay =
                      isValidDeadline &&
                      deadlineDate.getFullYear() === nowY &&
                      deadlineDate.getMonth() === nowM &&
                      deadlineDate.getDate() === nowD;
                    const isOverdue = isValidDeadline && deadlineDate < now && !isSameDay;
                    const isDueToday = isSameDay;
                    const deadlineClass = isOverdue ? 'overdue' : (isDueToday ? 'due-today' : undefined);

                    return (
                      <tr key={task.id}>
                        <th scope="row" className="task-cell">
                          <span className="task-name">{task.name}</span>
                        </th>
                        <td className="status-cell">
                          <StatusBadge
                            status={task.status}
                            color={task.statusColor}
                            isClosed={task.isClosed}
                          />
                        </td>
                        <td className="assignee-column">
                          {primaryAssignee || assigneeName ? (
                            <div className="assignee-cell">
                              <div className="assignee-bubble" aria-hidden="true">
                                {primaryAssignee?.avatar ? (
                                  <img src={primaryAssignee.avatar} alt="" />
                                ) : (
                                  <span>{getInitials(bubbleInitialSource)}</span>
                                )}
                              </div>
                              <span className="assignee-name" title={titleValue}>
                                {displayName}
                              </span>
                            </div>
                          ) : (
                            PLACEHOLDER
                          )}
                        </td>
                        <td className="project-column">{task.projectName ?? PLACEHOLDER}</td>
                        <td className="priority-cell">
                          <PriorityBadge priority={task.priority} color={task.priorityColor} />
                        </td>
                        <td>
                          <span className={deadlineClass}>
                            {formatDeadline(deadlineValue)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </section>

        <section className="panel assignee-panel" aria-labelledby="assignee-heading">
          <div className="panel-header">
            <h2 id="assignee-heading">Tasks by assignee</h2>
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
                {Object.entries(tasksByAssignee).map(([assignee, assigneeData]) => {
                  const ownedTasks = assigneeData.tasks;
                  const mapTagsToDetails = (tags) =>
                    Array.isArray(tags)
                      ? tags.map((tag) => ({ name: tag, color: null }))
                      : [];

                  return (
                    <article className="assignee-card" key={assignee}>
                      <header>
                        <div className="assignee-header">
                          <div className="assignee-bubble assignee-bubble--large" aria-hidden="true">
                            {assigneeData.avatar ? (
                              <img src={assigneeData.avatar} alt="" />
                            ) : (
                              <span>{getInitials(assignee)}</span>
                            )}
                          </div>
                          <div className="assignee-header-text">
                            <h3>{assignee}</h3>
                            <span className="assignee-count">
                              {ownedTasks.length === 1 ? '1 task' : `${ownedTasks.length} tasks`}
                            </span>
                          </div>
                        </div>
                      </header>
                      <ul>
                        {ownedTasks.map((task) => {
                          const normalizedStatus = task.status?.trim();
                          const showStatus =
                            normalizedStatus && normalizedStatus.toLowerCase() !== 'to do';
                          const tags =
                            task.tagDetails && task.tagDetails.length > 0
                              ? task.tagDetails
                              : mapTagsToDetails(task.tags);

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
                                  title={task.priority ? `${task.priority} priority` : undefined}
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
                                  <span className="sr-only">
                                    {task.priority ? `${task.priority} priority` : 'Priority'}
                                  </span>
                                </span>
                              {tags.map((tag) => (
                                <span
                                className="tag-pill"
                                key={tag.name}
                                style={getTagStyles(tag.color)}
                                >
                                {tag.name}
                                </span>
                              ))}
                              {task.projectName ? (
                                <span className="meta-pill task-project">
                                  <svg
                                    className="project-icon"
                                    viewBox="0 0 16 16"
                                    role="img"
                                    aria-hidden="true"
                                  >
                                    <rect
                                      x="2"
                                      y="5.25"
                                      width="12"
                                      height="8.25"
                                      rx="2.1"
                                      stroke="currentColor"
                                      fill="none"
                                    />
                                    <path
                                      d="M2.1 7.4h11.8"
                                      stroke="currentColor"
                                      strokeLinecap="round"
                                    />
                                    <path
                                      d="M5.75 5.25V4.2M10.25 5.25V4.2"
                                      stroke="currentColor"
                                      strokeLinecap="round"
                                    />
                                    <path
                                      d="M5.75 4.2A2.35 2.35 0 0 1 8 1.85A2.35 2.35 0 0 1 10.25 4.2"
                                      stroke="currentColor"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      fill="none"
                                    />
                                    <path
                                      d="M6.7 9.3h2.6"
                                      stroke="currentColor"
                                      strokeLinecap="round"
                                    />
                                  </svg>
                                  <span>{task.projectName}</span>
                                </span>
                              ) : null}
                              {task.deadline ? (
                                (() => {
                                  const dl = new Date(task.deadline);
                                  const valid = !Number.isNaN(dl.getTime());
                                  const sameDay =
                                    valid &&
                                    dl.getFullYear() === now.getFullYear() &&
                                    dl.getMonth() === now.getMonth() &&
                                    dl.getDate() === now.getDate();
                                  const wasDue = valid && dl < now && !sameDay;
                                  const cls = wasDue ? 'overdue' : (sameDay ? 'due-today' : '');
                                  return (
                                    <span className={`meta-pill task-deadline${cls ? ` ${cls}` : ''}`}>
                                      <svg
                                        className="deadline-icon"
                                        viewBox="0 0 16 16"
                                        role="img"
                                        aria-hidden="true"
                                      >
                                        <rect
                                          x="2.25"
                                          y="3.5"
                                          width="11.5"
                                          height="10"
                                          rx="2.1"
                                          stroke="currentColor"
                                          fill="none"
                                        />
                                        <path
                                          d="M2.25 6.75h11.5"
                                          stroke="currentColor"
                                          strokeLinecap="round"
                                        />
                                        <path
                                          d="M5.25 1.75V3.5M10.75 1.75V3.5"
                                          stroke="currentColor"
                                          strokeLinecap="round"
                                        />
                                      </svg>
                                      <span className="sr-only">Due {formatDate(task.deadline)}</span>
                                      <span aria-hidden="true">{formatDate(task.deadline)}</span>
                                    </span>
                                  );
                                })()
                              ) : null}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </article>
                );
              })}
            </div>
          ) : null}
        </div>
        </section>
      </div>
    </div>
  );
}

export default App;
