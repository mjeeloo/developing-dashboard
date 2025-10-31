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
            title="Vulnerability tasks"
            value={status === 'success' ? vulnerabilityCount : '—'}
            subtitle='Tagged with "Vulnerability"'
          />
          <MetricCard
            title="Downtime follow-ups"
            value={status === 'success' ? downtimeCount : '—'}
            subtitle='Tagged with "Downtime"'
          />
          <MetricCard
            title="Urgent priority"
            value={status === 'success' ? urgentCount : '—'}
            subtitle="Priority marked Urgent"
          />
        </section>

        <section className="panel support-panel" aria-labelledby="support-tasks-heading">
        <div className="panel-header">
          <h2 id="support-tasks-heading">Support tag focus</h2>
          <p className="panel-subtitle">All tasks labeled with the Support tag</p>
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
              No tasks with the Support tag are currently open.
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
                        <span className="status-pill">{task.status}</span>
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
          <h2 id="assignee-heading">Workload by assignee</h2>
          <p className="panel-subtitle">
            Grouped overview to see who owns which follow-ups across support and operations.
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
                    {ownedTasks.map((task) => (
                      <li key={task.id}>
                        <div>
                          <p className="task-name">{task.name}</p>
                          <p className="task-meta">
                            <span>{task.id}</span>
                            <span aria-hidden="true">•</span>
                            <span>{task.status}</span>
                          </p>
                        </div>
                        <div className="task-tags">
                          {task.tags.map((tag) => (
                            <span className="tag" key={tag}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      </li>
                    ))}
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
