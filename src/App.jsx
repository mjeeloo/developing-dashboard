import { useEffect, useMemo, useState } from 'react';
import './App.css';
import logo from './assets/logo.svg';
import { useClickUpTasks } from './hooks/useClickUpTasks.js';

const MetricCard = ({ title, value, subtitle }) => (
  <article className="metric-card">
    <h3>{title}</h3>
    <p className="metric-value">{value}</p>
    {subtitle ? <p className="metric-subtitle">{subtitle}</p> : null}
  </article>
);

const formatDate = (value) => {
  if (!value) return 'No due date';
  const date = new Date(value);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(date);
};

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

const getStatusStyles = (color) => {
  if (!color) {
    return {};
  }

  return {
    color,
    borderColor: withAlpha(color, 0.45) || color,
    backgroundColor: withAlpha(color, 0.18) || color,
  };
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
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
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

  return (
    <div className="app">
      <div className="app-grid">
        <header className="header">
          <div className="header-image header-card" role="img" aria-label="TV dashboard header image">
            <img src={logo} alt="" />
          </div>
          <div className="header-time header-card" aria-live="polite">
            <p className="time-label">Current time</p>
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
                    <th scope="col">Owner</th>
                    <th scope="col">Status</th>
                    <th scope="col">Priority</th>
                    <th scope="col">Due</th>
                  </tr>
                </thead>
                <tbody>
                  {supportTasks.map((task) => (
                  <tr key={task.id}>
                    <th scope="row">
                      <span className="task-id">{task.id}</span>
                      <span className="task-name">{task.name}</span>
                    </th>
                    <td>{task.assignee ?? 'Unassigned'}</td>
                    <td>
                      <span className="status-pill" style={getStatusStyles(task.statusColor)}>
                        {task.status?.toUpperCase()}
                      </span>
                    </td>
                    <td>{task.priority}</td>
                    <td>{formatDate(task.dueDate)}</td>
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
            <div className="assignee-grid">
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
                      const statusLabel = normalizedStatus ? normalizedStatus.toUpperCase() : '';

                      return (
                        <li key={task.id}>
                          <div className="assignee-task-heading">
                            <p className="task-name">{task.name}</p>
                          </div>
                          <div className="task-meta-row">
                            {showStatus ? (
                              <span className="status-pill" style={getStatusStyles(task.statusColor)}>
                                {statusLabel}
                              </span>
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
