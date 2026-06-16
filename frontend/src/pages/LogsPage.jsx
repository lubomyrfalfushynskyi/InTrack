import React, { useEffect, useState, useCallback } from 'react';
import { Card, Space, Select, Typography, Tag, Button, message } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { logsAPI } from '../services/api';
import SmartTable from '../components/SmartTable';

const { Title, Text } = Typography;
const ACTION = { create: { color: 'green', label: 'Створено' }, update: { color: 'blue', label: 'Оновлено' }, delete: { color: 'red', label: 'Видалено' } };
const ENTITIES = [['asset', 'Майно'], ['act', 'Акт'], ['user', 'Користувач'], ['department', 'Підрозділ'], ['location', 'Приміщення'], ['asset_type', 'Вид майна']];

const LogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 100, total: 0 });
  const [filters, setFilters] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await logsAPI.getAll({ page: pagination.current, limit: pagination.pageSize, ...filters }); setLogs(r.data.data); setPagination((p) => ({ ...p, total: r.data.pagination.total })); }
    catch (e) { message.error('Помилка'); } finally { setLoading(false); }
  }, [pagination.current, pagination.pageSize, filters]);
  useEffect(() => { load(); }, [load]);

  const columns = [
    { title: 'Час', dataIndex: 'timestamp', key: 'timestamp', width: 160, render: (t) => dayjs(t).format('DD.MM.YYYY HH:mm') },
    { title: 'Користувач', dataIndex: 'username', key: 'username', width: 150, render: (t, r) => t || r.full_name || '-' },
    { title: 'Дія', dataIndex: 'action_type', key: 'action_type', width: 120, render: (a) => { const x = ACTION[a]; return <Tag color={x && x.color}>{(x && x.label) || a}</Tag>; } },
    { title: 'Сутність', dataIndex: 'entity', key: 'entity', width: 140, render: (e) => { const f = ENTITIES.find(([k]) => k === e); return (f && f[1]) || e; } },
    { title: 'ID', dataIndex: 'entity_id', key: 'entity_id', width: 80 },
    { title: 'Значення', dataIndex: 'new_values', key: 'new_values', width: 300, render: (v) => v ? (typeof v === 'string' ? v : JSON.stringify(v)) : '' },
  ];

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div><Title level={2} style={{ margin: 0 }}>Журнал змін</Title><Text type="secondary">Аудит: акти + прямі правки адмінів</Text></div>
        <Card><Space wrap>
          <Select placeholder="Дія" allowClear style={{ width: 140 }} onChange={(v) => { setFilters((f) => ({ ...f, action_type: v })); setPagination((p) => ({ ...p, current: 1 })); }}>
            {Object.keys(ACTION).map((k) => <Select.Option key={k} value={k}>{ACTION[k].label}</Select.Option>)}
          </Select>
          <Select placeholder="Сутність" allowClear style={{ width: 170 }} onChange={(v) => { setFilters((f) => ({ ...f, entity: v })); setPagination((p) => ({ ...p, current: 1 })); }}>
            {ENTITIES.map(([k, l]) => <Select.Option key={k} value={k}>{l}</Select.Option>)}
          </Select>
          <Button icon={<ReloadOutlined />} onClick={load}>Оновити</Button>
        </Space></Card>
        <Card>
          <SmartTable
            columns={columns}
            dataSource={logs}
            rowKey="log_id"
            loading={loading}
            size="small"
            storageKey="logs"
            pagination={pagination}
            onChange={(pag) => setPagination((p) => ({ ...p, current: pag.current, pageSize: pag.pageSize }))}
          />
        </Card>
      </Space>
    </div>
  );
};

export default LogsPage;
