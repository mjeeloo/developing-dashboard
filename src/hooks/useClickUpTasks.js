import { useEffect, useMemo, useState } from 'react';

const CLICKUP_API_BASE = 'https://api.clickup.com/api/v2';

const normalizeCustomFieldOptions = (field) => {
  const options = field?.type_config?.options;
  if (!Array.isArray(options)) {
    return new Map();
  }

  return new Map(
    options
      .map((option) => {
        const identifier = option?.id ?? option?.uuid;
        const label = option?.name ?? option?.label ?? option?.value;
        if (!identifier || !label) {
          return null;
        }
        return [identifier, label];
      })
      .filter(Boolean),
  );
};

const extractTagsFromCustomField = (task) => {
  const customFields = Array.isArray(task?.custom_fields) ? task.custom_fields : [];
  const tagsField = customFields.find((field) => {
    const fieldName = field?.name || field?.label;
    return typeof fieldName === 'string' && fieldName.toLowerCase() === 'tags';
  });

  if (!tagsField) {
    return [];
  }

  const { value } = tagsField;
  if (!value) {
    return [];
  }

  const optionLookup = normalizeCustomFieldOptions(tagsField);

  const mapOption = (option) => {
    if (!option) {
      return null;
    }

    if (typeof option === 'string') {
      return optionLookup.get(option) || option;
    }

    if (typeof option === 'object') {
      const optionId = option.id ?? option.uuid;
      const optionName = option.name ?? option.label ?? option.value;
      if (optionName) {
        return optionName;
      }
      if (optionId) {
        return optionLookup.get(optionId) || optionId;
      }
    }

    return null;
  };

  if (Array.isArray(value)) {
    return value.map(mapOption).filter(Boolean);
  }

  const mappedValue = mapOption(value);
  return mappedValue ? [mappedValue] : [];
};

const mapTask = (task) => {
  const assigneeNames = (task.assignees || [])
    .map((assignee) => assignee.username || assignee.email || assignee.id)
    .filter(Boolean);
  const dueDate = task.due_date && task.due_date !== '0' ? Number(task.due_date) : null;

  return {
    id: task.custom_id || task.id,
    name: task.name,
    status: task.status?.status || task.status?.type || 'Unknown',
    assignee: assigneeNames.length > 0 ? assigneeNames.join(', ') : null,
    dueDate: dueDate ? new Date(dueDate).toISOString() : null,
    priority: task.priority?.priority || 'None',
    tags: extractTagsFromCustomField(task),
    url: task.url,
  };
};

export function useClickUpTasks() {
  const [tasks, setTasks] = useState([]);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);

  const config = useMemo(
    () => ({
      token: import.meta.env.VITE_CLICKUP_API_TOKEN,
      listId: import.meta.env.VITE_CLICKUP_LIST_ID,
    }),
    [],
  );

  useEffect(() => {
    if (!config.token || !config.listId) {
      setStatus('error');
      setError(
        new Error(
          'Missing ClickUp configuration. Set VITE_CLICKUP_API_TOKEN and VITE_CLICKUP_LIST_ID in your environment.',
        ),
      );
      return;
    }

    const controller = new AbortController();

    async function fetchTasks() {
      setStatus('loading');
      setError(null);

      try {
        const searchParams = new URLSearchParams({
          include_closed: 'true',
          subtasks: 'true',
          order_by: 'created',
        });

        const response = await fetch(
          `${CLICKUP_API_BASE}/list/${config.listId}/task?${searchParams.toString()}`,
          {
            headers: {
              Authorization: config.token,
              'Content-Type': 'application/json',
            },
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`ClickUp API error (${response.status}): ${text}`);
        }

        const payload = await response.json();
        const normalizedTasks = (payload.tasks || []).map(mapTask);
        setTasks(normalizedTasks);
        setStatus('success');
      } catch (err) {
        if (err.name === 'AbortError') {
          return;
        }
        setStatus('error');
        setError(err);
      }
    }

    fetchTasks();

    return () => {
      controller.abort();
    };
  }, [config.listId, config.token]);

  return { tasks, status, error };
}
