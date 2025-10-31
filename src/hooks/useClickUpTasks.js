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
const PAGE_SIZE = 100;

const CLOSED_STATUS_VALUES = new Set([
  'closed',
  'done',
  'completed',
  'complete',
  'resolved',
]);

const normalizeString = (value) => {
  if (typeof value !== 'string') {
    return '';
  }

  return value
    .normalize('NFKD')
    .replace(/[\u200d\ufe0f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .toLowerCase();
};

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

const extractTagsFromCustomField = (task, { tagsFieldId } = {}) => {
  const customFields = Array.isArray(task?.custom_fields) ? task.custom_fields : [];
  const normalizedId = typeof tagsFieldId === 'string' ? tagsFieldId.trim() : '';
  const tagsField = customFields.find((field) => {
    if (!field) {
      return false;
    }

    const fieldId = field.id || field.uuid;
    if (normalizedId && fieldId === normalizedId) {
      return true;
    }

    const fieldType = normalizeString(field.type);
    const fieldName = normalizeString(field.name || field.label);
    const isLabelsField = fieldType === 'labels';

    if (fieldName === 'tags') {
      return true;
    }

    if (isLabelsField && fieldName.includes('tag')) {
      return true;
    }

    return false;
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

const DEFAULT_CUSTOM_FIELD_IDS = {
  project: 'a8807a9a-5de6-4cbb-9213-17071a2962b3',
  deadline: 'de549afd-be31-445f-8d21-6ab7c794ea08',
};

const findCustomField = (customFields, { id, name }) => {
  if (!Array.isArray(customFields)) {
    return null;
  }

  const normalizedId = typeof id === 'string' ? id.trim() : '';
  const normalizedName = normalizeString(name);

  return (
    customFields.find((field) => {
      if (!field) {
        return false;
      }

      const fieldId = field.id || field.uuid;
      if (normalizedId && fieldId === normalizedId) {
        return true;
      }

      if (!normalizedName) {
        return false;
      }

      const fieldName = normalizeString(field.name || field.label);
      return fieldName === normalizedName;
    }) || null
  );
};

const mapRelationshipFieldValue = (field) => {
  if (!field) {
    return null;
  }

  const mapEntry = (entry) => {
    if (!entry) {
      return null;
    }

    if (typeof entry === 'string') {
      return entry;
    }

    if (typeof entry === 'object') {
      return entry.name || entry.label || entry.value || entry.id || null;
    }

    return null;
  };

  const { value } = field;
  if (Array.isArray(value)) {
    const mapped = value.map(mapEntry).filter(Boolean);
    return mapped.length > 0 ? mapped.join(', ') : null;
  }

  return mapEntry(value);
};

const normalizeDateValue = (value) => {
  if (!value) {
    return null;
  }

  const parseTimestamp = (input) => {
    if (input == null) {
      return null;
    }

    if (typeof input === 'number') {
      if (!Number.isFinite(input)) {
        return null;
      }
      return new Date(input).toISOString();
    }

    if (typeof input === 'string') {
      const trimmed = input.trim();
      if (!trimmed) {
        return null;
      }

      if (/^-?\d+$/.test(trimmed)) {
        const numeric = Number(trimmed);
        if (Number.isFinite(numeric)) {
          return new Date(numeric).toISOString();
        }
      }

      const parsed = Date.parse(trimmed);
      if (!Number.isNaN(parsed)) {
        return new Date(parsed).toISOString();
      }
    }

    return null;
  };

  if (Array.isArray(value)) {
    for (const entry of value) {
      const normalized = normalizeDateValue(entry);
      if (normalized) {
        return normalized;
      }
    }
    return null;
  }

  if (typeof value === 'object') {
    const candidateKeys = ['start', 'start_date', 'date', 'due_date', 'end', 'end_date', 'value'];

    for (const key of candidateKeys) {
      if (!(key in value)) {
        continue;
      }

      const candidate = value[key];
      if (candidate === value) {
        continue;
      }

      const normalized = normalizeDateValue(candidate);
      if (normalized) {
        return normalized;
      }
    }

    return null;
  }

  return parseTimestamp(value);
};

const mapDateFieldValue = (field) => {
  if (!field) {
    return null;
  }

  return normalizeDateValue(field.value);
};

const mapTask = (task, options = {}) => {
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
  const statusLabel = task.status?.status || task.status?.type || 'Unknown';

  let priorityLabel = 'None';
  let priorityColor = null;
  const rawPriority = task.priority;

  if (typeof rawPriority === 'string') {
    priorityLabel = rawPriority;
  } else if (rawPriority && typeof rawPriority === 'object') {
    priorityLabel =
      rawPriority.priority ||
      rawPriority.label ||
      rawPriority.value ||
      rawPriority.name ||
      rawPriority.id ||
      priorityLabel;
    priorityColor = rawPriority.color || null;
  }

  priorityLabel = priorityLabel || 'None';

  const customFields = Array.isArray(task?.custom_fields) ? task.custom_fields : [];
  const projectField = findCustomField(customFields, {
    id: options.projectFieldId || DEFAULT_CUSTOM_FIELD_IDS.project,
    name: 'project',
  });
  const deadlineField = findCustomField(customFields, {
    id: options.deadlineFieldId || DEFAULT_CUSTOM_FIELD_IDS.deadline,
    name: 'deadline',
  });

  return {
    id: task.custom_id || task.id,
    name: task.name,
    status: statusLabel,
    statusColor: task.status?.color || null,
    statusType: normalizedStatusType,
    isClosed,
    assignee: assigneeNames.length > 0 ? assigneeNames.join(', ') : null,
    dueDate: dueDate ? new Date(dueDate).toISOString() : null,
    priority: priorityLabel,
    priorityColor,
    tags: extractTagsFromCustomField(task, options),
    project: mapRelationshipFieldValue(projectField),
    deadline: mapDateFieldValue(deadlineField),
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
      tagsFieldId: import.meta.env.VITE_CLICKUP_TAGS_FIELD_ID,
      projectFieldId: import.meta.env.VITE_CLICKUP_PROJECT_FIELD_ID,
      deadlineFieldId: import.meta.env.VITE_CLICKUP_DEADLINE_FIELD_ID,
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
        const collectedTasks = [];
        let page = 0;
        let reachedLastPage = false;

        while (!reachedLastPage) {
          const searchParams = new URLSearchParams({
            include_closed: 'true',
            subtasks: 'true',
            order_by: 'updated',
            page: String(page),
            page_size: String(PAGE_SIZE),
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

          const pageTasks = Array.isArray(payload.tasks) ? payload.tasks : [];
          collectedTasks.push(...pageTasks);

          const lastPageFlag =
            payload?.last_page === true ||
            payload?.last_page === 'true' ||
            payload?.last_page === 1;

          reachedLastPage = lastPageFlag || pageTasks.length < PAGE_SIZE;
          page += 1;
        }

        const normalizedTasks = collectedTasks.map((task) => mapTask(task, config));
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
