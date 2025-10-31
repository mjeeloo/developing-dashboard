import { useEffect, useMemo, useRef, useState } from 'react';

const CLICKUP_API_BASE = 'https://api.clickup.com/api/v2';

const resolveApiBase = () => {
  const configuredBase = import.meta.env.VITE_CLICKUP_API_BASE_URL;
  if (typeof configuredBase === 'string' && configuredBase.trim().length > 0) {
    return configuredBase.trim();
  }

  if (import.meta.env.DEV) {
    return '/clickup-api';
  }

  return CLICKUP_API_BASE;
};

const REFRESH_INTERVAL_MS = 60_000;

const CLOSED_STATUS_VALUES = new Set([
  'closed',
  'done',
  'completed',
  'complete',
  'resolved',
]);

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
  const statusName = typeof task.status?.status === 'string' ? task.status.status.toLowerCase() : null;
  const statusTypeRaw = typeof task.status?.type === 'string' ? task.status.type.toLowerCase() : null;
  const normalizedStatusType = statusTypeRaw === 'done' ? 'closed' : statusTypeRaw;
  const isClosed = Boolean(
    (statusName && CLOSED_STATUS_VALUES.has(statusName)) ||
      (normalizedStatusType && CLOSED_STATUS_VALUES.has(normalizedStatusType)),
  );

  return {
    id: task.custom_id || task.id,
    name: task.name,
    status: task.status?.status || task.status?.type || 'Unknown',
    statusType: normalizedStatusType,
    isClosed,
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
  const controllerRef = useRef(null);
  const hasLoadedOnceRef = useRef(false);

  const config = useMemo(() => {
    return {
      token: import.meta.env.VITE_CLICKUP_API_TOKEN,
      listId: import.meta.env.VITE_CLICKUP_LIST_ID,
      apiBase: resolveApiBase(),
    };
  }, []);

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

    let isMounted = true;

    const fetchTasks = async () => {
      if (!isMounted) {
        return;
      }

      if (controllerRef.current) {
        controllerRef.current.abort();
      }

      const controller = new AbortController();
      controllerRef.current = controller;

      if (!hasLoadedOnceRef.current) {
        setStatus('loading');
      }
      setError(null);

      try {
        const searchParams = new URLSearchParams({
          include_closed: 'true',
          subtasks: 'true',
          order_by: 'updated',
        });

        const response = await fetch(
          `${config.apiBase}/list/${config.listId}/task?${searchParams.toString()}`,
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
        if (!isMounted) {
          return;
        }
        const normalizedTasks = (payload.tasks || []).map(mapTask);
        setTasks(normalizedTasks);
        setStatus('success');
        hasLoadedOnceRef.current = true;
      } catch (err) {
        if (err.name === 'AbortError') {
          return;
        }
        if (!isMounted) {
          return;
        }
        setStatus('error');
        setError(err);
      }
    };

    fetchTasks();
    const intervalId = window.setInterval(fetchTasks, REFRESH_INTERVAL_MS);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      if (controllerRef.current) {
        controllerRef.current.abort();
      }
    };
  }, [config.apiBase, config.listId, config.token]);

  return { tasks, status, error };
}
