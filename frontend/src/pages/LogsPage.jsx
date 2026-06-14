import React, { useEffect, useState } from 'react';
import {
  Table,
  Card,
  Space,
  Select,
  Typography,
  Tag,
  DatePicker,
  Button,
  message,
} from 'antd';
import {
  ReloadOutlined,
  DownloadOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

const LogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 100,
    total: 0,
  });
  const [filters, setFilters] = useState({});

  useEffect(() => {
    fetchLogs();
  }, [pagination.current, pagination.pageSize, filters]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
        ...filters,
      };

      const response = await axios.get('/api/logs', {
        params,
        headers: { Authorization: `Bearer ${token}` },
      });

      setLogs(response.data.data);
      setPagination((prev) => ({
        ...prev,
        total: response.data.pagination.total,
      }));
    } catch (error) {
      message.error('Помилка завантаження логів');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value || undefined }));
    setPagination((prev) => ({ ...prev, current: 1 }));
  };

  const handleExportCSV = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/logs/export/csv', {
        params: filters,
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `logs-${dayjs().format('YYYY-MM-DD-HH-mm')}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      message.error('Помилка при експорті');
      console.error(error);
    }
  };

  const columns = [
    {
      title: 'Час',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 180,
      render: (timestamp) => new Date(timestamp).toLocaleString('uk-UA'),
      sorter: true,
    },
    {
      title: 'Користувач',
      dataIndex: 'username',
      key: 'username',
      width: 120,
      render: (text, record) => text || record.full_name || '-',
    },
    {
      title: 'Дія',
      dataIndex: 'action_type',
      key: 'action_type',
      width: 100,
      render: (action) => {
        const colors = {
          create: 'green',
          update: 'blue',
          delete: 'red',
          view: 'default',
        };
        const labels = {
          create: 'Створено',
          update: 'Оновлено',
          delete: 'Видалено',
          view: 'Переглянуто',
        };
        return <Tag color={colors[action]}>{labels[action]}</Tag>;
      },
    },
    {
      title: 'Сутність',
      dataIndex: 'entity',
      key: 'entity',
      width: 100,
    },
    {
      title: 'ID сутності',
      dataIndex: 'entity_id',
      key: 'entity_id',
      width: 80,
    },
    {
      title: 'IP адреса',
      dataIndex: 'ip_address',
      key: 'ip_address',
      width: 130,
      render: (ip) => ip || '-',
    },
  ];

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={2} style={{ margin: 0 }}>
              Логи системи
            </Title>
            <Text type="secondary">Аудит дій користувачів</Text>
          </div>
          <Button icon={<DownloadOutlined />} onClick={handleExportCSV}>
            Експорт CSV
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <Space wrap>
            <Select
              placeholder="Тип дії"
              allowClear
              style={{ width: 120 }}
              onChange={(value) => handleFilterChange('action_type', value)}
            >
              <Option value="create">Створено</Option>
              <Option value="update">Оновлено</Option>
              <Option value="delete">Видалено</Option>
              <Option value="view">Переглянуто</Option>
            </Select>

            <Select
              placeholder="Сутність"
              allowClear
              style={{ width: 120 }}
              onChange={(value) => handleFilterChange('entity', value)}
            >
              <Option value="assets">Майно</Option>
              <Option value="acts">Акти</Option>
              <Option value="users">Користувачі</Option>
              <Option value="departments">Підрозділи</Option>
              <Option value="locations">Локації</Option>
            </Select>

            <Button icon={<ReloadOutlined />} onClick={fetchLogs}>
              Оновити
            </Button>
          </Space>
        </Card>

        {/* Table */}
        <Card>
          <Table
            columns={columns}
            dataSource={logs}
            rowKey="log_id"
            loading={loading}
            pagination={{
              ...pagination,
              showSizeChanger: true,
              showTotal: (total) => `Всього записів: ${total}`,
              onChange: (newPage) => setPagination((prev) => ({ ...prev, current: newPage })),
            }}
            size="small"
          />
        </Card>
      </Space>
    </div>
  );
};

export default LogsPage;
