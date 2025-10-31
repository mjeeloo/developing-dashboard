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
        return [
          identifier,
          {
            label,
            color: option?.color ?? option?.color_hex ?? null,
          },
        ];
      })
      .filter(Boolean),
  );
};

const extractTagsFromCustomField = (customFields, { tagsFieldId } = {}) => {
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
    return { tags: [], tagDetails: [] };
  }

  const { value } = tagsField;
  if (!value) {
    return { tags: [], tagDetails: [] };
  }

  const optionLookup = normalizeCustomFieldOptions(tagsField);

  const tags = [];
  const tagDetails = [];

  const addTag = (label, color) => {
    if (!label) {
      return;
    }
    tags.push(label);
    tagDetails.push({ name: label, color: color ?? null });
  };

  const mapOption = (option) => {
    if (!option) {
      return null;
    }

    if (typeof option === 'string') {
      const details = optionLookup.get(option);
      const label = details?.label ?? option;
      addTag(label, details?.color ?? null);
      return label;
    }

    if (typeof option === 'object') {
      const optionId = option.id ?? option.uuid;
      const optionName = option.name ?? option.label ?? option.value;
      const details = optionId ? optionLookup.get(optionId) : null;
      if (optionName) {
        addTag(optionName, details?.color ?? option.color ?? option.color_hex ?? null);
        return optionName;
      }
      if (optionId) {
        const fallback = optionLookup.get(optionId);
        const label = fallback?.label ?? optionId;
        addTag(label, fallback?.color ?? null);
        return label;
      }
    }

    return null;
  };

  if (Array.isArray(value)) {
    value.forEach(mapOption);
    return { tags, tagDetails };
  }

  mapOption(value);
  return { tags, tagDetails };
};

const findCustomField = (customFields, { id, nameIncludes, type } = {}) => {
  const normalizedId = typeof id === 'string' ? id.trim() : '';
  const normalizedName = normalizeString(nameIncludes);
  const normalizedType = normalizeString(type);

  return customFields.find((field) => {
    if (!field) {
      return false;
    }

    const fieldId = field.id || field.uuid;
    if (normalizedId && fieldId === normalizedId) {
      return true;
    }

    const fieldType = normalizeString(field.type);
    if (normalizedType && fieldType !== normalizedType) {
      return false;
    }

    const fieldName = normalizeString(field.name || field.label);
    if (normalizedName && fieldName.includes(normalizedName)) {
      return true;
    }

    return false;
  });
};

const extractProjectFromCustomField = (customFields, { projectFieldId } = {}) => {
  const projectField = findCustomField(customFields, {
    id: projectFieldId,
    nameIncludes: 'project',
    type: 'list_relationship',
  });

  if (!projectField || projectField.value == null) {
    return null;
  }

  const rawValue = projectField.value;
  const values = Array.isArray(rawValue) ? rawValue : [rawValue];

  const labels = values
    .map((value) => {
      if (!value) {
        return null;
      }

      if (typeof value === 'string') {
        return value;
      }

      if (typeof value === 'object') {
        return value.name || value.label || value.value || value.id || null;
      }

      return null;
    })
    .filter(Boolean);

  if (labels.length === 0) {
    return null;
  }

  return labels.join(', ');
};

const extractDeadlineFromCustomField = (customFields, { deadlineFieldId } = {}) => {
  const deadlineField = findCustomField(customFields, {
    id: deadlineFieldId,
    nameIncludes: 'deadline',
    type: 'date',
  });

  if (!deadlineField || deadlineField.value == null || deadlineField.value === '0') {
    return null;
  }

  const rawValue = deadlineField.value;

  const normalizeValue = (value) => {
    if (value == null || value === '0') {
      return null;
    }

    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'string') {
      const numeric = Number(value);
      if (!Number.isNaN(numeric) && numeric > 0) {
        return numeric;
      }
      const parsedDate = Date.parse(value);
      return Number.isNaN(parsedDate) ? null : parsedDate;
    }

    if (typeof value === 'object') {
      return normalizeValue(value.start ?? value.value ?? value.end ?? value.date ?? null);
    }

    return null;
  };

  const normalizedValue = normalizeValue(rawValue);
  if (!normalizedValue) {
    return null;
  }

  return new Date(normalizedValue).toISOString();
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

  const customFields = Array.isArray(task?.custom_fields) ? task.custom_fields : [];
  const { tags, tagDetails } = extractTagsFromCustomField(customFields, options);

  return {
    id: task.custom_id || task.id,
    name: task.name,
    status: task.status?.status || task.status?.type || 'Unknown',
    statusType: normalizedStatusType,
    statusColor: task.status?.color || null,
    isClosed,
    assignee: assigneeNames.length > 0 ? assigneeNames.join(', ') : null,
    dueDate: dueDate ? new Date(dueDate).toISOString() : null,
    priority: task.priority?.priority || 'None',
    priorityColor: task.priority?.color || null,
    tags,
    tagDetails,
    projectName: extractProjectFromCustomField(customFields, options),
    deadline: extractDeadlineFromCustomField(customFields, options),
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
