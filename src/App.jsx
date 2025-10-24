import { useMemo } from 'react';
import './App.css';
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

  const supportTasks = useMemo(
    () => tasks.filter((task) => task.tags.includes('Support')),
    [tasks],
  );

  const vulnerabilityCount = useMemo(
    () => tasks.filter((task) => task.tags.includes('Vulnerability')).length,
    [tasks],
  );

  const downtimeCount = useMemo(
    () => tasks.filter((task) => task.tags.includes('Downtime')).length,
    [tasks],
  );

  const urgentCount = useMemo(
    () => tasks.filter((task) => task.priority.toLowerCase() === 'urgent').length,
    [tasks],
  );

  const assignedTasks = useMemo(
    () => tasks.filter((task) => Boolean(task.assignee)),
    [tasks],
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
      <header className="header">
        <div>
          <p className="workspace-label">Developing workspace</p>
          <h1>Support &amp; Operations Dashboard</h1>
        </div>
        <p className="header-subtitle">
          Snapshot of ClickUp tasks that require customer-facing follow-up and operational risk
          mitigation.
        </p>
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

      <section className="panel" aria-labelledby="support-tasks-heading">
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

      <section className="panel" aria-labelledby="assignee-heading">
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
  );
}

export default App;
